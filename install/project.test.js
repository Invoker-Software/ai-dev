'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { parseInitArgs, selectSkills, planProject, setupProject } = require('./project.js');
const catalog = require('./profiles.json');

/** @param {import('node:test').TestContext} t */
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-project-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.mock.method(console, 'log', () => {});
  return root;
}

/** @param {string} project @param {Partial<import('./project.js').InitOptions>} overrides @returns {import('./project.js').InitOptions} */
function options(project, overrides = {}) {
  return { project, profile: 'general', runtime: 'claude', skills: [], dryRun: false, ...overrides };
}

/** @param {string} root @param {string} rel @param {string} text */
function write(root, rel, text) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/** @param {string} root */
function snapshot(root) {
  return Object.fromEntries(fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const file = path.join(entry.parentPath, entry.name);
      return [path.relative(root, file), fs.readFileSync(file).toString('base64')];
    }).sort(([a], [b]) => a.localeCompare(b)));
}

test('init parses explicit profiles/runtimes and repeatable optional skills, with safe defaults', () => {
  assert.deepEqual(parseInitArgs(['project']), options('project'));
  assert.deepEqual(parseInitArgs(['project', '--profile', 'siriusxm', '--runtime', 'both',
    '--skill', 'iswi-start-rancher-desktop', '--skill', 'spike-findings-x-quote', '--dry-run']),
  options('project', { profile: 'siriusxm', runtime: 'both',
    skills: ['iswi-start-rancher-desktop', 'spike-findings-x-quote'], dryRun: true }));
  assert.equal(parseInitArgs(['--help']), null);
  for (const argv of [[], ['one', 'two'], ['project', '--profile', 'other'],
    ['project', '--runtime', 'other'], ['project', '--unknown']]) {
    assert.throws(() => parseInitArgs(argv));
  }
});

test('the catalog classifies every bundled skill exactly once', () => {
  const names = [...catalog.general, ...catalog.siriusxm, ...Object.keys(catalog.optional)];
  const source = path.join(__dirname, '../claude/skills');
  const actual = fs.readdirSync(source).filter(name => fs.existsSync(path.join(source, name, 'SKILL.md')));
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual([...names].sort(), actual.sort());
  for (const name of ['aws-auth', 'fix-cdk-pr', 'oncall-report', 'setup-x-workspace']) {
    assert.ok(catalog.siriusxm.includes(name));
  }
  assert.ok(!catalog.general.some(name => name.startsWith('sxm-')));
});

test('general Claude setup includes portable skills, native agents, and rendered support paths', (t) => {
  const root = fixture(t);
  setupProject(options(root));
  assert.deepEqual(fs.readdirSync(path.join(root, '.claude/skills')).sort(), [...catalog.general].sort());
  assert.ok(fs.existsSync(path.join(root, '.claude/agents/adhoc-investigator.md')));
  const skill = fs.readFileSync(path.join(root, '.claude/skills/codebase-memory-setup/SKILL.md'), 'utf8');
  const agent = fs.readFileSync(path.join(root, '.claude/agents/adhoc-investigator.md'), 'utf8');
  assert.ok(skill.includes('.claude/skills/codebase-memory-setup/assets/resolution-rules.md'));
  assert.ok(agent.includes('.claude/skills/adhoc-platform-task/assets/adhoc_context_template.txt'));
  assert.ok(!skill.includes('@@CLAUDE_CONFIG_DIR@@'));
  assert.ok(!agent.includes('@@CLAUDE_CONFIG_DIR@@'));
  assert.ok(!fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8').includes('siriusxm'));
  assert.ok(!fs.existsSync(path.join(root, '.agents')));
  assert.ok(!fs.existsSync(path.join(root, '.mcp.json')));
});

test('Codex setup uses .agents skills and AGENTS.md, CLI graph access, and no Claude native agents', (t) => {
  const root = fixture(t);
  setupProject(options(root, { runtime: 'codex' }));
  assert.deepEqual(fs.readdirSync(path.join(root, '.agents/skills')).sort(),
    catalog.general.filter(name => !catalog.claudeOnly.includes(name)).sort());
  const rules = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.ok(rules.includes('Runtime: codex'));
  assert.ok(rules.includes('perform the work inline'));
  assert.ok(rules.includes('codebase-memory-mcp CLI access'));
  const skill = fs.readFileSync(path.join(root, '.agents/skills/codebase-memory-setup/SKILL.md'), 'utf8');
  assert.ok(skill.includes('.agents/skills/codebase-memory-setup/assets/resolution-rules.md'));
  assert.ok(!fs.existsSync(path.join(root, '.claude')));
  assert.ok(!fs.existsSync(path.join(root, '.codex')));
  assert.ok(!fs.existsSync(path.join(root, 'CLAUDE.md')));
});

test('SiriusXM is additive and machine/ticket workflows require explicit selection', (t) => {
  const root = fixture(t);
  setupProject(options(root, { profile: 'siriusxm', runtime: 'both' }));
  const expected = [...catalog.general, ...catalog.siriusxm].sort();
  assert.deepEqual(fs.readdirSync(path.join(root, '.claude/skills')).sort(), expected);
  assert.deepEqual(fs.readdirSync(path.join(root, '.agents/skills')).sort(),
    expected.filter(name => !catalog.claudeOnly.includes(name)));
  for (const name of Object.keys(catalog.optional)) {
    assert.ok(!fs.existsSync(path.join(root, '.claude/skills', name)));
  }
  assert.ok(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8').includes('# SiriusXM project conventions'));
  assert.ok(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8').includes('~/siriusxm/x-*'));
  setupProject(options(root, { profile: 'siriusxm', runtime: 'both', skills: ['spike-findings-x-quote'] }));
  assert.ok(fs.existsSync(path.join(root, '.agents/skills/spike-findings-x-quote/references/resolver-term-storage-shape.md')));
});

test('optional skills enforce profile, runtime, and exact names before writing either runtime', (t) => {
  const root = fixture(t);
  for (const extra of [
    { skills: ['spike-findings-x-quote'] }, { skills: ['../outside'] },
    { skills: ['not-a-skill'] }, { skills: ['aws-auth'] },
    { skills: ['gsd-codebase-reindex'], runtime: /** @type {const} */ ('both') },
  ]) {
    assert.throws(() => setupProject(options(root, extra)));
    assert.deepEqual(fs.readdirSync(root), []);
  }
  assert.ok(selectSkills(options(root, { skills: ['gsd-codebase-reindex'] }), 'claude').includes('gsd-codebase-reindex'));
});

test('existing instruction text is preserved on both sides of an updated managed block', (t) => {
  const root = fixture(t);
  const original = '# Project rules\r\n\r\nKeep these bytes.\r\n';
  write(root, 'AGENTS.md', original);
  setupProject(options(root, { runtime: 'codex' }));
  const file = path.join(root, 'AGENTS.md');
  fs.appendFileSync(file, '\n# Local suffix\nRetain this too.\n');
  setupProject(options(root, { runtime: 'codex', profile: 'siriusxm' }));
  const updated = fs.readFileSync(file, 'utf8');
  assert.ok(updated.startsWith(original));
  assert.ok(updated.endsWith('\n# Local suffix\nRetain this too.\n'));
  assert.equal(updated.split('<!-- ai-dev:preferences:start -->').length, 2);
});

test('an identical repeated setup makes zero writes, including manifests and instruction files', (t) => {
  const root = fixture(t);
  const config = options(root, { runtime: 'both', profile: 'siriusxm' });
  setupProject(config);
  const before = snapshot(root);
  const mtimes = Object.fromEntries(Object.keys(before).map(rel => [rel, fs.statSync(path.join(root, rel)).mtimeMs]));
  assert.equal(setupProject(config).changes.length, 0);
  assert.deepEqual(snapshot(root), before);
  for (const [rel, mtime] of Object.entries(mtimes)) assert.equal(fs.statSync(path.join(root, rel)).mtimeMs, mtime);
});

test('downgrading a profile removes only owned unchanged files and preserves other runtime selections', (t) => {
  const root = fixture(t);
  setupProject(options(root, { runtime: 'both', profile: 'siriusxm', skills: ['spike-findings-x-quote'] }));
  write(root, '.claude/skills/aws-auth/local-notes.txt', 'retain');
  setupProject(options(root));
  assert.ok(!fs.existsSync(path.join(root, '.claude/skills/aws-auth/SKILL.md')));
  assert.equal(fs.readFileSync(path.join(root, '.claude/skills/aws-auth/local-notes.txt'), 'utf8'), 'retain');
  assert.ok(!fs.existsSync(path.join(root, '.claude/skills/spike-findings-x-quote/SKILL.md')));
  assert.ok(fs.existsSync(path.join(root, '.agents/skills/aws-auth/SKILL.md')));
  assert.ok(!fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8').includes('# SiriusXM project conventions'));
  assert.ok(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8').includes('# SiriusXM project conventions'));
});

test('profile switching rejects local edits to files that would be removed, before any writes', (t) => {
  const root = fixture(t);
  setupProject(options(root, { profile: 'siriusxm' }));
  write(root, '.claude/skills/aws-auth/SKILL.md', 'local edit');
  const before = snapshot(root);
  assert.throws(() => setupProject(options(root)), /Local file conflicts/);
  assert.deepEqual(snapshot(root), before);
});

test('an owned file modified locally is preserved on update', (t) => {
  const root = fixture(t);
  setupProject(options(root));
  write(root, '.claude/skills/pr-description/SKILL.md', 'local edit');
  const before = snapshot(root);
  assert.throws(() => setupProject(options(root, { profile: 'siriusxm' })), /Local file conflicts/);
  assert.deepEqual(snapshot(root), before);
});

test('upgrades replace prior owned content, remove obsolete support files, and update preferences', (t) => {
  const root = fixture(t);
  setupProject(options(root));
  const manifestFile = path.join(root, '.ai-dev/claude.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const skillFile = '.claude/skills/pr-description/SKILL.md';
  const staleFile = '.claude/skills/pr-description/obsolete.txt';
  const rulesFile = path.join(root, 'CLAUDE.md');
  const installedRules = fs.readFileSync(rulesFile, 'utf8');
  const oldRules = installedRules.replace('# Working preferences', '# Prior release preferences');
  const oldBlock = oldRules.slice(oldRules.indexOf('<!-- ai-dev:preferences:start -->'),
    oldRules.indexOf('<!-- ai-dev:preferences:end -->') + '<!-- ai-dev:preferences:end -->'.length);
  const priorContent = 'Previous package version';
  write(root, skillFile, priorContent);
  write(root, staleFile, priorContent);
  manifest.files[skillFile] = crypto.createHash('sha256').update(priorContent).digest('hex');
  manifest.files[staleFile] = manifest.files[skillFile];
  manifest.instructionHash = crypto.createHash('sha256').update(oldBlock).digest('hex');
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  fs.writeFileSync(rulesFile, oldRules);
  setupProject(options(root));
  assert.equal(fs.readFileSync(path.join(root, skillFile), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../claude/skills/pr-description/SKILL.md'), 'utf8'));
  assert.ok(!fs.existsSync(path.join(root, staleFile)));
  assert.equal(fs.readFileSync(rulesFile, 'utf8'), installedRules);
  assert.equal(setupProject(options(root)).changes.length, 0);
});

test('identical unowned files can be adopted without replacement', (t) => {
  const root = fixture(t);
  const rel = '.agents/skills/pr-description/SKILL.md';
  write(root, rel, fs.readFileSync(path.join(__dirname, '../claude/skills/pr-description/SKILL.md'), 'utf8'));
  const mtime = fs.statSync(path.join(root, rel)).mtimeMs;
  const plan = setupProject(options(root, { runtime: 'codex' }));
  assert.ok(!plan.changes.some(change => change.rel === rel));
  assert.equal(fs.statSync(path.join(root, rel)).mtimeMs, mtime);
  assert.ok(JSON.parse(fs.readFileSync(path.join(root, '.ai-dev/codex.json'), 'utf8')).files[rel]);
});

test('a Codex conflict prevents all writes when both runtimes are selected', (t) => {
  const root = fixture(t);
  write(root, '.agents/skills/pr-description/SKILL.md', 'unowned');
  const before = snapshot(root);
  assert.throws(() => setupProject(options(root, { runtime: 'both' })), /Local file conflicts/);
  assert.deepEqual(snapshot(root), before);
  assert.ok(!fs.existsSync(path.join(root, '.claude')));
});

test('local edits inside preferences blocks stop updates, and malformed markers stop first setup', (t) => {
  const root = fixture(t);
  setupProject(options(root));
  const file = path.join(root, 'CLAUDE.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('# Working preferences', '# Edited preferences'));
  const before = snapshot(root);
  assert.throws(() => setupProject(options(root, { profile: 'siriusxm' })), /Local edits conflict/);
  assert.deepEqual(snapshot(root), before);
  const other = fixture(t);
  write(other, 'AGENTS.md', 'Existing rules\n<!-- ai-dev:preferences:start -->');
  assert.throws(() => setupProject(options(other, { runtime: 'codex' })), /Malformed/);
  assert.deepEqual(Object.keys(snapshot(other)), ['AGENTS.md']);
});

test('dry run validates and reports writes and removals without changing any bytes', (t) => {
  const root = fixture(t);
  assert.ok(setupProject(options(root, { runtime: 'both', dryRun: true })).changes.length > 0);
  assert.deepEqual(fs.readdirSync(root), []);
  setupProject(options(root, { profile: 'siriusxm' }));
  const before = snapshot(root);
  const plan = setupProject(options(root, { dryRun: true }));
  assert.ok(plan.changes.some(change => change.content === null));
  assert.deepEqual(snapshot(root), before);
});

test('symlinked destination directories and instruction files cannot redirect project writes', (t) => {
  const outside = fixture(t);
  for (const rel of ['.claude', '.ai-dev', 'CLAUDE.md']) {
    const root = fixture(t);
    const target = rel === 'CLAUDE.md' ? path.join(outside, 'rules.md') : outside;
    if (rel === 'CLAUDE.md') fs.writeFileSync(target, 'outside');
    fs.symlinkSync(target, path.join(root, rel));
    const before = snapshot(outside);
    assert.throws(() => setupProject(options(root)), /Refusing symbolic link/);
    assert.deepEqual(snapshot(outside), before);
    assert.deepEqual(fs.readdirSync(root), [rel]);
  }
});

test('a replaced owned file symlink cannot be followed during a profile downgrade', (t) => {
  const root = fixture(t);
  const outside = fixture(t);
  setupProject(options(root, { profile: 'siriusxm' }));
  const file = path.join(root, '.claude/skills/aws-auth/SKILL.md');
  fs.unlinkSync(file);
  write(outside, 'keep.md', 'keep');
  fs.symlinkSync(path.join(outside, 'keep.md'), file);
  assert.throws(() => planProject(options(root)), /Refusing symbolic link/);
  assert.equal(fs.readFileSync(path.join(outside, 'keep.md'), 'utf8'), 'keep');
});

test('invalid ownership manifests cannot delete project files', (t) => {
  const root = fixture(t);
  setupProject(options(root));
  const file = path.join(root, '.ai-dev/claude.json');
  const original = fs.readFileSync(file, 'utf8');
  const invalid = JSON.parse(original);
  invalid.files['../../outside'] = '0'.repeat(64);
  fs.writeFileSync(file, JSON.stringify(invalid));
  const before = snapshot(root);
  assert.throws(() => planProject(options(root)), /Invalid owned path/);
  assert.deepEqual(snapshot(root), before);
  fs.writeFileSync(file, '{ invalid json');
  assert.throws(() => planProject(options(root)), /JSON/);
});

test('the CLI initializes a project without Claude, codegraph, network checks, or global writes', (t) => {
  const root = fixture(t);
  const home = fixture(t);
  const cli = path.join(__dirname, 'cli.js');
  const result = spawnSync(process.execPath, [cli, 'init', root, '--profile', 'siriusxm', '--runtime', 'both'], {
    env: { ...process.env, HOME: home, PATH: '', AI_DEV_GSD_DEFAULTS: path.join(home, 'must-not-write.json') },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(root, 'CLAUDE.md')));
  assert.deepEqual(fs.readdirSync(home), []);
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /ai-dev init/);
  const invalid = spawnSync(process.execPath, [cli, 'init', root, '--profile', 'typo'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Profile must be/);
});
