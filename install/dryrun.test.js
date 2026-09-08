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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-test-'));
}

/**
 * Recursively list every path under `dir`, relative to `dir`, sorted.
 * @param {string} dir
 * @returns {string[]}
 */
function listTree(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true })
    .map((p) => String(p).split(path.sep).join('/'))
    .sort();
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

test('dry run against an empty target prints would-write for every artifact and leaves it byte-identical', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));

  const artifacts = checkPrerequisites([cfgDir]);
  const claudeBin = resolveClaudeBin();
  const before = listTree(cfgDir);
  assert.strictEqual(before.length, 0);
  assert.ok(artifacts.length > 0);

  // Installed only now: checkPrerequisites above legitimately spawns
  // `codebase-memory-mcp --version` (D-20's unconditional gate) against the
  // real binary, and this test's assertion is specifically that
  // deployTarget's *dry-run* path spawns nothing.
  const execMock = t.mock.method(childProcess, 'execFileSync', () => {
    throw new Error('execFileSync must not be called during --dry-run');
  });

  const logs = captureLogs(() => {
    deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, true);
  });

  assert.deepStrictEqual(listTree(cfgDir), before);
  assert.strictEqual(execMock.mock.callCount(), 0);

  const wouldWriteLines = logs.filter((l) => l.startsWith('would write: '));
  assert.strictEqual(wouldWriteLines.length, artifacts.length);
  assert.strictEqual(logs.filter((l) => l.startsWith('writing: ')).length, 0);
  assert.strictEqual(
    logs.filter((l) => l.startsWith('replacing (content differs): ')).length,
    0
  );
});

test('dry run against a correctly-deployed target reports everything unchanged and writes nothing new', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));

  const artifacts = checkPrerequisites([cfgDir]);
  const claudeBin = resolveClaudeBin();

  // Installed only now: checkPrerequisites above legitimately spawns
  // `codebase-memory-mcp --version` (D-20's unconditional gate) against the
  // real binary; only the subsequent `claude mcp add` call is mocked.
  const execMock = t.mock.method(childProcess, 'execFileSync', () => ({}));

  // Real (non-dry) deploy first, to put the target in the "already correct" state.
  deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);
  execMock.mock.restore();
  const execMockDry = t.mock.method(childProcess, 'execFileSync', () => {
    throw new Error('execFileSync must not be called during --dry-run');
  });

  const before = listTree(cfgDir);
  const logs = captureLogs(() => {
    deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, true);
  });

  assert.deepStrictEqual(listTree(cfgDir), before);
  const unchangedLines = logs.filter((l) => l.startsWith('unchanged: '));
  assert.strictEqual(unchangedLines.length, artifacts.length);
  assert.strictEqual(logs.filter((l) => l.startsWith('writing: ')).length, 0);
  assert.strictEqual(
    logs.filter((l) => l.startsWith('replacing (content differs): ')).length,
    0
  );
  assert.strictEqual(execMockDry.mock.callCount(), 0);
});

test('dry run reports would-replace for a file whose content differs, and leaves its bytes untouched', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));

  const artifacts = checkPrerequisites([cfgDir]);
  const claudeBin = resolveClaudeBin();

  // Installed only now: checkPrerequisites above legitimately spawns
  // `codebase-memory-mcp --version` (D-20's unconditional gate) against the
  // real binary; only the subsequent `claude mcp add` call is mocked.
  t.mock.method(childProcess, 'execFileSync', () => ({}));

  deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);

  const target = artifacts[0];
  const destPath = path.join(cfgDir, target.rel);
  const differentContent = 'deliberately different content';
  fs.writeFileSync(destPath, differentContent);

  const logs = captureLogs(() => {
    deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, true);
  });

  assert.strictEqual(fs.readFileSync(destPath, 'utf8'), differentContent);

  const wouldReplaceLines = logs.filter((l) => l.startsWith(`would replace: ${destPath}`));
  assert.strictEqual(wouldReplaceLines.length, 1);
  const unchangedLines = logs.filter((l) => l.startsWith('unchanged: '));
  assert.strictEqual(unchangedLines.length, artifacts.length - 1);
  assert.strictEqual(logs.filter((l) => l.startsWith('replacing (content differs): ')).length, 0);
});

test('dry run states codebase-memory-mcp would be registered and never spawns the claude subprocess', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));

  const artifacts = checkPrerequisites([cfgDir]);
  const claudeBin = resolveClaudeBin();

  const execMock = t.mock.method(childProcess, 'execFileSync', () => {
    throw new Error('execFileSync must not be called during --dry-run');
  });

  const logs = captureLogs(() => {
    deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, true);
  });

  assert.strictEqual(execMock.mock.callCount(), 0);
  assert.ok(logs.some((l) => l.startsWith('would register: codebase-memory-mcp MCP server')));
  assert.ok(!logs.some((l) => l.startsWith('registered: codebase-memory-mcp MCP server')));
});

test('dry run against a target carrying an old vexp entry prints would remove and spawns no removal subprocess (D-16/D-17)', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cfgDir, '.claude.json'),
    JSON.stringify({ mcpServers: { vexp: { command: 'vexp' } } })
  );

  const artifacts = checkPrerequisites([cfgDir]);
  const claudeBin = resolveClaudeBin();

  const execMock = t.mock.method(childProcess, 'execFileSync', () => {
    throw new Error('execFileSync must not be called during --dry-run');
  });

  const logs = captureLogs(() => {
    deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, true);
  });

  assert.strictEqual(execMock.mock.callCount(), 0);
  assert.ok(logs.some((l) => l.startsWith('would remove: vexp MCP server')));
  assert.ok(logs.some((l) => l.startsWith('would register: codebase-memory-mcp MCP server')));
});

test('dry run against a nonexistent target aborts in the prerequisite gate exactly as a real run does', (t) => {
  const cfgDir = makeCfgDir();
  fs.rmdirSync(cfgDir);
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));

  assert.throws(() => checkPrerequisites([cfgDir]), /config directory not found/);
});

test('dry run against an empty target leaves no ai-dev/manifest.json', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));

  const artifacts = checkPrerequisites([cfgDir]);
  const claudeBin = resolveClaudeBin();

  // Installed only now: checkPrerequisites above legitimately spawns
  // `codebase-memory-mcp --version` (D-20's unconditional gate) against the
  // real binary.
  t.mock.method(childProcess, 'execFileSync', () => ({}));

  captureLogs(() => {
    deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, true);
  });

  assert.strictEqual(fs.existsSync(path.join(cfgDir, 'ai-dev', 'manifest.json')), false);
});
