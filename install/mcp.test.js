'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const { registerCodebaseMemoryIfNeeded } = require('./cli.js');

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

test('a target whose .claude.json already carries a codebase-memory-mcp entry does not invoke the subprocess and prints already-registered (INST-10)', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const before = JSON.stringify({ mcpServers: { 'codebase-memory-mcp': { command: 'codebase-memory-mcp' } } });
  fs.writeFileSync(claudeJsonPath(dir), before);

  const execMock = t.mock.method(childProcess, 'execFileSync', () => {
    throw new Error('execFileSync must not be called when already registered and nothing needs removing');
  });

  /** @type {{ removal: string, registration: string } | undefined} */
  let outcome;
  const logs = captureLogs(() => {
    outcome = registerCodebaseMemoryIfNeeded(dir, CLAUDE_BIN, false);
  });

  assert.strictEqual(outcome && outcome.registration, 'already-registered');
  assert.strictEqual(outcome && outcome.removal, 'not-present');
  assert.strictEqual(execMock.mock.callCount(), 0);
  assert.ok(logs.some((l) => l.startsWith('already registered: codebase-memory-mcp MCP server')));
  assert.strictEqual(fs.readFileSync(claudeJsonPath(dir), 'utf8'), before);
});

test('a target whose .claude.json is absent invokes the subprocess exactly once with the exact argument array and CLAUDE_CONFIG_DIR env', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  assert.strictEqual(fs.existsSync(claudeJsonPath(dir)), false);

  const execMock = t.mock.method(childProcess, 'execFileSync', () => ({}));

  const outcome = registerCodebaseMemoryIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(outcome.registration, 'registered');
  assert.strictEqual(outcome.removal, 'not-present');
  assert.strictEqual(execMock.mock.callCount(), 1);

  const call = execMock.mock.calls[0];
  assert.strictEqual(call.arguments[0], CLAUDE_BIN);
  assert.deepStrictEqual(call.arguments[1], [
    'mcp',
    'add',
    '-s',
    'user',
    'codebase-memory-mcp',
    '--',
    'codebase-memory-mcp',
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
  const outcome = registerCodebaseMemoryIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(outcome.registration, 'registered');
  assert.strictEqual(outcome.removal, 'not-present');
  assert.strictEqual(execMock.mock.callCount(), 1);
  assert.strictEqual(fs.readFileSync(claudeJsonPath(dir), 'utf8'), '');
});

test('an unparsable .claude.json is treated as not yet registered', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const before = '{not valid json';
  fs.writeFileSync(claudeJsonPath(dir), before);

  const execMock = t.mock.method(childProcess, 'execFileSync', () => ({}));
  const outcome = registerCodebaseMemoryIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(outcome.registration, 'registered');
  assert.strictEqual(outcome.removal, 'not-present');
  assert.strictEqual(execMock.mock.callCount(), 1);
  assert.strictEqual(fs.readFileSync(claudeJsonPath(dir), 'utf8'), before);
});

test('an mcpServers[\'codebase-memory-mcp\'] value of an empty object counts as registered (probe adjacency case)', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const before = JSON.stringify({ mcpServers: { 'codebase-memory-mcp': {} } });
  fs.writeFileSync(claudeJsonPath(dir), before);

  const execMock = t.mock.method(childProcess, 'execFileSync', () => {
    throw new Error('execFileSync must not be called when already registered');
  });
  const outcome = registerCodebaseMemoryIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(outcome.registration, 'already-registered');
  assert.strictEqual(outcome.removal, 'not-present');
  assert.strictEqual(execMock.mock.callCount(), 0);
  assert.strictEqual(fs.readFileSync(claudeJsonPath(dir), 'utf8'), before);
});

test('an mcpServers[\'codebase-memory-mcp\'] value of null does not count as registered', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const before = JSON.stringify({ mcpServers: { 'codebase-memory-mcp': null } });
  fs.writeFileSync(claudeJsonPath(dir), before);

  const execMock = t.mock.method(childProcess, 'execFileSync', () => ({}));
  const outcome = registerCodebaseMemoryIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(outcome.registration, 'registered');
  assert.strictEqual(outcome.removal, 'not-present');
  assert.strictEqual(execMock.mock.callCount(), 1);
  assert.strictEqual(fs.readFileSync(claudeJsonPath(dir), 'utf8'), before);
});

test('the subprocess is never invoked with shell: true or a single concatenated command string (T-2-04)', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const execMock = t.mock.method(childProcess, 'execFileSync', () => ({}));
  registerCodebaseMemoryIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(execMock.mock.callCount(), 1);
  const call = execMock.mock.calls[0];
  assert.ok(Array.isArray(call.arguments[1]), 'the command arguments must be a real array, not a joined string');
  const opts = /** @type {{ shell?: boolean }} */ (call.arguments[2]) || {};
  assert.notStrictEqual(opts.shell, true);
});

test('a target whose .claude.json carries no vexp entry produces removal outcome not-present and spawns no removal subprocess (D-16 check-before-mutate)', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const before = JSON.stringify({ mcpServers: { 'codebase-memory-mcp': {} } });
  fs.writeFileSync(claudeJsonPath(dir), before);

  const execMock = t.mock.method(childProcess, 'execFileSync', () => {
    throw new Error('execFileSync must not be called when nothing needs removing or registering');
  });

  const outcome = registerCodebaseMemoryIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(outcome.removal, 'not-present');
  assert.strictEqual(outcome.registration, 'already-registered');
  assert.strictEqual(execMock.mock.callCount(), 0);
});

test('a target whose .claude.json carries a vexp entry spawns the exact removal argument array with CLAUDE_CONFIG_DIR set, and yields removed (D-16)', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(claudeJsonPath(dir), JSON.stringify({ mcpServers: { vexp: { command: 'vexp' } } }));

  /** @type {{ file: unknown, args: unknown, opts: unknown }[]} */
  const calls = [];
  t.mock.method(
    childProcess,
    'execFileSync',
    /** @type {typeof childProcess.execFileSync} */ ((file, args, opts) => {
      calls.push({ file, args, opts });
      return /** @type {any} */ ({});
    })
  );

  const outcome = registerCodebaseMemoryIfNeeded(dir, CLAUDE_BIN, false);

  assert.strictEqual(outcome.removal, 'removed');
  assert.strictEqual(outcome.registration, 'registered');
  assert.strictEqual(calls.length, 2, 'exactly the remove call, then the add call');
  assert.strictEqual(calls[0].file, CLAUDE_BIN);
  assert.deepStrictEqual(calls[0].args, ['mcp', 'remove', '-s', 'user', 'vexp']);
  const removeOpts = /** @type {{ env?: Record<string, string | undefined> }} */ (calls[0].opts);
  assert.strictEqual(removeOpts && removeOpts.env && removeOpts.env.CLAUDE_CONFIG_DIR, dir);
  assert.strictEqual(calls[1].file, CLAUDE_BIN);
  assert.deepStrictEqual(calls[1].args, [
    'mcp',
    'add',
    '-s',
    'user',
    'codebase-memory-mcp',
    '--',
    'codebase-memory-mcp',
  ]);
});

test('a removal whose subprocess throws yields removal-failed, warns, and the registration call still happens (D-17 non-fatal)', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(claudeJsonPath(dir), JSON.stringify({ mcpServers: { vexp: { command: 'vexp' } } }));

  /** @type {{ file: unknown, args: unknown }[]} */
  const calls = [];
  t.mock.method(
    childProcess,
    'execFileSync',
    /** @type {typeof childProcess.execFileSync} */ ((file, args, opts) => {
      calls.push({ file, args });
      if (Array.isArray(args) && args[1] === 'remove') {
        throw new Error('simulated claude mcp remove failure');
      }
      return /** @type {any} */ ({});
    })
  );

  const origStderrWrite = process.stderr.write.bind(process.stderr);
  /** @type {string[]} */
  const stderrChunks = [];
  process.stderr.write = /** @type {typeof process.stderr.write} */ (
    (/** @type {any} */ chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    }
  );

  /** @type {{ removal: string, registration: string } | undefined} */
  let outcome;
  try {
    outcome = registerCodebaseMemoryIfNeeded(dir, CLAUDE_BIN, false);
  } finally {
    process.stderr.write = origStderrWrite;
  }

  assert.strictEqual(outcome && outcome.removal, 'removal-failed');
  assert.strictEqual(outcome && outcome.registration, 'registered');
  assert.strictEqual(calls.length, 2, 'both the failed removal and the registration call must have been attempted');
  assert.deepStrictEqual(calls[1].args, [
    'mcp',
    'add',
    '-s',
    'user',
    'codebase-memory-mcp',
    '--',
    'codebase-memory-mcp',
  ]);
  assert.ok(
    stderrChunks.some((l) => l.toLowerCase().includes('warning') && l.includes('vexp')),
    'a warning naming vexp must be printed on removal failure'
  );
});
