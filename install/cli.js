#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { parseArgs } = require('node:util');
const childProcess = require('node:child_process');

const PLACEHOLDER = '@@CLAUDE_CONFIG_DIR@@';
const CODEBASE_MEMORY_VERSION_FLOOR = '0.10.8';

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
 * @typedef {{ removal: 'removed' | 'not-present' | 'would-remove' | 'removal-failed', registration: 'registered' | 'already-registered' | 'would-register' }} McpOutcome
 */

/**
 * @typedef {{ cfgDirAbs: string, counts: { written: number, replaced: number, unchanged: number }, mcpOutcome: McpOutcome }} DeployResult
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
 * Compare a `--version` stdout string against a `major.minor.patch` floor.
 * Matches the first `\d+\.\d+\.\d+` occurrence in `versionOutput`; returns
 * `false` when nothing matches. Equality with the floor passes.
 * @param {string} versionOutput
 * @param {string} floor
 * @returns {boolean}
 */
function meetsVersionFloor(versionOutput, floor) {
  const match = versionOutput.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return false;
  const [maj, min, patch] = match.slice(1).map(Number);
  const [fMaj, fMin, fPatch] = floor.split('.').map(Number);
  if (maj !== fMaj) return maj > fMaj;
  if (min !== fMin) return min > fMin;
  return patch >= fPatch;
}

/**
 * Validate every prerequisite for a run before any file is written:
 * Node version floor, `codebase-memory-mcp` on PATH at or above the pinned
 * version floor, a resolvable `claude` binary, every named target existing
 * as a directory, and at least one discoverable artifact. Returns the
 * discovered artifacts on success. This gate is unconditional — `--dry-run`
 * shares it exactly, with no branching.
 * @param {string[]} targets
 * @returns {Artifact[]}
 */
function checkPrerequisites(targets) {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 20) {
    throw new Error(`node >= 20 required, found ${process.version}`);
  }

  const codebaseMemoryBin = whichExecutable('codebase-memory-mcp');
  if (!codebaseMemoryBin) {
    throw new Error(
      "'codebase-memory-mcp' is required on PATH.\n" +
        'Upstream: github.com/DeusData/codebase-memory-mcp (MIT).\n' +
        'Install: curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash -s -- --skip-config\n' +
        '--skip-config is deliberate: the unflagged installer and the npm package both write agent, MCP and hook configuration across many client surfaces without asking.\n' +
        "Default install location is ~/.local/bin, which a non-login shell's PATH may not carry."
    );
  }

  let versionOutput;
  try {
    versionOutput = childProcess.execFileSync(codebaseMemoryBin, ['--version'], {
      encoding: 'utf8',
    });
  } catch {
    versionOutput = '';
  }
  if (!meetsVersionFloor(versionOutput, CODEBASE_MEMORY_VERSION_FLOOR)) {
    throw new Error(
      `'codebase-memory-mcp' must be at least ${CODEBASE_MEMORY_VERSION_FLOOR}, found: ${
        versionOutput.trim() || '(unparsable output)'
      }.\n` +
        'Upgrade: curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash -s -- --skip-config'
    );
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
  // A replacer function (not a replacement string) is required: a string
  // replacement is subject to $-pattern substitution (e.g. `$&`) even when
  // the search value is a plain string, which would corrupt a config-dir
  // path containing a literal `$&` (RESEARCH.md Assumptions Log A3).
  return Buffer.from(text.replaceAll(PLACEHOLDER, () => cfgDirAbs), 'utf8');
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
 * Register codebase-memory-mcp (removing any leftover vexp registration
 * best-effort) into one target config directory, then deploy every
 * discovered artifact, then write the manifest — in that order (D-17). Each
 * stage's error is tagged with `err.stage` (`'deploy' | 'mcp' | 'manifest'`)
 * so a caller looping over several targets can report exactly where a
 * mid-run failure stopped. Consequence of this ordering: a target that
 * fails during file deploy now leaves a registration behind and no
 * manifest — the manifest stays the sole record that a deploy completed,
 * never a statement that MCP registration alone succeeded.
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

  let mcpOutcome;
  try {
    mcpOutcome = registerCodebaseMemoryIfNeeded(cfgDirAbs, claudeBin, dryRun);
  } catch (err) {
    throw tagStage(err, 'mcp');
  }

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

  try {
    writeManifest(cfgDirAbs, shaInfo, repoSlug, relPaths, dryRun);
  } catch (err) {
    throw tagStage(err, 'manifest');
  }

  return { cfgDirAbs, counts, mcpOutcome };
}

/**
 * Registers codebase-memory-mcp in a target config directory, best-effort
 * removing any leftover vexp registration first. Two check-before-mutate
 * operations against the target's own `.claude.json`, in this order:
 *
 * 1. Removal (best effort, D-16/D-17). A truthy `mcpServers.vexp` is
 *    treated as present; absent, unreadable or unparsable is `not-present`
 *    and spawns no subprocess. Under `dryRun`, a present entry yields
 *    `would-remove` with no subprocess. Otherwise `claude mcp remove -s
 *    user vexp` is spawned; a throw is swallowed, warned about on stderr,
 *    and yields `removal-failed` — this is the first deliberately
 *    non-fatal operation in this installer, because nothing about the new
 *    install depends on the old entry being gone.
 * 2. Registration (fatal, D-13). `.claude.json` is re-read after the
 *    removal attempt so the decision reflects the post-removal state. An
 *    empty-object `codebase-memory-mcp` value counts as registered; a null
 *    value does not; a missing, unreadable or unparsable file counts as
 *    not registered. Under `dryRun`, states the decision without spawning.
 *    A throw from the `claude mcp add` subprocess propagates.
 *
 * Never hand-edits the JSON file.
 * @param {string} cfgDirAbs
 * @param {string} claudeBin
 * @param {boolean} [dryRun]
 * @returns {McpOutcome}
 */
function registerCodebaseMemoryIfNeeded(cfgDirAbs, claudeBin, dryRun) {
  const claudeJsonPath = path.join(cfgDirAbs, '.claude.json');

  const readVexpPresent = () => {
    try {
      const parsed = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
      return Boolean(parsed.mcpServers && parsed.mcpServers.vexp);
    } catch {
      return false;
    }
  };

  /** @type {McpOutcome['removal']} */
  let removal;
  if (!readVexpPresent()) {
    removal = 'not-present';
  } else if (dryRun) {
    console.log(`would remove: vexp MCP server in ${cfgDirAbs}`);
    removal = 'would-remove';
  } else {
    try {
      childProcess.execFileSync(claudeBin, ['mcp', 'remove', '-s', 'user', 'vexp'], {
        env: { ...process.env, CLAUDE_CONFIG_DIR: cfgDirAbs },
        stdio: 'ignore',
      });
      console.log(`removed: vexp MCP server in ${cfgDirAbs}`);
      removal = 'removed';
    } catch (err) {
      process.stderr.write(
        `Warning: failed to remove vexp MCP server in ${cfgDirAbs}: ${errMessage(err)}\n`
      );
      removal = 'removal-failed';
    }
  }

  let alreadyRegistered = false;
  try {
    const parsed = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
    alreadyRegistered = Boolean(
      parsed.mcpServers && parsed.mcpServers['codebase-memory-mcp']
    );
  } catch {
    alreadyRegistered = false;
  }

  if (alreadyRegistered) {
    console.log(`already registered: codebase-memory-mcp MCP server in ${cfgDirAbs}`);
    return { removal, registration: 'already-registered' };
  }

  if (dryRun) {
    console.log(`would register: codebase-memory-mcp MCP server in ${cfgDirAbs}`);
    return { removal, registration: 'would-register' };
  }

  childProcess.execFileSync(
    claudeBin,
    ['mcp', 'add', '-s', 'user', 'codebase-memory-mcp', '--', 'codebase-memory-mcp'],
    {
      env: { ...process.env, CLAUDE_CONFIG_DIR: cfgDirAbs },
      stdio: 'ignore',
    }
  );
  console.log(`registered: codebase-memory-mcp MCP server in ${cfgDirAbs}`);
  return { removal, registration: 'registered' };
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
 * @typedef {{ written: number, replaced: number, unchanged: number, targets: number, registered: number, alreadyRegistered: number, removed: number, removalFailed: number }} SummaryCounts
 */

/**
 * Format the closing summary line printed after every target has been
 * processed. Names codebase-memory-mcp for the registration clause and, per
 * D-17, appends a removal clause so the best-effort vexp removal outcome is
 * visible on the summary line rather than only in a warning. The removal
 * clause is omitted entirely when both its counters are zero.
 * @param {SummaryCounts} counts
 * @returns {string}
 */
function formatSummary(counts) {
  /** @type {string} */
  let mcpPart;
  if (counts.registered > 0 && counts.alreadyRegistered > 0) {
    mcpPart = `codebase-memory-mcp registered in ${counts.registered} target(s), already registered in ${counts.alreadyRegistered}`;
  } else if (counts.registered > 0) {
    mcpPart = `codebase-memory-mcp registered in ${counts.registered} target(s)`;
  } else {
    mcpPart = `codebase-memory-mcp already registered in ${counts.alreadyRegistered} target(s)`;
  }

  let removalPart = '';
  if (counts.removed > 0 || counts.removalFailed > 0) {
    removalPart =
      counts.removalFailed > 0
        ? `, vexp removed from ${counts.removed} target(s), removal failed for ${counts.removalFailed}`
        : `, vexp removed from ${counts.removed} target(s)`;
  }

  return `${counts.written} written, ${counts.replaced} replaced, ${counts.unchanged} unchanged across ${counts.targets} target(s), ${mcpPart}${removalPart}`;
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
        "  codebase-memory-mcp MCP server there via 'claude mcp add'.\n" +
        '  Example (two profiles): npx github:Invoker-Software/ai-dev <path/to/first-config-dir> <path/to/second-config-dir>\n' +
        '  This installer indexes nothing: run the codebase-memory-setup skill once per repository you want indexed.\n' +
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
  let removed = 0;
  let removalFailed = 0;
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
    if (
      result.mcpOutcome.registration === 'registered' ||
      result.mcpOutcome.registration === 'would-register'
    ) {
      registered += 1;
    } else {
      alreadyRegistered += 1;
    }
    if (
      result.mcpOutcome.removal === 'removed' ||
      result.mcpOutcome.removal === 'would-remove'
    ) {
      removed += 1;
    } else if (result.mcpOutcome.removal === 'removal-failed') {
      removalFailed += 1;
    }
  }

  console.log(
    formatSummary({
      ...totals,
      targets: positionals.length,
      registered,
      alreadyRegistered,
      removed,
      removalFailed,
    })
  );
  console.log('Done.');
}

module.exports = {
  main,
  parseCliArgs,
  whichExecutable,
  resolveClaudeBin,
  meetsVersionFloor,
  checkPrerequisites,
  discoverArtifacts,
  substitute,
  deployFile,
  deployTarget,
  registerCodebaseMemoryIfNeeded,
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
