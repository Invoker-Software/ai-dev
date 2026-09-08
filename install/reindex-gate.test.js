'use strict';

// This suite asserts the re-index change gate's BEHAVIOUR -- the decision
// table `codegraph-command.cjs`'s `route()` produces -- against real git
// repositories built fresh in temp directories, with a stub
// `codebase-memory-mcp` that only ever `exit 0`s. It never runs the real
// indexer and never reaches the network.
//
// It exists because the gate's defining property -- the no-change skip is
// reachable against a tree dirty at a non-denied path -- was twice observed
// only by hand against a clean tracked tree (06-VERIFICATION.md, then
// 06-07's own verify) and twice survived a defect that a dirty tree exposes
// immediately (G-06-3). The next reopening of this defect class should fail
// this suite, not survive a hand-run UAT a third time.
//
// It lives under `install/` only because that is where `package.json`'s
// test glob (`node --test --test-reporter=tap install/*.test.js`) looks --
// this file asserts nothing about the installer itself.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DEFAULT_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'claude',
  'skills',
  'gsd-codebase-reindex',
  'assets',
  'capability',
  'codegraph-command.cjs'
);

/**
 * @param {() => void} fn
 * @returns {string[]}
 */
function captureLogs(fn) {
  /** @type {string[]} */
  const logs = [];
  const orig = console.log;
  console.log = (msg) => logs.push(String(msg));
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return logs;
}

/**
 * @param {string} logPath
 * @returns {{ decision: string, elapsed_ms: number }}
 */
function parseLastLogLine(logPath) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  const last = lines[lines.length - 1];
  const decisionMatch = /decision=(\S+)/.exec(last || '');
  const elapsedMatch = /elapsed_ms=(\d+)/.exec(last || '');
  return {
    decision: decisionMatch ? decisionMatch[1] : '',
    elapsed_ms: elapsedMatch ? Number(elapsedMatch[1]) : NaN,
  };
}

/**
 * Builds a fresh git repository under a temp directory, renders the module
 * under test into it (from the SHIPPED TEMPLATE, or from
 * `CBM_TEMPLATE_OVERRIDE` when set -- the hook the mutation-proof verify
 * uses), and returns helpers scoped to that repository.
 *
 * @param {import('node:test').TestContext} t
 * @param {{ gitignore?: string, denyList?: string }} [opts]
 * @returns {{
 *   repo: string,
 *   run: () => { decision: string, elapsed_ms: number },
 *   commit: (relPath: string, content: string) => void,
 *   mod: any,
 * }}
 */
function makeRepo(t, opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-reindex-gate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const repo = path.join(root, 'repo');
  const binDir = path.join(root, 'bin');
  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });
  // resolveMainRoot() requires .planning/ under the resolved main root.
  fs.mkdirSync(path.join(repo, '.planning'), { recursive: true });

  // The fake indexer -- runReindex()'s bare-name PATH lookup finds this
  // once binDir is prepended below, so the real binary is never invoked.
  const fakeBinary = path.join(binDir, 'codebase-memory-mcp');
  fs.writeFileSync(fakeBinary, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(fakeBinary, 0o755);

  execFileSync('git', ['init', '-q', '-b', 'main', repo]);
  execFileSync('git', ['-C', repo, 'config', 'user.email', 'test@example.invalid']);
  execFileSync('git', ['-C', repo, 'config', 'user.name', 'reindex-gate-test']);
  execFileSync('git', ['-C', repo, 'config', 'commit.gpgsign', 'false']);

  if (opts.gitignore) {
    fs.writeFileSync(path.join(repo, '.gitignore'), opts.gitignore);
  }

  fs.writeFileSync(path.join(repo, 'README.md'), 'initial\n');
  execFileSync('git', ['-C', repo, 'add', '-A']);
  execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'initial']);

  const templatePath = process.env.CBM_TEMPLATE_OVERRIDE || DEFAULT_TEMPLATE_PATH;
  const denyList = opts.denyList || '[".git"]';
  let rendered = fs.readFileSync(templatePath, 'utf8');
  rendered = rendered.split('@@CBM_PROJECT_NAME@@').join('reindex-gate-test');
  rendered = rendered.split('@@CBM_BINARY@@').join(fakeBinary);
  rendered = rendered.split('@@CBM_DENY_LIST@@').join(denyList);
  for (const token of ['@@CBM_PROJECT_NAME@@', '@@CBM_BINARY@@', '@@CBM_DENY_LIST@@']) {
    assert.ok(!rendered.includes(token), `rendered module must not retain unsubstituted token ${token}`);
  }

  const modulePath = path.join(root, 'codegraph-command.cjs');
  fs.writeFileSync(modulePath, rendered);
  const mod = require(modulePath);

  const prevCwd = process.cwd();
  const prevPath = process.env.PATH || '';
  process.chdir(repo);
  process.env.PATH = binDir + path.delimiter + prevPath;
  t.after(() => {
    process.chdir(prevCwd);
    process.env.PATH = prevPath;
  });

  function run() {
    captureLogs(() => mod.route({ args: ['codegraph', 'reindex', '--via', 'test'] }));
    return parseLastLogLine(path.join(repo, '.gsd', 'codebase-reindex.log'));
  }

  /**
   * @param {string} relPath
   * @param {string} content
   */
  function commit(relPath, content) {
    fs.writeFileSync(path.join(repo, relPath), content);
    execFileSync('git', ['-C', repo, 'add', '-A']);
    execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'auto-committed for test']);
  }

  return { repo, run, commit, mod };
}

test('the locked export contract: sole export route, synchronous, quiet outside a git repo', (t) => {
  const { mod } = makeRepo(t);

  assert.deepStrictEqual(Object.keys(mod), ['route']);
  assert.strictEqual(typeof mod.route, 'function');
  assert.notStrictEqual(mod.route.constructor.name, 'AsyncFunction');

  const notGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-reindex-gate-notgit-'));
  t.after(() => fs.rmSync(notGitDir, { recursive: true, force: true }));
  const prevCwd = process.cwd();
  process.chdir(notGitDir);
  try {
    assert.doesNotThrow(() => mod.route({ args: ['codegraph', 'reindex', '--via', 'test'] }));
  } finally {
    process.chdir(prevCwd);
  }
  assert.ok(!fs.existsSync(path.join(notGitDir, '.gsd')), 'no log file should be created outside a resolvable checkout');
});

test('fail-open: the first invocation in a fresh repository re-indexes because there is no marker to diff against', (t) => {
  const { run } = makeRepo(t);
  const result = run();
  assert.strictEqual(result.decision, 'reindexed');
});

test('the gap itself: a tree dirty at a non-denied path re-indexes once, then skips on the very next run, under 1500ms', (t) => {
  const { repo, run } = makeRepo(t);
  fs.writeFileSync(path.join(repo, 'untracked.txt'), 'dirty\n');

  const first = run();
  assert.strictEqual(first.decision, 'reindexed');

  const second = run();
  assert.strictEqual(second.decision, 'skipped-no-change');
  assert.ok(second.elapsed_ms < 1500, `skip elapsed_ms ${second.elapsed_ms} should be under 1500`);
});

test('the freshness half: rewriting the dirty file\'s content behind an unchanged ?? status code forces the next run to re-index', (t) => {
  const { repo, run } = makeRepo(t);
  const untracked = path.join(repo, 'untracked.txt');
  fs.writeFileSync(untracked, 'dirty\n');

  assert.strictEqual(run().decision, 'reindexed');
  assert.strictEqual(run().decision, 'skipped-no-change');

  fs.writeFileSync(untracked, 'dirty, but a longer and different body now\n');
  assert.strictEqual(run().decision, 'reindexed');
  assert.strictEqual(run().decision, 'skipped-no-change');
});

test('denied paths do not defeat the skip: .gsd/ (undenied by any .gitignore) and .gsd-capabilities.json both stay skippable', (t) => {
  const { repo, run } = makeRepo(t, { denyList: '[".git"]' });

  assert.strictEqual(run().decision, 'reindexed');
  assert.strictEqual(run().decision, 'skipped-no-change');

  fs.writeFileSync(path.join(repo, '.gsd-capabilities.json'), '{}\n');
  assert.strictEqual(run().decision, 'skipped-no-change');
});

test('a commit on a non-denied path forces a refresh even when the dirty signature is unchanged', (t) => {
  const { run, commit } = makeRepo(t);

  assert.strictEqual(run().decision, 'reindexed');
  assert.strictEqual(run().decision, 'skipped-no-change');

  commit('new-file.txt', 'new content\n');
  assert.strictEqual(run().decision, 'reindexed');
});

test('marker damage is fail-open: a marker missing dirty_digest, or one that is not valid JSON, forces a re-index', (t) => {
  const { repo, run } = makeRepo(t);

  assert.strictEqual(run().decision, 'reindexed');
  assert.strictEqual(run().decision, 'skipped-no-change');

  const markerPath = path.join(repo, '.gsd', 'codebase-reindex-state.json');
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  delete marker.dirty_digest;
  fs.writeFileSync(markerPath, JSON.stringify(marker));
  assert.strictEqual(run().decision, 'reindexed');
  assert.strictEqual(run().decision, 'skipped-no-change');

  fs.writeFileSync(markerPath, 'not valid json{{{');
  assert.strictEqual(run().decision, 'reindexed');
});
