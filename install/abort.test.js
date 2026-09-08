'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const { main } = require('./cli.js');

function makeCfgDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-test-'));
  // Pre-seed codebase-memory-mcp as already registered so tests don't shell
  // out to the real `claude` CLI unless a test explicitly wants to exercise
  // that stage.
  fs.writeFileSync(
    path.join(dir, '.claude.json'),
    JSON.stringify({ mcpServers: { 'codebase-memory-mcp': {} } })
  );
  return dir;
}

/**
 * @param {string} dir
 * @returns {string}
 */
function manifestPath(dir) {
  return path.join(dir, 'ai-dev', 'manifest.json');
}

/**
 * Drive the exported `main()` directly: swap process.argv, capture
 * stdout/stderr, and report whether the run rejected.
 * @param {string[]} argv
 * @returns {Promise<{ error: Error | null, stderr: string, stdout: string }>}
 */
async function runMain(argv) {
  const origArgv = process.argv;
  /** @type {string[]} */
  const stderrChunks = [];
  /** @type {string[]} */
  const stdoutChunks = [];
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  const origConsoleLog = console.log;
  const origFetch = globalThis.fetch;

  process.argv = ['node', 'cli.js', ...argv];
  process.stderr.write = /** @type {typeof process.stderr.write} */ (
    (/** @type {any} */ chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    }
  );
  console.log = (msg) => {
    stdoutChunks.push(String(msg));
  };
  // This file exercises abort/idempotency semantics, not the staleness
  // report itself (staleness.test.js owns that) — stub fetch so main()'s
  // checkStaleness call never reaches the live GitHub API, keeping the
  // whole suite offline and fast per this phase's own requirement.
  globalThis.fetch = /** @type {typeof fetch} */ (async (/** @type {any} */ url) => {
    const isCompare = String(url).includes('/compare/');
    return /** @type {any} */ ({
      ok: true,
      status: 200,
      json: async () =>
        isCompare
          ? { status: 'ahead', ahead_by: 0, behind_by: 0 }
          : { default_branch: 'main' },
    });
  });

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
    globalThis.fetch = origFetch;
  }

  return { error, stderr: stderrChunks.join('\n'), stdout: stdoutChunks.join('\n') };
}

// CHANGED (D-17 reordering): the obstruction below used to be a bare 0o444
// (r--r--r--, no execute/search bit). Task 1 moved the MCP stage ahead of
// file deploy, and the MCP stage's own `fs.readFileSync(.claude.json)` needs
// directory search (x) permission to even open a file that already exists —
// 0o444 denies that, so with the old obstruction this test would have made
// registerCodebaseMemoryIfNeeded's two reads throw EACCES (caught and
// swallowed as not-present/not-registered) and then fall through to a REAL,
// unmocked `claude mcp add` subprocess against an unwritable CLAUDE_CONFIG_DIR
// — a nondeterministic dependency on the live `claude` binary's behavior that
// this test never intended to exercise. 0o555 (r-xr-xr-x) keeps search
// permission so the pre-seeded `.claude.json` still reads cleanly (the MCP
// stage stays a clean no-op, exactly as before the reordering) while still
// denying writes, so the obstruction remains isolated to the file-deploy
// stage as originally designed.
test('a mid-run failure on the second of two targets leaves the first with a manifest, the second without, and reports the abort', async (t) => {
  const a = makeCfgDir();
  const b = makeCfgDir();
  t.after(() => {
    fs.chmodSync(b, 0o755);
    fs.rmSync(a, { recursive: true, force: true });
    fs.rmSync(b, { recursive: true, force: true });
  });

  fs.chmodSync(b, 0o555);

  const { error, stderr } = await runMain([a, b]);

  assert.ok(error, 'main() should reject when a target fails mid-run');
  assert.ok(fs.existsSync(manifestPath(a)), 'first target should have a manifest');
  assert.ok(!fs.existsSync(manifestPath(b)), 'second target should have no manifest');

  const bAbs = fs.realpathSync(b);
  assert.match(stderr, /^completed: /m);
  assert.ok(stderr.includes(fs.realpathSync(a)), 'completed: line should name the first target');
  assert.match(stderr, /^stopped in: /m);
  assert.ok(stderr.includes(bAbs), 'stopped in: line should name the second target');
});

// CHANGED (D-17 reordering): same 0o444 -> 0o555 correction as the test
// above, for the same reason — see that test's comment.
test('re-running after the obstruction is removed converges without rollback: both targets end with manifests, exit succeeds', async (t) => {
  const a = makeCfgDir();
  const b = makeCfgDir();
  t.after(() => {
    fs.rmSync(a, { recursive: true, force: true });
    fs.rmSync(b, { recursive: true, force: true });
  });

  fs.chmodSync(b, 0o555);
  await runMain([a, b]);
  fs.chmodSync(b, 0o755);

  const { error, stdout } = await runMain([a, b]);

  assert.strictEqual(error, null);
  assert.ok(fs.existsSync(manifestPath(a)));
  assert.ok(fs.existsSync(manifestPath(b)));
  // The first target was already fully deployed by the first (partially
  // failed) run, so its files must report unchanged on this second pass.
  assert.ok(stdout.includes('unchanged: '));
});

// CHANGED (D-17 reordering): this test's original expectation was
// "leaves its files deployed but writes no manifest for it" — true only
// under the OLD order (file deploy before MCP). Task 1 moved the MCP stage
// ahead of file deploy, so a target whose MCP registration fails now never
// reaches the file-deploy loop at all: the expectation inverts to "leaves no
// files deployed and no manifest."
test('a target whose MCP registration fails leaves no files deployed and no manifest, since the MCP stage now runs before file deploy (D-17)', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const realExecFileSync = childProcess.execFileSync;
  t.mock.method(
    childProcess,
    'execFileSync',
    /** @type {typeof childProcess.execFileSync} */ ((file, args, opts) => {
    // Only the `claude mcp add` invocation should fail here — the self-SHA
    // discovery fallback (`git rev-parse HEAD`) must keep working for real,
    // since this dev-clone environment has no node_modules/.package-lock.json
    // one level above the repo root and legitimately needs it.
    if (file === 'git') return realExecFileSync(file, args, opts);
    throw new Error('simulated claude mcp add failure');
  })
  );

  const { error } = await runMain([dir]);

  assert.ok(error);
  assert.ok(!fs.existsSync(manifestPath(dir)));
  const deployed = fs.readdirSync(dir).filter((f) => f !== '.claude.json');
  assert.strictEqual(
    deployed.length,
    0,
    'no files should have been deployed: the MCP stage now runs before file deploy and failed first (D-17)'
  );
});

test('two targets where the first does not exist abort in the prerequisite gate before any target is touched', async (t) => {
  const missing = path.join(os.tmpdir(), 'ai-dev-test-missing-' + process.pid + '-' + Date.now());
  const b = makeCfgDir();
  t.after(() => fs.rmSync(b, { recursive: true, force: true }));

  const { error } = await runMain([missing, b]);

  assert.ok(error);
  assert.ok(error !== null && String(error.message).includes(missing));
  const untouched = fs.readdirSync(b).filter((f) => f !== '.claude.json');
  assert.strictEqual(untouched.length, 0, 'second target must be untouched');
});

test('passing the same config directory twice is not an error: the second pass reports everything unchanged and the manifest exists once', async (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const { error, stdout } = await runMain([dir, dir]);

  assert.strictEqual(error, null);
  assert.ok(fs.existsSync(manifestPath(dir)));
  // First pass deploys (writing:); second pass over the same directory
  // reports everything unchanged — both must be present in this one run.
  assert.ok(stdout.includes('writing: '));
  assert.ok(stdout.includes('unchanged: '));
});
