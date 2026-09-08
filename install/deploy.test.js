'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const { checkPrerequisites, resolveClaudeBin, deployTarget } = require('./cli.js');

/** @type {{ sha: string, ref: string, source: 'package-lock' | 'git' }} */
const DUMMY_SHA_INFO = { sha: '0'.repeat(40), ref: 'main', source: 'git' };
const DUMMY_REPO_SLUG = 'Invoker-Software/ai-dev';

function makeCfgDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-deploy-test-'));
}

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

test('a first deploy into an empty target reports writing: for every artifact and the files land', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));

  const artifacts = checkPrerequisites([cfgDir]);
  const claudeBin = resolveClaudeBin();

  // Installed only now: checkPrerequisites above legitimately spawns
  // `codebase-memory-mcp --version` (D-20's unconditional gate) against the
  // real binary.
  t.mock.method(childProcess, 'execFileSync', () => ({}));

  const logs = captureLogs(() => {
    deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);
  });

  const writingLines = logs.filter((l) => l.startsWith('writing: '));
  assert.strictEqual(writingLines.length, artifacts.length);
  for (const artifact of artifacts) {
    const destPath = path.join(cfgDir, artifact.rel);
    assert.ok(fs.existsSync(destPath), `${destPath} should exist after deploy`);
  }
});

test('an immediate second deploy reports unchanged: for every artifact and performs zero writes (proven by mtime, not just the printed lines)', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));

  const artifacts = checkPrerequisites([cfgDir]);
  const claudeBin = resolveClaudeBin();

  // Installed only now: checkPrerequisites above legitimately spawns
  // `codebase-memory-mcp --version` (D-20's unconditional gate) against the
  // real binary.
  t.mock.method(childProcess, 'execFileSync', () => ({}));

  deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);

  /** @type {Record<string, number>} */
  const mtimesBefore = {};
  for (const artifact of artifacts) {
    mtimesBefore[artifact.rel] = fs.statSync(path.join(cfgDir, artifact.rel)).mtimeMs;
  }

  const logs = captureLogs(() => {
    deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);
  });

  const unchangedLines = logs.filter((l) => l.startsWith('unchanged: '));
  assert.strictEqual(unchangedLines.length, artifacts.length);
  assert.strictEqual(logs.filter((l) => l.startsWith('writing: ')).length, 0);
  assert.strictEqual(
    logs.filter((l) => l.startsWith('replacing (content differs): ')).length,
    0
  );

  for (const artifact of artifacts) {
    const mtimeAfter = fs.statSync(path.join(cfgDir, artifact.rel)).mtimeMs;
    assert.strictEqual(
      mtimeAfter,
      mtimesBefore[artifact.rel],
      `${artifact.rel} must not have been rewritten (mtime unchanged)`
    );
  }
});

test('a deployed file whose content was altered reports replacing (content differs): and is restored to the canonical bytes', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));

  const artifacts = checkPrerequisites([cfgDir]);
  const claudeBin = resolveClaudeBin();

  // Installed only now: checkPrerequisites above legitimately spawns
  // `codebase-memory-mcp --version` (D-20's unconditional gate) against the
  // real binary.
  t.mock.method(childProcess, 'execFileSync', () => ({}));

  deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);

  const target = artifacts[0];
  const destPath = path.join(cfgDir, target.rel);
  const canonicalBytes = fs.readFileSync(destPath);
  fs.writeFileSync(destPath, 'deliberately altered content');

  const logs = captureLogs(() => {
    deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);
  });

  const replacingLines = logs.filter((l) =>
    l.startsWith(`replacing (content differs): ${destPath}`)
  );
  assert.strictEqual(replacingLines.length, 1);
  assert.strictEqual(Buffer.compare(fs.readFileSync(destPath), canonicalBytes), 0);
});

// CHANGED (D-17 reordering): the obstruction below used to be a bare 0o444
// (r--r--r--, no execute/search bit). Task 1 moved the MCP stage ahead of
// file deploy, and the MCP stage's own `.claude.json` read needs directory
// search (x) permission — 0o444 denies that, which would make the read
// throw EACCES (silently swallowed as not-present/not-registered) and fall
// through to a real, slow `claude mcp add` round trip against an unreadable
// CLAUDE_CONFIG_DIR (observed: ~6.7s) before ever reaching the file-deploy
// stage this test targets. Pre-seeding `.claude.json` as already-registered
// plus 0o555 (r-xr-xr-x: search retained, write denied) keeps the MCP stage
// a clean, subprocess-free no-op, isolating the obstruction to file deploy.
test('a write into an unwritable directory throws in-process, tagged with the deploy stage', (t) => {
  const cfgDir = makeCfgDir();
  fs.writeFileSync(
    path.join(cfgDir, '.claude.json'),
    JSON.stringify({ mcpServers: { 'codebase-memory-mcp': {} } })
  );
  fs.chmodSync(cfgDir, 0o555);
  t.after(() => {
    fs.chmodSync(cfgDir, 0o755);
    fs.rmSync(cfgDir, { recursive: true, force: true });
  });

  // Prerequisite validation (existsSync/isDirectory) only checks the target
  // exists as a directory, not that it is writable, so it passes here; the
  // failure surfaces only once deployTarget attempts the actual write.
  const artifacts = checkPrerequisites([cfgDir]);
  const claudeBin = resolveClaudeBin();

  assert.throws(
    () => {
      deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);
    },
    (/** @type {unknown} */ err) => {
      const tagged = /** @type {Error & { stage?: string }} */ (err);
      assert.ok(tagged instanceof Error);
      assert.strictEqual(tagged.stage, 'deploy');
      return true;
    }
  );
});

// CHANGED (D-17 reordering): same 0o444 -> pre-seed + 0o555 correction as
// the test above, for the same reason (this test drives the same code path
// through a real subprocess, so the slow real `claude mcp add` round trip
// would otherwise also land here).
test('driven through the exported main, a write into an unwritable directory produces a non-zero process exit (CR-01)', (t) => {
  const cfgDir = makeCfgDir();
  fs.writeFileSync(
    path.join(cfgDir, '.claude.json'),
    JSON.stringify({ mcpServers: { 'codebase-memory-mcp': {} } })
  );
  fs.chmodSync(cfgDir, 0o555);
  t.after(() => {
    fs.chmodSync(cfgDir, 0o755);
    fs.rmSync(cfgDir, { recursive: true, force: true });
  });

  // Drive the real require.main===module entrypoint as a subprocess so the
  // actual OS-level exit code (not just a caught exception) can be observed.
  // -r loads a preload that stubs global fetch so the staleness check ahead
  // of the deploy stage never reaches the live GitHub API — offline by
  // construction, per this plan's "no network request" requirement.
  const preloadPath = path.join(os.tmpdir(), `ai-dev-fetch-stub-${process.pid}-${Date.now()}.js`);
  fs.writeFileSync(
    preloadPath,
    "globalThis.fetch = async (url) => {\n" +
      "  const s = String(url);\n" +
      "  if (s.includes('/compare/')) {\n" +
      "    return { ok: true, status: 200, json: async () => ({ status: 'ahead', ahead_by: 0, behind_by: 0 }) };\n" +
      "  }\n" +
      "  return { ok: true, status: 200, json: async () => ({ default_branch: 'main' }) };\n" +
      "};\n"
  );
  t.after(() => fs.rmSync(preloadPath, { force: true }));

  const cliPath = path.join(__dirname, 'cli.js');
  const result = childProcess.spawnSync(
    process.execPath,
    ['-r', preloadPath, cliPath, cfgDir],
    { encoding: 'utf8' }
  );

  assert.notStrictEqual(result.status, 0, 'main() rejecting must surface as a non-zero exit code');
  assert.match(result.stderr, /EACCES|EPERM|ENOENT/);
});
