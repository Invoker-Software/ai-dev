'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const {
  main,
  checkPrerequisites,
  resolveClaudeBin,
  deployTarget,
  grantAgentTools,
  resolveGsdDefaultsPath,
  writeGsdDefaultsGrant,
} = require('./cli.js');

const GRANT = 'mcp__codebase-memory-mcp__*';

/** @type {{ sha: string, ref: string, source: 'package-lock' | 'git' }} */
const DUMMY_SHA_INFO = { sha: '0'.repeat(40), ref: 'main', source: 'git' };
const DUMMY_REPO_SLUG = 'Invoker-Software/ai-dev';

function makeCfgDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-agent-grants-test-'));
}

/**
 * @param {string} cfgDir
 * @param {string} name
 * @param {string} content
 * @returns {string}
 */
function writeAgentFixture(cfgDir, name, content) {
  const agentsDir = path.join(cfgDir, 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  const dest = path.join(agentsDir, name);
  fs.writeFileSync(dest, content);
  return dest;
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

// --- appendAgentToolsGrant / grantAgentTools: per-file behavior ---

test('an inline tools: scalar gains the grant appended to the same line, all other bytes unchanged', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));
  const original = '---\nname: gsd-test-agent\ntools: Read, Write\n---\nBody.\n';
  const dest = writeAgentFixture(cfgDir, 'gsd-test-agent.md', original);

  let counts;
  captureLogs(() => {
    counts = grantAgentTools(cfgDir, false);
  });

  assert.deepStrictEqual(counts, { granted: 1, unchanged: 0, skipped: 0 });
  const expected = `---\nname: gsd-test-agent\ntools: Read, Write, ${GRANT}\n---\nBody.\n`;
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), expected);
});

test('a tools: block list gains one new quoted item at the end, indented to match the first item', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));
  const original = '---\nname: gsd-test-agent\ntools:\n  - Read\n  - Write\n---\nBody.\n';
  const dest = writeAgentFixture(cfgDir, 'gsd-test-agent.md', original);

  let counts;
  captureLogs(() => {
    counts = grantAgentTools(cfgDir, false);
  });

  assert.deepStrictEqual(counts, { granted: 1, unchanged: 0, skipped: 0 });
  const expected = `---\nname: gsd-test-agent\ntools:\n  - Read\n  - Write\n  - "${GRANT}"\n---\nBody.\n`;
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), expected);
});

test('an inline tools: value carrying a trailing comment keeps the comment, with the grant appended before it', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));
  const original = '---\nname: gsd-test-agent\ntools: Read, Write # keep these\n---\nBody.\n';
  const dest = writeAgentFixture(cfgDir, 'gsd-test-agent.md', original);

  let counts;
  captureLogs(() => {
    counts = grantAgentTools(cfgDir, false);
  });

  assert.deepStrictEqual(counts, { granted: 1, unchanged: 0, skipped: 0 });
  const expected = `---\nname: gsd-test-agent\ntools: Read, Write, ${GRANT} # keep these\n---\nBody.\n`;
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), expected);
});

test('an inline tools: value starting with a double quote is refused, file left byte-identical', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));
  const original = '---\nname: gsd-test-agent\ntools: "Read, Write"\n---\nBody.\n';
  const dest = writeAgentFixture(cfgDir, 'gsd-test-agent.md', original);
  const before = fs.statSync(dest).mtimeMs;

  let counts;
  const logs = captureLogs(() => {
    counts = grantAgentTools(cfgDir, false);
  });

  assert.deepStrictEqual(counts, { granted: 0, unchanged: 0, skipped: 1 });
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), original);
  assert.strictEqual(fs.statSync(dest).mtimeMs, before);
  assert.ok(logs.some((l) => l.startsWith(`skipped (`) && l.includes(dest)));
});

test('an inline tools: value starting with an opening bracket (flow sequence) is refused, file left byte-identical', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));
  const original = '---\nname: gsd-test-agent\ntools: [Read, Write]\n---\nBody.\n';
  const dest = writeAgentFixture(cfgDir, 'gsd-test-agent.md', original);
  const before = fs.statSync(dest).mtimeMs;

  let counts;
  captureLogs(() => {
    counts = grantAgentTools(cfgDir, false);
  });

  assert.deepStrictEqual(counts, { granted: 0, unchanged: 0, skipped: 1 });
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), original);
  assert.strictEqual(fs.statSync(dest).mtimeMs, before);
});

test('a definition with no tools: key is refused, file left byte-identical', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));
  const original = '---\nname: gsd-test-agent\ndescription: x\n---\nBody.\n';
  const dest = writeAgentFixture(cfgDir, 'gsd-test-agent.md', original);

  let counts;
  captureLogs(() => {
    counts = grantAgentTools(cfgDir, false);
  });

  assert.deepStrictEqual(counts, { granted: 0, unchanged: 0, skipped: 1 });
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), original);
});

test('a definition with no frontmatter at all is refused, file left byte-identical', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));
  const original = '# gsd-test-agent\n\nNo frontmatter here.\n';
  const dest = writeAgentFixture(cfgDir, 'gsd-test-agent.md', original);

  let counts;
  captureLogs(() => {
    counts = grantAgentTools(cfgDir, false);
  });

  assert.deepStrictEqual(counts, { granted: 0, unchanged: 0, skipped: 1 });
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), original);
});

test('a definition already carrying the grant bare in an inline scalar is reported unchanged and not rewritten', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));
  const original = `---\nname: gsd-test-agent\ntools: Read, Write, ${GRANT}\n---\nBody.\n`;
  const dest = writeAgentFixture(cfgDir, 'gsd-test-agent.md', original);
  const before = fs.statSync(dest).mtimeMs;

  let counts;
  captureLogs(() => {
    counts = grantAgentTools(cfgDir, false);
  });

  assert.deepStrictEqual(counts, { granted: 0, unchanged: 1, skipped: 0 });
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), original);
  assert.strictEqual(fs.statSync(dest).mtimeMs, before);
});

test('a definition already carrying the grant quoted in a block list (the exact bytes gsd-core itself writes) is reported unchanged and not rewritten', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));
  const original = `---\nname: gsd-test-agent\ntools:\n  - Read\n  - "${GRANT}"\n---\nBody.\n`;
  const dest = writeAgentFixture(cfgDir, 'gsd-test-agent.md', original);
  const before = fs.statSync(dest).mtimeMs;

  let counts;
  captureLogs(() => {
    counts = grantAgentTools(cfgDir, false);
  });

  assert.deepStrictEqual(counts, { granted: 0, unchanged: 1, skipped: 0 });
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), original);
  assert.strictEqual(fs.statSync(dest).mtimeMs, before);
});

test('a definition whose filename does not start with the GSD agent prefix is never read and never touched', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));
  const dest = writeAgentFixture(
    cfgDir,
    'adhoc-example.md',
    '---\nname: adhoc-example\ntools: Read\n---\nBody.\n'
  );
  const before = fs.statSync(dest).mtimeMs;

  let counts;
  const logs = captureLogs(() => {
    counts = grantAgentTools(cfgDir, false);
  });

  assert.deepStrictEqual(counts, { granted: 0, unchanged: 0, skipped: 0 });
  assert.strictEqual(fs.statSync(dest).mtimeMs, before);
  assert.ok(!logs.some((l) => l.includes(dest)));
});

test('a target config directory with no agents/ directory produces a reported skip and no throw', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));

  let counts;
  const logs = captureLogs(() => {
    counts = grantAgentTools(cfgDir, false);
  });

  assert.deepStrictEqual(counts, { granted: 0, unchanged: 0, skipped: 0 });
  assert.ok(logs.some((l) => l.startsWith('skipped (')));
});

test('dry run over agent definitions leaves every one byte-identical and uses the would-form wording', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));
  const original = '---\nname: gsd-test-agent\ntools: Read, Write\n---\nBody.\n';
  const dest = writeAgentFixture(cfgDir, 'gsd-test-agent.md', original);
  const before = fs.statSync(dest).mtimeMs;

  let counts;
  const logs = captureLogs(() => {
    counts = grantAgentTools(cfgDir, true);
  });

  assert.deepStrictEqual(counts, { granted: 1, unchanged: 0, skipped: 0 });
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), original);
  assert.strictEqual(fs.statSync(dest).mtimeMs, before);
  assert.ok(logs.some((l) => l.startsWith('would replace: ')));
  assert.ok(!logs.some((l) => l.startsWith('replacing (content differs): ')));
});

test('the grant step never touches an artifact the installer itself deploys, and its touched set is disjoint from checkPrerequisites\' rel values (T-r3z-01)', (t) => {
  const cfgDir = makeCfgDir();
  t.after(() => fs.rmSync(cfgDir, { recursive: true, force: true }));

  const artifacts = checkPrerequisites([cfgDir]);
  const claudeBin = resolveClaudeBin();
  t.mock.method(childProcess, 'execFileSync', () => ({}));

  // Real deploy puts ai-dev's own adhoc-*.md agent definitions in place.
  deployTarget(cfgDir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);

  const agentsDir = path.join(cfgDir, 'agents');
  const adhocFiles = fs.readdirSync(agentsDir).filter((n) => n.startsWith('adhoc-'));
  assert.ok(adhocFiles.length > 0, 'fixture assumption: ai-dev deploys at least one adhoc-*.md agent');
  const adhocMtimesBefore = Object.fromEntries(
    adhocFiles.map((n) => [n, fs.statSync(path.join(agentsDir, n)).mtimeMs])
  );

  // Simulate a gsd-core install alongside ai-dev's own deployed artifacts.
  fs.writeFileSync(
    path.join(agentsDir, 'gsd-fixture-agent.md'),
    '---\nname: gsd-fixture-agent\ntools: Read, Write\n---\nBody.\n'
  );

  const logs = captureLogs(() => grantAgentTools(cfgDir, false));

  for (const name of adhocFiles) {
    assert.strictEqual(
      fs.statSync(path.join(agentsDir, name)).mtimeMs,
      adhocMtimesBefore[name],
      `${name} must not have been touched by the grant step`
    );
    assert.ok(
      !logs.some((l) => l.includes(path.join(agentsDir, name))),
      `${name} must never be named in the grant step's own log lines`
    );
  }

  const relSet = new Set(artifacts.map((a) => a.rel));
  for (const line of logs) {
    for (const rel of relSet) {
      assert.ok(
        !line.includes(rel),
        `grant step log line must not reference deployed artifact rel path ${rel}: ${line}`
      );
    }
  }
});

// --- resolveGsdDefaultsPath ---

test('the defaults path resolver honors AI_DEV_GSD_DEFAULTS when set, and falls back to ~/.gsd/defaults.json otherwise', (t) => {
  const orig = process.env.AI_DEV_GSD_DEFAULTS;
  t.after(() => {
    if (orig === undefined) delete process.env.AI_DEV_GSD_DEFAULTS;
    else process.env.AI_DEV_GSD_DEFAULTS = orig;
  });

  process.env.AI_DEV_GSD_DEFAULTS = '/tmp/custom-defaults.json';
  assert.strictEqual(resolveGsdDefaultsPath(), '/tmp/custom-defaults.json');

  delete process.env.AI_DEV_GSD_DEFAULTS;
  assert.strictEqual(resolveGsdDefaultsPath(), path.join(os.homedir(), '.gsd', 'defaults.json'));
});

// --- writeGsdDefaultsGrant: home-level defaults file ---

test('the global defaults file is created, with the grant, when it does not exist', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const defaultsPath = path.join(dir, 'nested', 'defaults.json');

  const logs = captureLogs(() => writeGsdDefaultsGrant(defaultsPath, false));

  assert.ok(fs.existsSync(defaultsPath));
  const written = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));
  assert.deepStrictEqual(written.agent_tools, { '*': [GRANT] });
  assert.ok(logs.some((l) => l.startsWith('writing: ')));
});

test("an existing defaults file is merged: unrelated keys, other selectors, and the wildcard's own pre-existing entries all survive", (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const defaultsPath = path.join(dir, 'defaults.json');
  const initial = {
    unrelated_key: 'keep-me',
    agent_tools: {
      '*': ['Bash'],
      'gsd-executor': ['Read'],
    },
  };
  fs.writeFileSync(defaultsPath, JSON.stringify(initial, null, 2) + '\n');

  captureLogs(() => writeGsdDefaultsGrant(defaultsPath, false));

  const written = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));
  assert.strictEqual(written.unrelated_key, 'keep-me');
  assert.deepStrictEqual(written.agent_tools['gsd-executor'], ['Read']);
  assert.deepStrictEqual(written.agent_tools['*'], ['Bash', GRANT]);
});

test('a defaults file already carrying the grant is not rewritten at all', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const defaultsPath = path.join(dir, 'defaults.json');
  const initial = { agent_tools: { '*': [GRANT] } };
  const bytes = JSON.stringify(initial, null, 2) + '\n';
  fs.writeFileSync(defaultsPath, bytes);
  const before = fs.statSync(defaultsPath).mtimeMs;

  const logs = captureLogs(() => writeGsdDefaultsGrant(defaultsPath, false));

  assert.strictEqual(fs.readFileSync(defaultsPath, 'utf8'), bytes);
  assert.strictEqual(fs.statSync(defaultsPath).mtimeMs, before);
  assert.ok(logs.some((l) => l.startsWith('unchanged: ')));
});

test('a defaults file that cannot be parsed makes the run throw, naming the file, and leaves it byte-identical', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const defaultsPath = path.join(dir, 'defaults.json');
  const bytes = '{ not valid json';
  fs.writeFileSync(defaultsPath, bytes);

  assert.throws(() => writeGsdDefaultsGrant(defaultsPath, false), (err) => {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes(defaultsPath));
    return true;
  });
  assert.strictEqual(fs.readFileSync(defaultsPath, 'utf8'), bytes);
});

test('a defaults file whose agent_tools is not a plain object throws and leaves it untouched', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const defaultsPath = path.join(dir, 'defaults.json');
  const bytes = JSON.stringify({ agent_tools: 'nope' }, null, 2) + '\n';
  fs.writeFileSync(defaultsPath, bytes);

  assert.throws(() => writeGsdDefaultsGrant(defaultsPath, false), (err) => {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes(defaultsPath));
    return true;
  });
  assert.strictEqual(fs.readFileSync(defaultsPath, 'utf8'), bytes);
});

test('a defaults file whose wildcard selector is not an array throws and leaves it untouched', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const defaultsPath = path.join(dir, 'defaults.json');
  const bytes = JSON.stringify({ agent_tools: { '*': 'nope' } }, null, 2) + '\n';
  fs.writeFileSync(defaultsPath, bytes);

  assert.throws(() => writeGsdDefaultsGrant(defaultsPath, false), (err) => {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes(defaultsPath));
    return true;
  });
  assert.strictEqual(fs.readFileSync(defaultsPath, 'utf8'), bytes);
});

test('dry run over a missing global defaults file creates nothing, using the would-write wording', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const defaultsPath = path.join(dir, 'defaults.json');

  const logs = captureLogs(() => writeGsdDefaultsGrant(defaultsPath, true));

  assert.strictEqual(fs.existsSync(defaultsPath), false);
  assert.ok(logs.some((l) => l.startsWith('would write: ')));
});

test('dry run against an existing global defaults file leaves it byte-identical, using the would-replace wording', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const defaultsPath = path.join(dir, 'defaults.json');
  const initial = { agent_tools: { '*': ['Bash'] } };
  const bytes = JSON.stringify(initial, null, 2) + '\n';
  fs.writeFileSync(defaultsPath, bytes);
  const before = fs.statSync(defaultsPath).mtimeMs;

  const logs = captureLogs(() => writeGsdDefaultsGrant(defaultsPath, true));

  assert.strictEqual(fs.readFileSync(defaultsPath, 'utf8'), bytes);
  assert.strictEqual(fs.statSync(defaultsPath).mtimeMs, before);
  assert.ok(logs.some((l) => l.startsWith('would replace: ')));
});

// --- entry point end-to-end ---

test('driven through the exported entry point against a temp config directory and a temp defaults path, one successful run leaves the grant in both places', async (t) => {
  const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-agent-grants-test-'));
  const gsdDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-agent-grants-test-gsd-'));
  const defaultsPath = path.join(gsdDir, 'defaults.json');
  t.after(() => {
    fs.rmSync(cfgDir, { recursive: true, force: true });
    fs.rmSync(gsdDir, { recursive: true, force: true });
  });

  // Pre-seed codebase-memory-mcp as already registered so no real `claude`
  // binary is spawned.
  fs.writeFileSync(
    path.join(cfgDir, '.claude.json'),
    JSON.stringify({ mcpServers: { 'codebase-memory-mcp': {} } })
  );
  // A gsd-core-shaped agent definition, so the grant step has something to grant.
  fs.mkdirSync(path.join(cfgDir, 'agents'), { recursive: true });
  fs.writeFileSync(
    path.join(cfgDir, 'agents', 'gsd-test-agent.md'),
    '---\nname: gsd-test-agent\ntools: Read, Write\n---\nBody.\n'
  );

  const origArgv = process.argv;
  const origFetch = globalThis.fetch;
  const origEnv = process.env.AI_DEV_GSD_DEFAULTS;
  const origConsoleLog = console.log;
  const origStderrWrite = process.stderr.write.bind(process.stderr);

  process.env.AI_DEV_GSD_DEFAULTS = defaultsPath;
  process.argv = ['node', 'cli.js', cfgDir];
  console.log = () => {};
  process.stderr.write = /** @type {any} */ (() => true);
  globalThis.fetch = /** @type {any} */ (async (/** @type {any} */ url) => {
    const isCompare = String(url).includes('/compare/');
    return {
      ok: true,
      status: 200,
      json: async () =>
        isCompare ? { status: 'ahead', ahead_by: 0, behind_by: 0 } : { default_branch: 'main' },
    };
  });

  try {
    await main();
  } finally {
    process.argv = origArgv;
    globalThis.fetch = origFetch;
    console.log = origConsoleLog;
    process.stderr.write = origStderrWrite;
    if (origEnv === undefined) delete process.env.AI_DEV_GSD_DEFAULTS;
    else process.env.AI_DEV_GSD_DEFAULTS = origEnv;
  }

  const agentContent = fs.readFileSync(path.join(cfgDir, 'agents', 'gsd-test-agent.md'), 'utf8');
  assert.ok(agentContent.includes(GRANT));
  assert.ok(fs.existsSync(defaultsPath));
  const defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));
  assert.ok(defaults.agent_tools['*'].includes(GRANT));
});
