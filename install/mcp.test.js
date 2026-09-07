'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const { registerVexpIfNeeded } = require('./cli.js');

const CLAUDE_BIN = '/fake/claude';

function makeCfgDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-mcp-test-'));
}

/**
 * @param {string} dir
 * @returns {string}
 */
function claudeJsonPath(dir) {
  return path.join(dir, '.claude.json');
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

test('a target whose .claude.json already carries a vexp entry does not invoke the subprocess and prints already-registered (INST-10)', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const before = JSON.stringify({ mcpServers: { vexp: { command: 'vexp' } } });
  fs.writeFileSync(claudeJsonPath(dir), before);

  const execMock = t.mock.method(childProcess, 'execFileSync', () => {
    throw new Error('execFileSync must not be called when already registered');
  });

  /** @type {'registered' | 'already-registered' | 'would-register' | undefined} */
  let outcome;
  const logs = captureLogs(() => {
    outcome = registerVexpIfNeeded(dir, CLAUDE_BIN, false);
  });

  assert.strictEqual(outcome, 'already-registered');
  assert.strictEqual(execMock.mock.callCount(), 0);
  assert.ok(logs.some((l) => l.startsWith('already registered: vexp MCP server')));
  assert.strictEqual(fs.readFileSync(claudeJsonPath(dir), 'utf8'), before);
});

test('a target whose .claude.json is absent invokes the subprocess exactly once with the exact argument array and CLAUDE_CONFIG_DIR env', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  assert.strictEqual(fs.existsSync(claudeJsonPath(dir)), false);

  const execMock = t.mock.method(childProcess, 'execFileSync', () => ({}));

  const outcome = registerVexpIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(outcome, 'registered');
  assert.strictEqual(execMock.mock.callCount(), 1);

  const call = execMock.mock.calls[0];
  assert.strictEqual(call.arguments[0], CLAUDE_BIN);
  assert.deepStrictEqual(call.arguments[1], [
    'mcp',
    'add',
    '-s',
    'user',
    'vexp',
    '--',
    'vexp',
    'mcp',
  ]);
  const opts = /** @type {{ env?: Record<string, string | undefined> }} */ (call.arguments[2]);
  assert.strictEqual(opts && opts.env && opts.env.CLAUDE_CONFIG_DIR, dir);

  // still absent: the stub never actually wrote it, so "byte-identical
  // before and after" holds trivially in this branch (absent -> absent)
  assert.strictEqual(fs.existsSync(claudeJsonPath(dir)), false);
});

test('a zero-length .claude.json is treated as not yet registered (probe empty case)', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(claudeJsonPath(dir), '');

  const execMock = t.mock.method(childProcess, 'execFileSync', () => ({}));
  const outcome = registerVexpIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(outcome, 'registered');
  assert.strictEqual(execMock.mock.callCount(), 1);
  assert.strictEqual(fs.readFileSync(claudeJsonPath(dir), 'utf8'), '');
});

test('an unparsable .claude.json is treated as not yet registered', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const before = '{not valid json';
  fs.writeFileSync(claudeJsonPath(dir), before);

  const execMock = t.mock.method(childProcess, 'execFileSync', () => ({}));
  const outcome = registerVexpIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(outcome, 'registered');
  assert.strictEqual(execMock.mock.callCount(), 1);
  assert.strictEqual(fs.readFileSync(claudeJsonPath(dir), 'utf8'), before);
});

test('an mcpServers.vexp value of an empty object counts as registered (probe adjacency case)', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const before = JSON.stringify({ mcpServers: { vexp: {} } });
  fs.writeFileSync(claudeJsonPath(dir), before);

  const execMock = t.mock.method(childProcess, 'execFileSync', () => {
    throw new Error('execFileSync must not be called when already registered');
  });
  const outcome = registerVexpIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(outcome, 'already-registered');
  assert.strictEqual(execMock.mock.callCount(), 0);
  assert.strictEqual(fs.readFileSync(claudeJsonPath(dir), 'utf8'), before);
});

test('an mcpServers.vexp value of null does not count as registered', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const before = JSON.stringify({ mcpServers: { vexp: null } });
  fs.writeFileSync(claudeJsonPath(dir), before);

  const execMock = t.mock.method(childProcess, 'execFileSync', () => ({}));
  const outcome = registerVexpIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(outcome, 'registered');
  assert.strictEqual(execMock.mock.callCount(), 1);
  assert.strictEqual(fs.readFileSync(claudeJsonPath(dir), 'utf8'), before);
});

test('the subprocess is never invoked with shell: true or a single concatenated command string (T-2-04)', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const execMock = t.mock.method(childProcess, 'execFileSync', () => ({}));
  registerVexpIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(execMock.mock.callCount(), 1);
  const call = execMock.mock.calls[0];
  assert.ok(Array.isArray(call.arguments[1]), 'the command arguments must be a real array, not a joined string');
  const opts = /** @type {{ shell?: boolean }} */ (call.arguments[2]) || {};
  assert.notStrictEqual(opts.shell, true);
});
