'use strict';

// This suite asserts on the SHIPPED `claude/` content — agent and skill
// prose — not on installer behaviour (`cli.js`'s own logic is covered by
// the other suites in this directory). It lives under `install/` only
// because that is where `package.json`'s test glob
// (`node --test --test-reporter=tap install/*.test.js`) looks; changing the
// glob or the test script to accommodate a differently-located suite would
// cost more than this comment.
//
// It is the phase-wide regression gate proving no shipped artifact names
// the retired `vexp` MCP server or claims a tool `codebase-memory-mcp` does
// not expose (ROADMAP Phase 6 Success Criterion 1), and that the query
// skill documents both of its access surfaces (Success Criterion 4).
//
// No network, no subprocess — every assertion reads a handful of small
// files already on disk.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CLAUDE_ROOT = path.join(__dirname, '..', 'claude');

/**
 * Walk `claudeRoot` the same way the installer does: top-level `agents/*.md`
 * plus every file beneath a `skills/*` directory that contains a
 * `SKILL.md`. No hardcoded file list — a skill added later is covered
 * automatically.
 * @param {string} claudeRoot
 * @returns {string[]} absolute paths, sorted
 */
function discoverContentFiles(claudeRoot) {
  /** @type {string[]} */
  const files = [];

  const agentsDir = path.join(claudeRoot, 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(path.join(agentsDir, entry.name));
      }
    }
  }

  const skillsDir = path.join(claudeRoot, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(skillsDir, entry.name);
      const skillMd = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(skillMd) || !fs.statSync(skillMd).isFile()) continue;
      const skillEntries = fs.readdirSync(skillDir, {
        recursive: true,
        withFileTypes: true,
      });
      for (const dirent of skillEntries) {
        if (!dirent.isFile()) continue;
        files.push(path.join(dirent.parentPath, dirent.name));
      }
    }
  }

  files.sort();
  return files;
}

const discovered = discoverContentFiles(CLAUDE_ROOT);

/** @param {string} abs */
function readText(abs) {
  return fs.readFileSync(abs, 'utf8');
}

/** @param {string} abs */
function relOf(abs) {
  return path.relative(CLAUDE_ROOT, abs).split(path.sep).join('/');
}

/**
 * Locate a single discovered file by its `claude/`-relative path. Throws
 * (failing the whole run loudly) rather than silently skipping a check when
 * the shipped tree does not have the file a test needs.
 * @param {string} rel
 */
function mustFind(rel) {
  const abs = discovered.find((f) => relOf(f) === rel);
  assert.ok(abs, `expected ${rel} among discovered artifacts`);
  return abs;
}

/**
 * Extract the YAML frontmatter block (between the opening and closing
 * `---` delimiters) from a markdown file's content.
 * @param {string} content
 */
function frontmatterOf(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : '';
}

test('sanity: at least one artifact was discovered under claude/', () => {
  assert.ok(discovered.length > 0, 'discoverContentFiles found nothing under ' + CLAUDE_ROOT);
});

// Assertion 1 — nothing names the retired server. Patterns are built from
// concatenated fragments so this file's own source text cannot satisfy the
// search it performs.
test('no discovered file names the retired server', () => {
  const retiredName = ['v', 'e', 'x', 'p'].join('');
  const mcpPrefixPattern = new RegExp('mcp' + '__' + retiredName + '__');
  const bareWordPattern = new RegExp('\\b' + retiredName + '\\b', 'i');

  for (const file of discovered) {
    const content = readText(file);
    assert.ok(
      !mcpPrefixPattern.test(content),
      `${relOf(file)} contains the retired server's MCP tool prefix`
    );
    assert.ok(
      !bareWordPattern.test(content),
      `${relOf(file)} contains the retired server's bare name`
    );
  }
});

// Assertion 2 — no file claims a tool this server does not expose. Needles
// built from concatenated fragments for the same reason as above.
test('no discovered file claims a retired tool this server does not expose', () => {
  const retiredTools = [
    ['run', 'pipeline'].join('_'),
    ['get', 'skeleton'].join('_'),
    ['expand', ['v', 'e', 'x', 'p'].join(''), 'ref'].join('_'),
    ['verify', 'done'].join('_'),
  ];

  for (const file of discovered) {
    const content = readText(file);
    for (const tool of retiredTools) {
      assert.ok(!content.includes(tool), `${relOf(file)} claims retired tool ${tool}`);
    }
  }
});

// Assertion 3 — both agents carry the wildcard allowlist on their `tools:`
// frontmatter line.
function assertWildcardAllowlist(rel) {
  const abs = mustFind(rel);
  const frontmatter = frontmatterOf(readText(abs));
  const toolsLine = frontmatter.split('\n').find((line) => line.startsWith('tools:'));
  assert.ok(toolsLine, `${rel} frontmatter has no tools: line`);
  assert.ok(
    toolsLine.includes('mcp__codebase-memory-mcp__*'),
    `${rel} tools: line missing the wildcard: ${toolsLine}`
  );
}

test('both adhoc agents carry the mcp__codebase-memory-mcp__* wildcard allowlist', () => {
  const investigatorRel = 'agents/adhoc-investigator.md';
  const executorRel = 'agents/adhoc-executor.md';
  assertWildcardAllowlist(investigatorRel);
  assertWildcardAllowlist(executorRel);
});

// Assertion 4 — the read-only agent's second disclosure names all four
// mutating tools and states there is no compensating control.
test("the investigator discloses the wildcard's four mutating tools with no compensating control", () => {
  const content = readText(mustFind('agents/adhoc-investigator.md'));
  const blockMatch = content.match(
    /<read_only_contradiction>([\s\S]*?)<\/read_only_contradiction>/
  );
  assert.ok(blockMatch, 'adhoc-investigator.md has no <read_only_contradiction> block');
  const block = blockMatch[1];

  for (const tool of ['delete_project', 'index_repository', 'manage_adr', 'ingest_traces']) {
    assert.ok(block.includes(tool), `<read_only_contradiction> missing mutating tool ${tool}`);
  }
  assert.ok(
    /no compensating control/i.test(block),
    '<read_only_contradiction> does not state there is no compensating control'
  );
});

// Assertion 5 — the executor's gap is disclosed at the definition: it names
// detect_changes and states both broken imports and unparsable files are
// uncovered.
test('the executor discloses what detect_changes does not cover', () => {
  const content = readText(mustFind('agents/adhoc-executor.md'));
  assert.ok(content.includes('detect_changes'), 'adhoc-executor.md does not mention detect_changes');
  assert.ok(content.includes('broken imports'), 'adhoc-executor.md does not disclose broken imports as uncovered');
  assert.ok(
    /no\s+longer\s+parse/.test(content),
    'adhoc-executor.md does not disclose unparsable files as uncovered'
  );
});

// Assertion 6 — the query skill documents both access surfaces and the
// grep carve-outs.
test('the codebase-memory skill documents both access surfaces and the grep carve-outs', () => {
  const content = readText(mustFind('skills/codebase-memory/SKILL.md'));

  assert.ok(content.includes('mcp__codebase-memory-mcp__'), 'missing the MCP tool prefix form');
  assert.ok(content.includes('codebase-memory-mcp cli'), 'missing the CLI invocation form');

  const carveOuts = [
    'string literals',
    'configuration values',
    'comments',
    'non-code files',
    'index does not cover',
  ];
  for (const phrase of carveOuts) {
    assert.ok(content.includes(phrase), `missing grep carve-out phrase: "${phrase}"`);
  }
});

// Assertion 7 — no skill or agent hardcodes a project name. The query skill
// and the investigator resolve it live via list_projects; the executor
// never re-resolves at all (it reads the Investigator's already-resolved
// "Indexed project:" line), which is the mechanism that keeps it from
// hardcoding a name too.
test("no discovered file hardcodes the reference repository's name, and nothing hardcodes a project name", () => {
  const referenceRepoName = 'shabontama';
  for (const file of discovered) {
    const content = readText(file);
    assert.ok(!content.includes(referenceRepoName), `${relOf(file)} hardcodes the reference repository's name`);
  }

  const querySkill = readText(mustFind('skills/codebase-memory/SKILL.md'));
  assert.ok(querySkill.includes('list_projects'), 'codebase-memory/SKILL.md does not reference list_projects');

  const investigator = readText(mustFind('agents/adhoc-investigator.md'));
  assert.ok(investigator.includes('list_projects'), 'adhoc-investigator.md does not reference list_projects');

  const executor = readText(mustFind('agents/adhoc-executor.md'));
  assert.ok(
    executor.includes('Indexed project:'),
    'adhoc-executor.md does not read the resolved project name from the context slice'
  );
});

// Assertion 8 — both setup-half skills disclose what does not travel, each
// for its own half.
test('both setup-half skills disclose what does not travel', () => {
  const setup = readText(mustFind('skills/codebase-memory-setup/SKILL.md'));
  assert.ok(setup.includes('machine-local'), 'codebase-memory-setup/SKILL.md does not state the index is machine-local');
  assert.ok(
    setup.includes('gsd-codebase-reindex'),
    'codebase-memory-setup/SKILL.md does not name gsd-codebase-reindex'
  );
  assert.ok(setup.includes('stale'), 'codebase-memory-setup/SKILL.md does not state the staleness consequence');

  const reindex = readText(mustFind('skills/gsd-codebase-reindex/SKILL.md'));
  assert.ok(reindex.includes('consent record'), 'gsd-codebase-reindex/SKILL.md does not name the consent record');
  assert.ok(
    reindex.includes('.claude/settings.json'),
    'gsd-codebase-reindex/SKILL.md does not name the hook settings file'
  );
  assert.ok(reindex.includes('decision log'), 'gsd-codebase-reindex/SKILL.md does not name the decision log');
  assert.ok(reindex.includes('capability install'), 'gsd-codebase-reindex/SKILL.md does not contain a re-establish command');
  assert.ok(
    /not a GSD project/i.test(reindex),
    'gsd-codebase-reindex/SKILL.md does not carry a refusal branch for a non-GSD repository'
  );
});

// Assertion 9 — nothing recommends an unverified acquisition path.
test('nothing recommends an unverified acquisition path', () => {
  const npmInstallPattern = new RegExp(['npm', 'install'].join('\\s+'));
  const unrelatedRepoName = 'elarsaks';
  const vendorAutoInstallPattern = new RegExp(
    'codebase-memory-mcp' + '\\s+' + 'install' + '\\b(?!\\.)'
  );
  const verifiedUpstream = 'DeusData/codebase-memory-mcp';

  for (const file of discovered) {
    const content = readText(file);
    assert.ok(!npmInstallPattern.test(content), `${relOf(file)} recommends an npm install command`);
    assert.ok(
      !content.includes(unrelatedRepoName),
      `${relOf(file)} references the unrelated same-named upstream repository`
    );
    assert.ok(
      !vendorAutoInstallPattern.test(content),
      `${relOf(file)} references the vendor's bare auto-configuring install subcommand`
    );
    if (content.includes('install.sh')) {
      assert.ok(
        content.includes(verifiedUpstream),
        `${relOf(file)} names an acquisition path but not the verified upstream repository`
      );
    }
  }
});

// Assertion 10 — the capability template is still a template.
test('the shipped capability template still carries all three substitution tokens', () => {
  const content = readText(
    mustFind('skills/gsd-codebase-reindex/assets/capability/codegraph-command.cjs')
  );
  for (const token of ['@@CBM_PROJECT_NAME@@', '@@CBM_DENY_LIST@@', '@@CBM_BINARY@@']) {
    assert.ok(content.includes(token), `codegraph-command.cjs is missing unsubstituted token ${token}`);
  }
});

// Assertion 11 — the three resolution rules are single-sourced.
test('the deny-list resolution rule is single-sourced and cited, not restated', () => {
  const needle = 'not_indexed_dir';
  const carriers = discovered.filter((file) => readText(file).includes(needle));
  assert.deepStrictEqual(
    carriers.map(relOf),
    ['skills/codebase-memory-setup/assets/resolution-rules.md'],
    `expected exactly one file to carry "${needle}"`
  );

  const reindex = readText(mustFind('skills/gsd-codebase-reindex/SKILL.md'));
  assert.ok(
    reindex.includes('@@CLAUDE_CONFIG_DIR@@/skills/codebase-memory-setup/assets/resolution-rules.md'),
    'gsd-codebase-reindex/SKILL.md does not cite resolution-rules.md by its deployed path'
  );
});
