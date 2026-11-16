'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseArgs } = require('node:util');
const catalog = require('./profiles.json');

const PACKAGE_ROOT = path.join(__dirname, '..');
const START = '<!-- ai-dev:preferences:start -->';
const END = '<!-- ai-dev:preferences:end -->';
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HASH = /^[a-f0-9]{64}$/;

/** @typedef {'claude' | 'codex'} Runtime */
/** @typedef {{ project: string, profile: 'general' | 'siriusxm', runtime: Runtime | 'both', skills: string[], dryRun: boolean }} InitOptions */
/** @typedef {{ version: number, profile: string, runtime: Runtime, skills: string[], files: Record<string, string>, instructionHash: string }} Manifest */
/** @typedef {{ rel: string, content: Buffer | null }} Change */

function initHelp() {
  return 'Usage: ai-dev init <existing-project> [options]\n' +
    '  --profile general|siriusxm   Default: general; siriusxm includes general\n' +
    '  --runtime claude|codex|both  Default: claude\n' +
    '  --skill <name>              Include an optional skill (repeatable)\n' +
    '  --dry-run                   Validate and print changes without writing\n' +
    '  --help                      Show this help\n' +
    'Optional skills:\n' + Object.entries(catalog.optional).map(([name, entry]) =>
      `  ${name} (${entry.profile}; ${entry.runtimes.join(', ')}): ${entry.reason}`
    ).join('\n');
}

/** @param {string[]} argv @returns {InitOptions | null} */
function parseInitArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      profile: { type: 'string', default: 'general' },
      runtime: { type: 'string', default: 'claude' },
      skill: { type: 'string', multiple: true, default: [] },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) return null;
  if (positionals.length !== 1) throw new Error(initHelp());
  if (values.profile !== 'general' && values.profile !== 'siriusxm') {
    throw new Error('Profile must be general or siriusxm.');
  }
  if (values.runtime !== 'claude' && values.runtime !== 'codex' && values.runtime !== 'both') {
    throw new Error('Runtime must be claude, codex, or both.');
  }
  return {
    project: positionals[0], profile: values.profile, runtime: values.runtime,
    skills: values.skill, dryRun: values['dry-run'],
  };
}

/** @param {string | Buffer} bytes */
function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/** @param {InitOptions} options @param {Runtime} runtime */
function selectSkills(options, runtime) {
  const defaults = [...catalog.general, ...(options.profile === 'siriusxm' ? catalog.siriusxm : [])];
  const optional = /** @type {Record<string, {profile: string, runtimes: string[]}>} */ (catalog.optional);
  for (const name of options.skills) {
    if (!SKILL_NAME.test(name) || !Object.hasOwn(optional, name)) {
      throw new Error(`Unknown optional skill: ${name}. See ai-dev init --help.`);
    }
    if (optional[name].profile === 'siriusxm' && options.profile !== 'siriusxm') {
      throw new Error(`${name} requires --profile siriusxm.`);
    }
    if (!optional[name].runtimes.includes(runtime)) {
      throw new Error(`${name} does not support ${runtime}.`);
    }
  }
  return [...new Set([...defaults, ...options.skills])]
    .filter(name => runtime === 'claude' || !catalog.claudeOnly.includes(name)).sort();
}

/** Reject symlinks at every destination component, including paths to be removed.
 * @param {string} root @param {string} rel
 */
function checkedPath(root, rel) {
  if (path.isAbsolute(rel) || rel.includes('\\') || rel.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error(`Unsafe project path: ${rel}`);
  }
  let current = root;
  const parts = rel.split('/');
  for (const [i, part] of parts.entries()) {
    current = path.join(current, part);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${current}`);
      if (i < parts.length - 1 && !stat.isDirectory()) throw new Error(`Expected directory: ${current}`);
      if (i === parts.length - 1 && !stat.isFile()) throw new Error(`Expected file: ${current}`);
    } catch (err) {
      if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'ENOENT') throw err;
    }
  }
  return current;
}

/** @param {string} root @param {string} rel @returns {Buffer | null} */
function readProjectFile(root, rel) {
  const file = checkedPath(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

/** @param {string} root @param {Runtime} runtime @returns {Manifest | null} */
function readManifest(root, runtime) {
  const rel = `.ai-dev/${runtime}.json`;
  const bytes = readProjectFile(root, rel);
  if (!bytes) return null;
  const data = JSON.parse(bytes.toString('utf8'));
  const prefix = runtime === 'claude' ? '.claude' : '.agents';
  const known = new Set([...catalog.general, ...catalog.siriusxm, ...Object.keys(catalog.optional)]);
  if (!data || data.version !== 1 || data.runtime !== runtime ||
      !['general', 'siriusxm'].includes(data.profile) || !Array.isArray(data.skills) ||
      !data.skills.every((/** @type {unknown} */ name) => typeof name === 'string' && known.has(name)) ||
      !data.files || typeof data.files !== 'object' || Array.isArray(data.files) ||
      typeof data.instructionHash !== 'string' || !HASH.test(data.instructionHash)) {
    throw new Error(`Invalid ownership manifest: ${rel}`);
  }
  for (const [file, hash] of Object.entries(data.files)) {
    const parts = file.split('/');
    const isSkill = parts[0] === prefix && parts[1] === 'skills' && data.skills.includes(parts[2]) && parts.length >= 4;
    const isAgent = runtime === 'claude' && /^\.claude\/agents\/adhoc-(executor|investigator)\.md$/.test(file);
    if ((!isSkill && !isAgent) || typeof hash !== 'string' || !HASH.test(hash)) {
      throw new Error(`Invalid owned path in ${rel}: ${file}`);
    }
    checkedPath(root, file);
  }
  return data;
}

/** @param {string} dir @returns {string[]} */
function sourceFiles(dir) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true }).flatMap(entry => {
    const file = path.join(entry.parentPath, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic link in skill source: ${file}`);
    return entry.isFile() ? [file] : [];
  }).sort();
}

/** @param {InitOptions} options @param {Runtime} runtime */
function preferences(options, runtime) {
  let text = fs.readFileSync(path.join(PACKAGE_ROOT, 'rules/general.md'), 'utf8').trimEnd();
  if (options.profile === 'siriusxm') {
    text += '\n\n' + fs.readFileSync(path.join(PACKAGE_ROOT, 'rules/siriusxm.md'), 'utf8').trimEnd();
  }
  text += `\n\n## ai-dev project setup\n\nProfile: ${options.profile}. Runtime: ${runtime}.\n`;
  if (runtime === 'codex') {
    text += '\nRead, Write, Edit, Bash, Grep, and Glob in skill prose describe operations; use the actual tools available in this Codex session. For AskUserQuestion, ask a plain-text question and wait when no question tool exists. For Agent or Task, delegate only when authorized and supported; otherwise perform the work inline. Never fabricate Claude tool names or agent definitions.\n' +
      '\nClaude-specific frontmatter and shell snippets prefixed with ! are not automatic Codex features. Read the actual invocation arguments and run any needed inspection commands explicitly, subject to project rules. Use codebase-memory-mcp CLI access for the code graph. The Claude-only adhoc-platform-task and its native agents are not installed for Codex.\n';
  } else {
    text += '\nThe adhoc-platform-task workflow uses the project agents under .claude/agents and requires codebase-memory-mcp. Install external prerequisites separately before invoking dependent skills.\n';
  }
  return `${START}\n${text.trimEnd()}\n${END}`;
}

/** @param {string} current @param {string} block @param {Manifest | null} previous */
function mergePreferences(current, block, previous) {
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if ((start === -1) !== (end === -1) || (start !== -1 &&
      (end < start || current.indexOf(START, start + START.length) !== -1 || current.indexOf(END, end + END.length) !== -1))) {
    throw new Error('Malformed ai-dev preferences markers. Repair the instruction file before setup.');
  }
  if (start === -1) {
    if (previous && current) throw new Error('The managed preferences block was removed. Restore it before updating.');
    const separator = current ? (current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n') : '';
    return current + separator + block + '\n';
  }
  const oldBlock = current.slice(start, end + END.length);
  if (oldBlock !== block && (!previous || sha256(oldBlock) !== previous.instructionHash)) {
    throw new Error('Local edits conflict with the managed preferences block. Move edits outside the block before updating.');
  }
  return current.slice(0, start) + block + current.slice(end + END.length);
}

/** Validate the entire plan before making any writes.
 * @param {InitOptions} options @returns {{ root: string, changes: Change[] }}
 */
function planProject(options) {
  if (!['general', 'siriusxm'].includes(options.profile) || !['claude', 'codex', 'both'].includes(options.runtime)) {
    throw new Error('Invalid profile or runtime.');
  }
  const root = fs.realpathSync(path.resolve(options.project));
  if (!fs.statSync(root).isDirectory()) throw new Error(`Expected project directory: ${root}`);
  /** @type {Change[]} */
  const changes = [];
  const runtimes = options.runtime === 'both' ? /** @type {Runtime[]} */ (['claude', 'codex']) : [options.runtime];
  for (const runtime of runtimes) {
    const skills = selectSkills(options, runtime);
    const previous = readManifest(root, runtime);
    const prefix = runtime === 'claude' ? '.claude' : '.agents';
    /** @type {Map<string, Buffer>} */
    const desired = new Map();
    for (const skill of skills) {
      const dir = path.join(PACKAGE_ROOT, 'claude/skills', skill);
      if (!fs.existsSync(path.join(dir, 'SKILL.md'))) throw new Error(`Missing skill source: ${skill}`);
      for (const file of sourceFiles(dir)) {
        const relative = path.relative(dir, file).split(path.sep).join('/');
        let content = fs.readFileSync(file);
        if (content.includes('@@CLAUDE_CONFIG_DIR@@')) {
          content = Buffer.from(content.toString('utf8').replaceAll('@@CLAUDE_CONFIG_DIR@@', prefix));
        }
        desired.set(`${prefix}/skills/${skill}/${relative}`, content);
      }
    }
    if (runtime === 'claude') {
      for (const name of ['adhoc-executor', 'adhoc-investigator']) {
        const text = fs.readFileSync(path.join(PACKAGE_ROOT, 'claude/agents', `${name}.md`), 'utf8');
        desired.set(`.claude/agents/${name}.md`, Buffer.from(text.replaceAll('@@CLAUDE_CONFIG_DIR@@', prefix)));
      }
    }
    const oldFiles = previous ? previous.files : {};
    const paths = new Set([...desired.keys(), ...Object.keys(oldFiles)]);
    for (const rel of [...paths].sort()) {
      const current = readProjectFile(root, rel);
      const next = desired.get(rel) || null;
      if (current && next && current.equals(next)) continue;
      if (current && (!Object.hasOwn(oldFiles, rel) || sha256(current) !== oldFiles[rel])) {
        throw new Error(`Local file conflicts with setup: ${rel}. Preserve or move it before updating.`);
      }
      if (current || next) changes.push({ rel, content: next });
    }
    const block = preferences(options, runtime);
    const instruction = runtime === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
    const currentRules = readProjectFile(root, instruction);
    const merged = Buffer.from(mergePreferences(currentRules ? currentRules.toString('utf8') : '', block, previous));
    if (!currentRules || !currentRules.equals(merged)) changes.push({ rel: instruction, content: merged });
    const manifest = {
      version: 1, profile: options.profile, runtime, skills,
      files: Object.fromEntries([...desired].sort(([a], [b]) => a.localeCompare(b)).map(([rel, bytes]) => [rel, sha256(bytes)])),
      instructionHash: sha256(block),
    };
    const manifestRel = `.ai-dev/${runtime}.json`;
    const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
    const currentManifest = readProjectFile(root, manifestRel);
    if (!currentManifest || !currentManifest.equals(bytes)) changes.push({ rel: manifestRel, content: bytes });
  }
  return { root, changes };
}

/** @param {InitOptions} options */
function setupProject(options) {
  const plan = planProject(options);
  for (const change of plan.changes) {
    const file = checkedPath(plan.root, change.rel);
    console.log(`${options.dryRun ? 'would ' : ''}${change.content === null ? 'remove' : 'write'}: ${change.rel}`);
    if (options.dryRun) continue;
    if (change.content === null) fs.unlinkSync(file);
    else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, change.content);
    }
  }
  console.log(`${options.dryRun ? 'Dry run' : 'Configured'}: ${plan.root} (${options.profile}, ${options.runtime}); ${plan.changes.length} file changes.`);
  return plan;
}

/** @param {string[]} argv */
function runInit(argv) {
  const options = parseInitArgs(argv);
  if (!options) console.log(initHelp());
  else setupProject(options);
}

module.exports = { parseInitArgs, selectSkills, planProject, setupProject, runInit, initHelp };
