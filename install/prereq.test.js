'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { checkPrerequisites, meetsVersionFloor, main } = require('./cli.js');

function makeCfgDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-prereq-test-'));
  // Pre-seed codebase-memory-mcp as already registered so a `main()`-level
  // run in this file never needs to shell out to the real `claude` binary.
  fs.writeFileSync(
    path.join(dir, '.claude.json'),
    JSON.stringify({ mcpServers: { 'codebase-memory-mcp': {} } })
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

test('the node-major-version gate, the codebase-memory-mcp presence gate, and the version-floor gate each produce their own distinct, pairwise non-overlapping error message', (t) => {
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
  assert.doesNotMatch(nodeVersionMessage, /required on PATH/i);
  assert.doesNotMatch(nodeVersionMessage, /must be at least/i);

  // Simulate the presence gate by scoping PATH to a directory with no
  // `codebase-memory-mcp` executable (but which does still resolve the real
  // `claude` binary via the ~/.local/bin fallback in resolveClaudeBin, so the
  // three gates stay independently reachable).
  const originalPath = process.env.PATH;
  const emptyPathDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-empty-path-'));
  t.after(() => fs.rmSync(emptyPathDir, { recursive: true, force: true }));
  process.env.PATH = emptyPathDir;
  let presenceMessage = '';
  try {
    checkPrerequisites([dir]);
    assert.fail('expected checkPrerequisites to throw when codebase-memory-mcp is not on PATH');
  } catch (err) {
    presenceMessage = err instanceof Error ? err.message : String(err);
  } finally {
    process.env.PATH = originalPath;
  }
  assert.match(presenceMessage, /codebase-memory-mcp/i);
  assert.match(presenceMessage, /required on PATH/i);
  assert.doesNotMatch(presenceMessage, /node >=/i);
  assert.doesNotMatch(presenceMessage, /must be at least/i);

  // Simulate the version-floor gate: PATH scoped to a directory holding an
  // executable stub named codebase-memory-mcp that reports a below-floor
  // version.
  const floorDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-floor-'));
  t.after(() => fs.rmSync(floorDir, { recursive: true, force: true }));
  const stubPath = path.join(floorDir, 'codebase-memory-mcp');
  fs.writeFileSync(stubPath, '#!/bin/sh\necho "codebase-memory-mcp 0.10.7"\n');
  fs.chmodSync(stubPath, 0o755);
  process.env.PATH = `${floorDir}${path.delimiter}${originalPath}`;
  let floorMessage = '';
  try {
    checkPrerequisites([dir]);
    assert.fail('expected checkPrerequisites to throw for a below-floor version');
  } catch (err) {
    floorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    process.env.PATH = originalPath;
  }
  assert.match(floorMessage, /0\.10\.8/);
  assert.match(floorMessage, /must be at least/i);
  assert.doesNotMatch(floorMessage, /node >=/i);
  assert.doesNotMatch(floorMessage, /required on PATH/i);

  assert.notStrictEqual(nodeVersionMessage, presenceMessage);
  assert.notStrictEqual(nodeVersionMessage, floorMessage);
  assert.notStrictEqual(presenceMessage, floorMessage);
});

test('neither the presence gate message nor the version-floor gate message names the unrelated elarsaks repo or recommends npm install', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const originalPath = process.env.PATH;
  const emptyPathDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-empty-path-2-'));
  t.after(() => fs.rmSync(emptyPathDir, { recursive: true, force: true }));
  process.env.PATH = emptyPathDir;
  let presenceMessage = '';
  try {
    checkPrerequisites([dir]);
    assert.fail('expected checkPrerequisites to throw when codebase-memory-mcp is not on PATH');
  } catch (err) {
    presenceMessage = err instanceof Error ? err.message : String(err);
  } finally {
    process.env.PATH = originalPath;
  }

  assert.doesNotMatch(presenceMessage, /elarsaks/i);
  assert.doesNotMatch(presenceMessage, /npm install/i);

  const floorDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-floor-2-'));
  t.after(() => fs.rmSync(floorDir, { recursive: true, force: true }));
  const stubPath = path.join(floorDir, 'codebase-memory-mcp');
  fs.writeFileSync(stubPath, '#!/bin/sh\necho "codebase-memory-mcp 0.10.0"\n');
  fs.chmodSync(stubPath, 0o755);
  process.env.PATH = `${floorDir}${path.delimiter}${originalPath}`;
  let floorMessage = '';
  try {
    checkPrerequisites([dir]);
    assert.fail('expected checkPrerequisites to throw for a below-floor version');
  } catch (err) {
    floorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    process.env.PATH = originalPath;
  }

  assert.doesNotMatch(floorMessage, /elarsaks/i);
  assert.doesNotMatch(floorMessage, /npm install/i);
});

test('meetsVersionFloor covers equal-to-floor, patch-above, patch-below, minor-above, major-below, and an unparsable input', () => {
  assert.strictEqual(meetsVersionFloor('codebase-memory-mcp 0.10.8', '0.10.8'), true, 'equal-to-floor');
  assert.strictEqual(meetsVersionFloor('codebase-memory-mcp 0.10.9', '0.10.8'), true, 'patch-above');
  assert.strictEqual(meetsVersionFloor('codebase-memory-mcp 0.10.7', '0.10.8'), false, 'patch-below');
  assert.strictEqual(meetsVersionFloor('codebase-memory-mcp 0.11.0', '0.10.8'), true, 'minor-above');
  assert.strictEqual(meetsVersionFloor('codebase-memory-mcp 0.9.20', '1.0.0'), false, 'major-below');
  assert.strictEqual(meetsVersionFloor('not a version string', '0.10.8'), false, 'unparsable');
});
