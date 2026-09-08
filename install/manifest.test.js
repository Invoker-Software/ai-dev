'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const { checkPrerequisites, resolveClaudeBin, deployTarget } = require('./cli.js');

/** @type {{ sha: string, ref: string, source: 'package-lock' | 'git' }} */
const DUMMY_SHA_INFO = { sha: '1'.repeat(40), ref: 'main', source: 'git' };
const DUMMY_REPO_SLUG = 'Invoker-Software/ai-dev';

function makeCfgDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-manifest-test-'));
}

/**
 * @param {string} dir
 * @returns {string}
 */
function manifestPath(dir) {
  return path.join(dir, 'ai-dev', 'manifest.json');
}

test('after a successful target deploy the manifest carries a 40-hex sha, an allowed sha_source, a parseable installed_at, the repo slug, and the sorted deployed artifacts (INST-11)', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const artifacts = checkPrerequisites([dir]);
  const claudeBin = resolveClaudeBin();

  // Installed only now: checkPrerequisites above legitimately spawns
  // `codebase-memory-mcp --version` (D-20's unconditional gate) against the
  // real binary.
  t.mock.method(childProcess, 'execFileSync', () => ({}));

  deployTarget(dir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);

  const manifest = JSON.parse(fs.readFileSync(manifestPath(dir), 'utf8'));

  assert.match(manifest.sha, /^[0-9a-f]{40}$/);
  assert.ok(['package-lock', 'git'].includes(manifest.sha_source));
  assert.strictEqual(Number.isNaN(Date.parse(manifest.installed_at)), false);
  assert.strictEqual(manifest.repo, DUMMY_REPO_SLUG);

  const expectedRels = [...artifacts.map((a) => a.rel)].sort();
  assert.deepStrictEqual(manifest.artifacts, expectedRels);
});

test('the manifest carries no per-file content hash field (D-12)', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const artifacts = checkPrerequisites([dir]);
  const claudeBin = resolveClaudeBin();

  // Installed only now: checkPrerequisites above legitimately spawns
  // `codebase-memory-mcp --version` (D-20's unconditional gate) against the
  // real binary.
  t.mock.method(childProcess, 'execFileSync', () => ({}));
  deployTarget(dir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);

  const manifest = JSON.parse(fs.readFileSync(manifestPath(dir), 'utf8'));
  const raw = JSON.stringify(manifest);

  assert.doesNotMatch(raw, /hash/i);
  assert.doesNotMatch(raw, /checksum/i);
});

// CHANGED (D-17 reordering): the original expectation here was "files
// deployed but no manifest" — true only under the OLD order (file deploy
// before MCP). Task 1 moved the MCP stage ahead of file deploy, so a target
// whose MCP registration throws now never reaches the file-deploy loop at
// all: the expectation inverts to "no files deployed, no manifest."
test('when MCP registration throws, no files are deployed and no manifest exists for it, since the MCP stage now runs before file deploy (D-13, D-17)', (t) => {
  const dir = makeCfgDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const artifacts = checkPrerequisites([dir]);
  const claudeBin = resolveClaudeBin();

  t.mock.method(childProcess, 'execFileSync', () => {
    throw new Error('simulated claude mcp add failure');
  });

  assert.throws(() => {
    deployTarget(dir, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);
  });

  for (const artifact of artifacts) {
    assert.strictEqual(
      fs.existsSync(path.join(dir, artifact.rel)),
      false,
      `${artifact.rel} should not have been deployed: the MCP stage runs first and failed (D-17)`
    );
  }
  assert.strictEqual(fs.existsSync(manifestPath(dir)), false);
});

test('across two targets, the first completes with a manifest while the second (whose registration throws) has none', (t) => {
  const first = makeCfgDir();
  const second = makeCfgDir();
  t.after(() => {
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  });

  const artifacts = checkPrerequisites([first]);
  const claudeBin = resolveClaudeBin();

  const execMock = t.mock.method(childProcess, 'execFileSync', () => ({}));
  deployTarget(first, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);
  assert.strictEqual(execMock.mock.callCount(), 1);

  execMock.mock.restore();
  t.mock.method(childProcess, 'execFileSync', () => {
    throw new Error('simulated claude mcp add failure on the second target');
  });

  assert.throws(() => {
    deployTarget(second, artifacts, claudeBin, DUMMY_SHA_INFO, DUMMY_REPO_SLUG, false);
  });

  assert.ok(fs.existsSync(manifestPath(first)), 'the first (completed) target must have a manifest');
  assert.strictEqual(
    fs.existsSync(manifestPath(second)),
    false,
    'the second (interrupted) target must have no manifest'
  );
});
