'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { checkPrerequisites, main } = require('./cli.js');

function makeCfgDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-prereq-test-'));
  // Pre-seed vexp as already registered so a `main()`-level run in this file
  // never needs to shell out to the real `claude` binary.
  fs.writeFileSync(
    path.join(dir, '.claude.json'),
    JSON.stringify({ mcpServers: { vexp: {} } })
  );
  return dir;
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
 * Drive the exported `main()` directly: swap process.argv, capture
 * stdout/stderr, and report whether the run rejected.
 * @param {string[]} argv
 * @returns {Promise<{ error: Error | null, stderr: string }>}
 */
async function runMain(argv) {
  const origArgv = process.argv;
  /** @type {string[]} */
  const stderrChunks = [];
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  const origConsoleLog = console.log;

  process.argv = ['node', 'cli.js', ...argv];
  process.stderr.write = /** @type {typeof process.stderr.write} */ (
    (/** @type {any} */ chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    }
  );
  console.log = () => {};

  /** @type {Error | null} */
  let error = null;
  try {
    await main();
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
  } finally {
    process.argv = origArgv;
    process.stderr.write = origStderrWrite;
    console.log = origConsoleLog;
  }

  return { error, stderr: stderrChunks.join('\n') };
}

test('a nonexistent target path is refused and does not exist afterwards', (t) => {
  const missing = path.join(
    os.tmpdir(),
    'ai-dev-prereq-test-missing-' + process.pid + '-' + Date.now()
  );

  assert.throws(() => checkPrerequisites([missing]), /config directory not found/);
  assert.strictEqual(fs.existsSync(missing), false);
});

test('a path that exists but is a regular file rather than a directory is refused', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const filePath = path.join(dir, 'not-a-directory');
  fs.writeFileSync(filePath, 'a regular file');
  // Confirm the fixture is actually the non-directory case checkPrerequisites
  // distinguishes via fs.statSync(target).isDirectory() before asserting on it.
  assert.strictEqual(fs.statSync(filePath).isDirectory(), false);

  assert.throws(() => checkPrerequisites([filePath]), /config directory not found/);
});

test('a symlink pointing at a real directory is accepted', (t) => {
  const dir = makeCfgDir();
  const link = path.join(
    os.tmpdir(),
    'ai-dev-prereq-test-symlink-' + process.pid + '-' + Date.now()
  );
  fs.symlinkSync(dir, link, 'dir');
  t.after(() => {
    fs.rmSync(link, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const artifacts = checkPrerequisites([link]);
  assert.ok(artifacts.length > 0);
});

test('an invocation naming one valid and one invalid target writes zero files into the valid target (INST-06)', async (t) => {
  const valid = makeCfgDir();
  const missing = path.join(
    os.tmpdir(),
    'ai-dev-prereq-test-missing2-' + process.pid + '-' + Date.now()
  );
  t.after(() => fs.rmSync(valid, { recursive: true, force: true }));

  const before = listTree(valid);
  const { error } = await runMain([valid, missing]);

  assert.ok(error, 'the run must fail closed');
  assert.deepStrictEqual(
    listTree(valid),
    before,
    'the valid target must be byte-for-byte untouched'
  );
});

test('the node-major-version gate and the vexp gate produce their own distinct error messages', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // Simulate the node-version gate by overriding process.versions.node for
  // the duration of this assertion only.
  const originalVersions = process.versions;
  Object.defineProperty(process, 'versions', {
    value: { ...originalVersions, node: '18.19.0' },
    configurable: true,
  });
  let nodeVersionMessage = '';
  try {
    checkPrerequisites([dir]);
    assert.fail('expected checkPrerequisites to throw for an old node version');
  } catch (err) {
    nodeVersionMessage = err instanceof Error ? err.message : String(err);
  } finally {
    Object.defineProperty(process, 'versions', {
      value: originalVersions,
      configurable: true,
    });
  }
  assert.match(nodeVersionMessage, /node/i);
  assert.match(nodeVersionMessage, />=\s*20|20/);
  assert.doesNotMatch(nodeVersionMessage, /vexp/i);

  // Simulate the vexp gate by scoping PATH to a directory with no `vexp`
  // executable (but which does still resolve the real `claude` binary via
  // AI_DEV_CLAUDE_BIN, so the two gates stay independently reachable).
  const emptyPathDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-empty-path-'));
  t.after(() => fs.rmSync(emptyPathDir, { recursive: true, force: true }));
  const originalPath = process.env.PATH;
  process.env.PATH = emptyPathDir;
  let vexpMessage = '';
  try {
    checkPrerequisites([dir]);
    assert.fail('expected checkPrerequisites to throw when vexp is not on PATH');
  } catch (err) {
    vexpMessage = err instanceof Error ? err.message : String(err);
  } finally {
    process.env.PATH = originalPath;
  }
  assert.match(vexpMessage, /vexp/i);
  assert.doesNotMatch(vexpMessage, /node >=/i);

  assert.notStrictEqual(nodeVersionMessage, vexpMessage);
});
