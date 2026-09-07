#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { parseArgs } = require('node:util');
const childProcess = require('node:child_process');

const PLACEHOLDER = '@@CLAUDE_CONFIG_DIR@@';

/**
 * @typedef {{ abs: string, rel: string }} Artifact
 */

/**
 * @typedef {{ sha: string, ref: string, source: 'package-lock' | 'git' }} ShaInfo
 */

/**
 * @typedef {{ ahead_by: number, status: string, defaultBranch: string }} StalenessResult
 */

/**
 * @typedef {{ cfgDirAbs: string, counts: { written: number, replaced: number, unchanged: number }, mcpOutcome: 'registered' | 'already-registered' | 'would-register' }} DeployResult
 */

/**
 * Parse CLI arguments: positional config directories plus a reserved --dry-run flag.
 * @param {string[]} argv
 * @returns {{ values: { 'dry-run': boolean }, positionals: string[] }}
 */
function parseCliArgs(argv) {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean', default: false },
    },
  });
  return {
    values: { 'dry-run': Boolean(parsed.values['dry-run']) },
    positionals: parsed.positionals,
  };
}

/**
 * Scan PATH for the first executable file named `name`, without shelling out
 * and without honoring shell aliases/functions.
 * @param {string} name
 * @returns {string | null}
 */
function whichExecutable(name) {
  const pathEnv = process.env.PATH || '';
  const dirs = pathEnv.split(path.delimiter);
  for (const dir of dirs) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // not found here — keep scanning
    }
  }
  return null;
}

/**
 * Resolve an executable `claude` binary: explicit env override, then the
 * known user-local install path, then a PATH scan. Throws when none resolve.
 *
 * `ADHOC_CLAUDE_BIN` is the superseded name of the override variable. When it
 * is set and `AI_DEV_CLAUDE_BIN` is not, a deprecation warning is printed —
 * the old variable is never honored as an override, only warned about, so a
 * teammate's pinned binary is never silently replaced without a word.
 * @returns {string}
 */
function resolveClaudeBin() {
  /** @type {string[]} */
  const searched = [];

  if (!process.env.AI_DEV_CLAUDE_BIN && process.env.ADHOC_CLAUDE_BIN) {
    process.stderr.write(
      'Warning: ADHOC_CLAUDE_BIN is deprecated and no longer honored; set AI_DEV_CLAUDE_BIN instead.\n'
    );
  }

  const envBin = process.env.AI_DEV_CLAUDE_BIN;
  if (envBin) {
    searched.push(envBin);
    try {
      fs.accessSync(envBin, fs.constants.X_OK);
      return envBin;
    } catch {
      // explicit override set but not usable — fall through
    }
  }

  const localBin = path.join(os.homedir(), '.local', 'bin', 'claude');
  searched.push(localBin);
  try {
    fs.accessSync(localBin, fs.constants.X_OK);
    return localBin;
  } catch {
    // fall through
  }

  const pathBin = whichExecutable('claude');
  if (pathBin) return pathBin;
  searched.push('claude (via PATH)');

  throw new Error(
    `Could not resolve an executable claude binary (searched: ${searched.join(', ')})`
  );
}

/**
 * Validate every prerequisite for a run before any file is written:
 * Node version floor, `vexp` on PATH, a resolvable `claude` binary, every
 * named target existing as a directory, and at least one discoverable
 * artifact. Returns the discovered artifacts on success. This gate is
 * unconditional — `--dry-run` shares it exactly, with no branching.
 * @param {string[]} targets
 * @returns {Artifact[]}
 */
function checkPrerequisites(targets) {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 20) {
    throw new Error(`node >= 20 required, found ${process.version}`);
  }

  if (!whichExecutable('vexp')) {
    throw new Error("'vexp' is required on PATH");
  }

  resolveClaudeBin();

  for (const target of targets) {
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      throw new Error(`config directory not found: ${target}`);
    }
  }

  const srcRoot = path.join(__dirname, '..', 'claude');
  const artifacts = discoverArtifacts(srcRoot);
  if (artifacts.length === 0) {
    throw new Error(`No deployable artifacts discovered under ${srcRoot}`);
  }

  return artifacts;
}

/**
 * Walk `srcRoot` (the `claude/` source tree) and discover every deployable
 * artifact: top-level `agents/*.md` files, and every file beneath a
 * `skills/*` directory that contains a `SKILL.md`. A skill directory with no
 * `SKILL.md` is skipped and the skip is reported. Names no artifact by
 * identity — adding a new skill or agent requires no change here.
 * @param {string} srcRoot
 * @returns {Artifact[]}
 */
function discoverArtifacts(srcRoot) {
  /** @type {Artifact[]} */
  const artifacts = [];

  const agentsDir = path.join(srcRoot, 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const abs = path.join(agentsDir, entry.name);
        artifacts.push({ abs, rel: path.relative(srcRoot, abs) });
      }
    }
  }

  const skillsDir = path.join(srcRoot, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(skillsDir, entry.name);
      const skillMd = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(skillMd) || !fs.statSync(skillMd).isFile()) {
        console.log(`skipped (no SKILL.md): ${skillDir}`);
        continue;
      }
      const skillEntries = fs.readdirSync(skillDir, {
        recursive: true,
        withFileTypes: true,
      });
      for (const dirent of skillEntries) {
        if (!dirent.isFile()) continue;
        const abs = path.join(dirent.parentPath, dirent.name);
        artifacts.push({ abs, rel: path.relative(srcRoot, abs) });
      }
    }
  }

  artifacts.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return artifacts;
}

/**
 * Substitute every occurrence of the config-directory placeholder token with
 * `cfgDirAbs`. Buffers with no occurrence are returned untouched so
 * non-text assets stay byte-exact.
 * @param {Buffer} buffer
 * @param {string} cfgDirAbs
 * @returns {Buffer}
 */
function substitute(buffer, cfgDirAbs) {
  if (!buffer.includes(PLACEHOLDER)) return buffer;
  const text = buffer.toString('utf8');
  return Buffer.from(text.replaceAll(PLACEHOLDER, cfgDirAbs), 'utf8');
}

/**
 * Deploy a single file: substitute, then write only if the deployed bytes
 * differ from what already exists. Reports which of the three outcomes
 * occurred. Under `dryRun`, the identical discovery/substitution/comparison
 * runs, but no directory or file is created — only the console line differs
 * (`would write:`/`would replace:` instead of `writing:`/`replacing
 * (content differs):`), so a dry-run log is never mistakable for a real one.
 * @param {string} src
 * @param {string} dest
 * @param {string} cfgDirAbs
 * @param {boolean} [dryRun]
 * @returns {'unchanged' | 'written' | 'replaced'}
 */
function deployFile(src, dest, cfgDirAbs, dryRun) {
  const srcBuf = fs.readFileSync(src);
  const substituted = substitute(srcBuf, cfgDirAbs);

  if (fs.existsSync(dest)) {
    const destBuf = fs.readFileSync(dest);
    if (Buffer.compare(substituted, destBuf) === 0) {
      console.log(`unchanged: ${dest}`);
      return 'unchanged';
    }
    console.log(`${dryRun ? 'would replace' : 'replacing (content differs)'}: ${dest}`);
    if (!dryRun) {
      fs.writeFileSync(dest, substituted);
    }
    return 'replaced';
  }

  console.log(`${dryRun ? 'would write' : 'writing'}: ${dest}`);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, substituted);
  }
  return 'written';
}

/**
 * Deploy every discovered artifact into one target config directory, then
 * register vexp if needed, then write the manifest — in that order, so an
 * interrupted run never leaves a manifest claiming work that did not finish.
 * Each stage's error is tagged with `err.stage` (`'deploy' | 'mcp' |
 * 'manifest'`) so a caller looping over several targets can report exactly
 * where a mid-run failure stopped.
 * @param {string} cfgDir
 * @param {Artifact[]} artifacts
 * @param {string} claudeBin
 * @param {ShaInfo} shaInfo
 * @param {string} repoSlug
 * @param {boolean} [dryRun]
 * @returns {DeployResult}
 */
function deployTarget(cfgDir, artifacts, claudeBin, shaInfo, repoSlug, dryRun) {
  const cfgDirAbs = fs.realpathSync(path.resolve(cfgDir));
  console.log(`--- ${cfgDirAbs} ---`);

  const counts = { written: 0, replaced: 0, unchanged: 0 };
  /** @type {string[]} */
  const relPaths = [];

  try {
    for (const artifact of artifacts) {
      const dest = path.join(cfgDirAbs, artifact.rel);
      const outcome = deployFile(artifact.abs, dest, cfgDirAbs, dryRun);
      counts[outcome] += 1;
      relPaths.push(artifact.rel);
    }
  } catch (err) {
    throw tagStage(err, 'deploy');
  }

  let mcpOutcome;
  try {
    mcpOutcome = registerVexpIfNeeded(cfgDirAbs, claudeBin, dryRun);
  } catch (err) {
    throw tagStage(err, 'mcp');
  }

  try {
    writeManifest(cfgDirAbs, shaInfo, repoSlug, relPaths, dryRun);
  } catch (err) {
    throw tagStage(err, 'manifest');
  }

  return { cfgDirAbs, counts, mcpOutcome };
}

/**
 * Register the vexp MCP server in a target config directory unless it is
 * already present in `.claude.json`. Never hand-edits the JSON file. A
 * missing, empty, or unparsable `.claude.json` is treated as not-yet
 * registered. An empty-object `vexp` value counts as registered; a null
 * value does not. Under `dryRun`, states the decision without spawning the
 * `claude` subprocess.
 * @param {string} cfgDirAbs
 * @param {string} claudeBin
 * @param {boolean} [dryRun]
 * @returns {'registered' | 'already-registered' | 'would-register'}
 */
function registerVexpIfNeeded(cfgDirAbs, claudeBin, dryRun) {
  const claudeJsonPath = path.join(cfgDirAbs, '.claude.json');
  let alreadyRegistered = false;
  try {
    const parsed = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
    alreadyRegistered = Boolean(parsed.mcpServers && parsed.mcpServers.vexp);
  } catch {
    alreadyRegistered = false;
  }

  if (alreadyRegistered) {
    console.log(`already registered: vexp MCP server in ${cfgDirAbs}`);
    return 'already-registered';
  }

  if (dryRun) {
    console.log(`would register: vexp MCP server in ${cfgDirAbs}`);
    return 'would-register';
  }

  childProcess.execFileSync(
    claudeBin,
    ['mcp', 'add', '-s', 'user', 'vexp', '--', 'vexp', 'mcp'],
    {
      env: { ...process.env, CLAUDE_CONFIG_DIR: cfgDirAbs },
      stdio: 'ignore',
    }
  );
  console.log(`registered: vexp MCP server in ${cfgDirAbs}`);
  return 'registered';
}

/**
 * Determine the commit SHA this running install came from. Primary: the
 * npm-managed hidden lockfile at `node_modules/.package-lock.json`, read for
 * the own-package entry's `resolved` field. Fallback (only when that
 * lockfile is absent): `git rev-parse HEAD` against a local `.git`
 * directory. Throws when neither source is available.
 * @param {string} cliDirname
 * @returns {ShaInfo}
 */
function findOwnInstalledSha(cliDirname) {
  const pkgRoot = path.join(cliDirname, '..');
  const lockPath = path.join(pkgRoot, '..', '.package-lock.json');

  if (fs.existsSync(lockPath)) {
    const ownPkg = JSON.parse(
      fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')
    );
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const entry = lock.packages && lock.packages[`node_modules/${ownPkg.name}`];
    const resolved = entry && entry.resolved;
    if (resolved && typeof resolved === 'string' && resolved.includes('#')) {
      const parts = resolved.split('#');
      const sha = parts[parts.length - 1];
      if (sha && /^[0-9a-f]{40}$/.test(sha)) {
        return { sha, ref: resolved, source: 'package-lock' };
      }
    }
  }

  if (fs.existsSync(path.join(pkgRoot, '.git'))) {
    const sha = childProcess
      .execFileSync('git', ['-C', pkgRoot, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
      })
      .trim();
    return { sha, ref: 'local-clone', source: 'git' };
  }

  throw new Error(
    'Could not determine installed commit SHA: no node_modules/.package-lock.json and no .git directory found'
  );
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function errMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Tag a caught error with which stage of a target's deploy it occurred in,
 * then return it for re-throwing.
 * @param {unknown} err
 * @param {'deploy' | 'mcp' | 'manifest'} stage
 * @returns {Error & { stage?: string }}
 */
function tagStage(err, stage) {
  const tagged = /** @type {Error & { stage?: string }} */ (err);
  if (tagged && typeof tagged === 'object') tagged.stage = stage;
  return tagged;
}

/**
 * Resolve `owner/repo` from a package.json `repository.url` field.
 * @param {any} pkg
 * @returns {string}
 */
function repoSlugFromPackageJson(pkg) {
  const url = pkg && pkg.repository && pkg.repository.url;
  const match = typeof url === 'string' && url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match) {
    throw new Error(`Could not determine repo slug from package.json repository.url: ${url}`);
  }
  return match[1];
}

/**
 * Format a rate-limit error message, including the reset time from the
 * response headers when present.
 * @param {{ headers: { get: (name: string) => string | null } }} res
 * @returns {string}
 */
function formatRateLimitError(res) {
  const reset = res.headers && res.headers.get ? res.headers.get('x-ratelimit-reset') : null;
  const resetText = reset
    ? ` (resets at ${new Date(Number(reset) * 1000).toISOString()})`
    : '';
  return `GitHub API rate limit hit${resetText}`;
}

/**
 * Fetch how many commits the default branch is ahead of the installed SHA,
 * via the GitHub compare API. Reads `ahead_by` (never the superseded field
 * name) — with the installed SHA as the compare base, `ahead_by` is the count of upstream
 * commits missing from the install. Every way this can fail to answer is
 * reported as its own distinguishable condition — a 404 (installed commit
 * absent upstream, likely a rewritten history), a 403 (GitHub API rate
 * limit), a network failure (host unreachable), or any other non-OK status —
 * so that none of them can be silently read as a zero-commits-behind count.
 * @param {string} repoSlug
 * @param {string} installedSha
 * @returns {Promise<StalenessResult>}
 */
async function checkStaleness(repoSlug, installedSha) {
  let repoRes;
  try {
    repoRes = await fetch(`https://api.github.com/repos/${repoSlug}`);
  } catch (err) {
    throw new Error(`Could not reach api.github.com: ${errMessage(err)}`);
  }
  if (repoRes.status === 403) {
    throw new Error(formatRateLimitError(repoRes));
  }
  if (!repoRes.ok) {
    throw new Error(`GitHub repo lookup failed: HTTP ${repoRes.status}`);
  }
  const repoJson = await repoRes.json();
  const defaultBranch = repoJson.default_branch;

  let cmpRes;
  try {
    cmpRes = await fetch(
      `https://api.github.com/repos/${repoSlug}/compare/${installedSha}...${defaultBranch}`
    );
  } catch (err) {
    throw new Error(`Could not reach api.github.com: ${errMessage(err)}`);
  }
  if (cmpRes.status === 404) {
    throw new Error(
      `Installed commit ${installedSha} not found on GitHub (possibly rewritten history) — cannot determine staleness`
    );
  }
  if (cmpRes.status === 403) {
    throw new Error(formatRateLimitError(cmpRes));
  }
  if (!cmpRes.ok) {
    throw new Error(`GitHub compare failed: HTTP ${cmpRes.status}`);
  }
  const cmpJson = await cmpRes.json();

  return {
    ahead_by: cmpJson.ahead_by,
    status: cmpJson.status,
    defaultBranch,
  };
}

/**
 * Write the per-target install manifest. Written last, only after that
 * target's deploy and MCP registration have both succeeded. Rewritten with
 * a fresh timestamp on every successful run; exempt from the
 * diff-before-write rule. Under `dryRun`, writes nothing (not even the
 * containing directory).
 * @param {string} cfgDirAbs
 * @param {ShaInfo} shaInfo
 * @param {string} repoSlug
 * @param {string[]} relPaths
 * @param {boolean} [dryRun]
 * @returns {void}
 */
function writeManifest(cfgDirAbs, shaInfo, repoSlug, relPaths, dryRun) {
  if (dryRun) return;

  const manifestDir = path.join(cfgDirAbs, 'ai-dev');
  fs.mkdirSync(manifestDir, { recursive: true });

  const manifest = {
    schema: 1,
    repo: repoSlug,
    ref: shaInfo.ref,
    sha: shaInfo.sha,
    sha_source: shaInfo.source,
    installed_at: new Date().toISOString(),
    artifacts: [...relPaths].sort(),
  };

  fs.writeFileSync(
    path.join(manifestDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
}

/**
 * @typedef {{ written: number, replaced: number, unchanged: number, targets: number, registered: number, alreadyRegistered: number }} SummaryCounts
 */

/**
 * Format the closing summary line printed after every target has been
 * processed.
 * @param {SummaryCounts} counts
 * @returns {string}
 */
function formatSummary(counts) {
  /** @type {string} */
  let vexpPart;
  if (counts.registered > 0 && counts.alreadyRegistered > 0) {
    vexpPart = `vexp registered in ${counts.registered} target(s), already registered in ${counts.alreadyRegistered}`;
  } else if (counts.registered > 0) {
    vexpPart = `vexp registered in ${counts.registered} target(s)`;
  } else {
    vexpPart = `vexp already registered in ${counts.alreadyRegistered} target(s)`;
  }
  return `${counts.written} written, ${counts.replaced} replaced, ${counts.unchanged} unchanged across ${counts.targets} target(s), ${vexpPart}`;
}

/**
 * Print the D-05 staleness line at the head of every run.
 * @param {string} pkgName
 * @param {string} sha
 * @param {StalenessResult} staleness
 * @param {string} repoSlug
 * @returns {void}
 */
function printStalenessLine(pkgName, sha, staleness, repoSlug) {
  const shortSha = sha.slice(0, 7);
  const behindText =
    staleness.ahead_by === 0
      ? 'up to date'
      : `${staleness.ahead_by} commit${staleness.ahead_by === 1 ? '' : 's'} behind`;
  console.log(
    `${pkgName} @ ${shortSha} — ${behindText} ${repoSlug}#${staleness.defaultBranch} (status: ${staleness.status})`
  );
}

/**
 * Entry point.
 * @returns {Promise<void>}
 */
async function main() {
  const { values, positionals } = parseCliArgs(process.argv.slice(2));
  const dryRun = values['dry-run'];

  if (positionals.length === 0) {
    process.stderr.write(
      'Usage: npx github:Invoker-Software/ai-dev <config-dir> [<config-dir> ...]\n' +
        '  Deploys the ai-dev skills and agents into each named Claude Code config\n' +
        "  directory (the value CLAUDE_CONFIG_DIR would point at), and registers the\n" +
        "  vexp MCP server there via 'claude mcp add'.\n" +
        '  Example (two profiles): npx github:Invoker-Software/ai-dev <path/to/first-config-dir> <path/to/second-config-dir>\n' +
        "  This installer indexes nothing: run 'vexp index' once per repository you want indexed.\n" +
        '  --dry-run prints the full plan and writes nothing.\n'
    );
    process.exit(1);
  }

  const artifacts = checkPrerequisites(positionals);
  const claudeBin = resolveClaudeBin();

  const shaInfo = findOwnInstalledSha(__dirname);
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  );
  const repoSlug = repoSlugFromPackageJson(pkg);

  const staleness = await checkStaleness(repoSlug, shaInfo.sha);
  printStalenessLine(pkg.name, shaInfo.sha, staleness, repoSlug);

  const totals = { written: 0, replaced: 0, unchanged: 0 };
  let registered = 0;
  let alreadyRegistered = 0;
  /** @type {string[]} */
  const completed = [];

  for (const target of positionals) {
    const targetAbs = fs.realpathSync(path.resolve(target));
    let result;
    try {
      result = deployTarget(target, artifacts, claudeBin, shaInfo, repoSlug, dryRun);
    } catch (err) {
      const tagged = /** @type {Error & { stage?: string }} */ (err);
      process.stderr.write(`${errMessage(err)}\n`);
      process.stderr.write(`completed: ${completed.join(', ')}\n`);
      process.stderr.write(`stopped in: ${targetAbs} (${tagged && tagged.stage ? tagged.stage : 'unknown'})\n`);
      throw err;
    }
    completed.push(result.cfgDirAbs);
    totals.written += result.counts.written;
    totals.replaced += result.counts.replaced;
    totals.unchanged += result.counts.unchanged;
    if (result.mcpOutcome === 'registered' || result.mcpOutcome === 'would-register') {
      registered += 1;
    } else {
      alreadyRegistered += 1;
    }
  }

  console.log(
    formatSummary({
      ...totals,
      targets: positionals.length,
      registered,
      alreadyRegistered,
    })
  );
  console.log('Done.');
}

module.exports = {
  main,
  parseCliArgs,
  whichExecutable,
  resolveClaudeBin,
  checkPrerequisites,
  discoverArtifacts,
  substitute,
  deployFile,
  deployTarget,
  registerVexpIfNeeded,
  findOwnInstalledSha,
  checkStaleness,
  writeManifest,
  formatSummary,
};

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err && err.message ? err.message : err}\n`);
    process.exit(1);
  });
}
