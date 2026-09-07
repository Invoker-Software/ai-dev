'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { discoverArtifacts } = require('./cli.js');

/**
 * Build a fixture source tree shaped like the real `claude/` directory:
 * - agents/ with two markdown files and one non-markdown file (must be skipped)
 * - skills/one/ with a SKILL.md and a nested assets/ file
 * - skills/three/ with no SKILL.md (must be skipped and reported)
 * @returns {string}
 */
function makeFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-discover-test-'));

  const agentsDir = path.join(root, 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(path.join(agentsDir, 'agent-one.md'), '# Agent One\n');
  fs.writeFileSync(path.join(agentsDir, 'agent-two.md'), '# Agent Two\n');
  fs.writeFileSync(path.join(agentsDir, 'notes.txt'), 'not a markdown file\n');

  const skillOneDir = path.join(root, 'skills', 'one');
  fs.mkdirSync(path.join(skillOneDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(skillOneDir, 'SKILL.md'), '# Skill One\n');
  fs.writeFileSync(path.join(skillOneDir, 'assets', 'template.txt'), 'skill one asset\n');

  const skillThreeDir = path.join(root, 'skills', 'three');
  fs.mkdirSync(skillThreeDir, { recursive: true });
  fs.writeFileSync(path.join(skillThreeDir, 'orphan.txt'), 'no SKILL.md here\n');

  return root;
}

test('discovers agents/*.md files at the top level', (t) => {
  const root = makeFixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const artifacts = discoverArtifacts(root);
  const rels = artifacts.map((a) => a.rel);

  assert.ok(rels.includes(path.join('agents', 'agent-one.md')));
  assert.ok(rels.includes(path.join('agents', 'agent-two.md')));
});

test('a non-markdown file directly in agents/ is not discovered', (t) => {
  const root = makeFixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const artifacts = discoverArtifacts(root);
  const rels = artifacts.map((a) => a.rel);

  assert.ok(!rels.includes(path.join('agents', 'notes.txt')));
});

test('a skill directory with no SKILL.md is skipped and absent from the result', (t) => {
  const root = makeFixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const artifacts = discoverArtifacts(root);
  const rels = artifacts.map((a) => a.rel);

  assert.ok(!rels.some((rel) => rel.startsWith(path.join('skills', 'three'))));
});

test('a skill directory with a SKILL.md is discovered wholesale, including nested assets', (t) => {
  const root = makeFixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const artifacts = discoverArtifacts(root);
  const rels = artifacts.map((a) => a.rel);

  assert.ok(rels.includes(path.join('skills', 'one', 'SKILL.md')));
  assert.ok(rels.includes(path.join('skills', 'one', 'assets', 'template.txt')));
});

test('adding a second skill directory with its own SKILL.md and nested asset is discovered with no installer-code change (INST-03)', (t) => {
  const root = makeFixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  // This is the actual INST-03 proof: the test itself creates a brand-new
  // skill directory at test-run time, not as a checked-in fixture, and
  // asserts discoverArtifacts (unmodified) picks it up.
  const skillTwoDir = path.join(root, 'skills', 'two');
  fs.mkdirSync(path.join(skillTwoDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(skillTwoDir, 'SKILL.md'), '# Skill Two\n');
  fs.writeFileSync(path.join(skillTwoDir, 'assets', 'other.txt'), 'skill two asset\n');

  const artifacts = discoverArtifacts(root);
  const rels = artifacts.map((a) => a.rel);

  assert.ok(rels.includes(path.join('skills', 'two', 'SKILL.md')));
  assert.ok(rels.includes(path.join('skills', 'two', 'assets', 'other.txt')));
});

test('returned relative paths are sorted', (t) => {
  const root = makeFixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const artifacts = discoverArtifacts(root);
  const rels = artifacts.map((a) => a.rel);
  const sorted = [...rels].sort();

  assert.deepStrictEqual(rels, sorted);
});
