'use strict';

// codegraph-command.cjs -- shared re-index dispatch for the `codebase-reindex`
// GSD capability (loop hook, execute:post) AND the Claude Code `Stop` hook
// (.claude/settings.json). ONE module, ONE marker file, ONE decision log --
// do not fork this logic; both entry points call `route()`.
//
// TEMPLATE FILE -- not runnable until the three @@CBM_*@@ tokens below are
// substituted. The `gsd-codebase-reindex` skill performs that substitution
// against the repository it is run in. A copy of this file still containing
// any `@@CBM_` token has been deployed rather than generated and will fail.
//
// Contract: sole own export is `route`, a SYNCHRONOUS function taking
// { args, cwd, raw, error }. Never throws, never exits non-zero -- every
// failure path is a one-line warning followed by a normal return.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const MARKER_RELPATH = path.join('.gsd', 'codebase-reindex-state.json');
const LOG_RELPATH = path.join('.gsd', 'codebase-reindex.log');
const LOG_MAX_LINES = 500;
const REINDEX_TIMEOUT_MS = 120000;
const FALLBACK_BINARY = '@@CBM_BINARY@@';
const PROJECT_NAME = '@@CBM_PROJECT_NAME@@';

// Paths this mechanism's own installation creates. The resolved snapshot
// below cannot be relied on to carry them: that snapshot's resolution rule
// (see the shared resolution-rules.md) only ever yields directories, and it
// is taken BEFORE this capability is installed, so even the directories
// this installation creates are absent from it.
// `capability install --scope project` writes `.gsd-capabilities.json` at
// the repository root as a ledger file, and `.gsd/` as the state directory
// holding this module's own marker, decision log and staged copy. Both are
// untracked, neither is gitignored in every repository, and both are
// rewritten by this module's own invocations. Left in the change set they
// make the module observe its own writes as repository changes, and the
// no-change skip decision below becomes unreachable in every repository
// where this capability is installed.
const SELF_ARTIFACT_DENY_LIST = ['.gsd-capabilities.json', '.gsd'];

// Authoritative deny-list -- a snapshot of `check_index_coverage`'s live
// `not_indexed.dirs` for this repository, resolved by the skill at run time
// per the shared resolution rules it cites, and baked in here deliberately
// so the skip path never pays for a live query.
const DENY_LIST = @@CBM_DENY_LIST@@.concat(SELF_ARTIFACT_DENY_LIST);

function isDenied(relPath) {
  return DENY_LIST.some((d) => relPath === d || relPath.startsWith(d + '/'));
}

function resolveMainRoot(cwd) {
  const res = spawnSync('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
    encoding: 'utf8',
  });
  if (res.error || res.status !== 0 || !res.stdout) return null;
  const gitCommonDir = res.stdout.trim();
  const mainRoot = path.dirname(gitCommonDir);
  if (!fs.existsSync(path.join(mainRoot, '.planning'))) return null;
  return mainRoot;
}

function readConfigToggle(mainRoot) {
  // Default true -- matches the capability's declared config default. A
  // missing or unparseable config, or a missing key, is "enabled".
  try {
    const configPath = path.join(mainRoot, '.planning', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (cfg && cfg.workflow && cfg.workflow.codebase_reindex === false) return false;
    return true;
  } catch (_) {
    return true;
  }
}

function readMarker(mainRoot) {
  try {
    const raw = fs.readFileSync(path.join(mainRoot, MARKER_RELPATH), 'utf8');
    const marker = JSON.parse(raw);
    if (marker && typeof marker.head_sha === 'string' && marker.head_sha) return marker;
    return null;
  } catch (_) {
    return null;
  }
}

function writeMarker(mainRoot, marker) {
  try {
    const gsdDir = path.join(mainRoot, '.gsd');
    fs.mkdirSync(gsdDir, { recursive: true });
    const markerPath = path.join(mainRoot, MARKER_RELPATH);
    const tmpPath = markerPath + '.tmp-' + process.pid;
    fs.writeFileSync(tmpPath, JSON.stringify(marker, null, 2) + '\n');
    fs.renameSync(tmpPath, markerPath);
  } catch (_) {
    // swallow -- a marker-write failure must never block the caller.
  }
}

// A signature of every non-denied path the working tree is dirty at right
// now, each stamped with the size and nanosecond mtime that tell one edit
// of a file apart from the next. The previous invocation recorded this
// value in the marker; comparing the two is what makes the decision below
// "did anything change SINCE THE LAST RUN" rather than "is anything dirty
// RIGHT NOW". The latter can never become false while any non-denied path
// stays dirty, which is what made the no-change skip unreachable.
//
// Denied paths are dropped BEFORE stamping, and that is load-bearing: this
// module's own decision log lives under `.gsd` (see
// SELF_ARTIFACT_DENY_LIST) and its mtime changes on every invocation, so
// stamping it would make the signature differ every run.
//
// The size stamp catches an edit that changes a file's length; the mtime
// stamp catches a same-length rewrite. An edit that preserves both is not
// detected -- the same bound every mtime-based staleness check carries.
// No file contents are read, so a large untracked artifact cannot push the
// skip path over its budget.
//
// Status is read with `-z`, which emits NUL-terminated entries and NEVER
// quotes a path. Reading newline-delimited output instead would be a
// correctness bug, not a style choice: git quotes any path containing a
// space, so ` M "my file.ts"` would be stat'ed as the literal quoted text,
// fail, and fall back to a constant stamp -- making that file's signature
// identical across every edit and skipping the refresh it needs. Note that
// `core.quotePath=false` does NOT avoid this; it suppresses only the
// escaping of non-ASCII bytes. Only `-z` removes quoting outright.
function dirtyEntries(statusOutput) {
  // `-z` fields: `XY <path>` per entry. A rename or copy carries its origin
  // path as the FOLLOWING field, which must be consumed rather than parsed
  // as an entry of its own.
  const fields = String(statusOutput || '').split('\0');
  const entries = [];
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    if (!field) continue;
    const code = field.slice(0, 2);
    const relPath = field.slice(3);
    if (code[0] === 'R' || code[0] === 'C') i += 1;
    if (!relPath) continue;
    entries.push({ code, relPath });
  }
  return entries;
}

function dirtySignature(mainRoot, statusOutput) {
  const entries = [];
  for (const { code, relPath } of dirtyEntries(statusOutput)) {
    if (isDenied(relPath)) continue;
    let stamp = 'absent';
    try {
      const st = fs.statSync(path.join(mainRoot, relPath), { bigint: true });
      stamp = st.size + ':' + st.mtimeNs;
    } catch (_) {
      // Deleted since `git status` ran. The status code still tells that
      // state apart from an unmodified one.
    }
    entries.push(code + ' | ' + relPath + ' | ' + stamp);
  }
  entries.sort();
  return digestOf(entries.join('\n'));
}

// Returns { unknown: boolean, committedPaths: string[], statusOutput: string }.
// `committedPaths` covers only what landed in commits since the marker's
// head_sha. The working tree's dirty set is carried out as raw status
// output and compared by signature, not by path, so a path that was
// already dirty at the last invocation does not read as a new change.
function computeChangeSet(mainRoot, marker) {
  let unknown = false;
  const committed = [];

  if (!marker || !marker.head_sha) {
    unknown = true;
  } else {
    const verify = spawnSync('git', ['-C', mainRoot, 'cat-file', '-e', marker.head_sha], { encoding: 'utf8' });
    if (verify.error || verify.status !== 0) {
      unknown = true;
    } else {
      const diff = spawnSync('git', ['-C', mainRoot, 'diff', '--name-only', marker.head_sha, 'HEAD'], {
        encoding: 'utf8',
      });
      if (diff.error || diff.status !== 0) {
        unknown = true;
      } else {
        committed.push(...diff.stdout.split('\n').filter(Boolean));
      }
    }
  }

  const status = spawnSync('git', ['-C', mainRoot, 'status', '--porcelain=v1', '-z', '-uall'], { encoding: 'utf8' });
  if (status.error || status.status !== 0) {
    unknown = true;
  }

  return { unknown, committedPaths: [...new Set(committed)], statusOutput: status.stdout || '' };
}

function currentHeadSha(mainRoot) {
  const res = spawnSync('git', ['-C', mainRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (res.error || res.status !== 0 || !res.stdout) return null;
  return res.stdout.trim();
}

function digestOf(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

function runReindex(mainRoot) {
  const args = ['cli', 'index_repository', '--repo-path', mainRoot, '--mode', 'moderate', '--name', PROJECT_NAME];
  let res = spawnSync('codebase-memory-mcp', args, { timeout: REINDEX_TIMEOUT_MS, stdio: 'ignore' });
  if (res.error && res.error.code === 'ENOENT') {
    res = spawnSync(FALLBACK_BINARY, args, { timeout: REINDEX_TIMEOUT_MS, stdio: 'ignore' });
  }
  return res;
}

function reindexFailureReason(res) {
  if (res.error && res.error.code === 'ENOENT') return 'binary-not-found';
  if (res.error && res.error.code === 'ETIMEDOUT') return 'timeout';
  if (res.signal) return 'signal-' + res.signal;
  if (res.error) return 'spawn-error';
  return 'nonzero-exit-' + res.status;
}

function appendLog(mainRoot, line) {
  try {
    const logPath = path.join(mainRoot, LOG_RELPATH);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, line + '\n');
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    if (lines.length > LOG_MAX_LINES) {
      fs.writeFileSync(logPath, lines.slice(-LOG_MAX_LINES).join('\n') + '\n');
    }
  } catch (_) {
    // swallow -- logging must never block or throw.
  }
}

function parseVia(args) {
  const idx = args.indexOf('--via');
  if (idx !== -1 && typeof args[idx + 1] === 'string') return args[idx + 1];
  return 'loop';
}

function route({ args }) {
  const startedAt = Date.now();
  try {
    const argv = Array.isArray(args) ? args : [];
    if (argv[1] !== 'reindex') return; // not our subcommand -- ignore quietly

    const via = parseVia(argv.slice(2));
    const cwd = process.cwd();
    const mainRoot = resolveMainRoot(cwd);
    if (!mainRoot) return; // no main checkout resolvable -- quiet no-op

    if (!readConfigToggle(mainRoot)) {
      appendLog(mainRoot, logLine(via, 'skipped-disabled', Date.now() - startedAt));
      console.log('codegraph reindex: skipped (workflow.codebase_reindex is false)');
      return;
    }

    const marker = readMarker(mainRoot);
    const changeSet = computeChangeSet(mainRoot, marker);
    const dirtyDigest = dirtySignature(mainRoot, changeSet.statusOutput);

    // Three independent reasons to re-index, in fail-open order: we cannot
    // tell what changed; a commit landed on a non-denied path since the
    // last invocation; or the non-denied dirty set is not the one the last
    // invocation already indexed. The third is the comparison the marker's
    // dirty_digest field exists for. A marker written before that
    // comparison existed carries no such field, reads as changed, and costs
    // exactly one extra re-index before converging.
    const needsReindex =
      changeSet.unknown ||
      changeSet.committedPaths.some((p) => !isDenied(p)) ||
      !marker ||
      marker.dirty_digest !== dirtyDigest;

    if (!needsReindex) {
      const headSha = currentHeadSha(mainRoot);
      writeMarker(mainRoot, {
        head_sha: headSha || (marker && marker.head_sha) || '',
        dirty_digest: dirtyDigest,
        updated_at: new Date().toISOString(),
      });
      appendLog(mainRoot, logLine(via, 'skipped-no-change', Date.now() - startedAt));
      console.log('codegraph reindex: skipped (no indexed path changed)');
      return;
    }

    const res = runReindex(mainRoot);
    if (res.error || res.status !== 0) {
      appendLog(mainRoot, logLine(via, 'failed-' + reindexFailureReason(res), Date.now() - startedAt));
      console.log('codegraph reindex: failed (' + reindexFailureReason(res) + ')');
      return;
    }

    const headSha = currentHeadSha(mainRoot);
    // dirtyDigest was taken BEFORE the re-index started, deliberately: an
    // edit made while the re-index was in flight is not folded into the
    // recorded state, so the next invocation still refreshes for it.
    writeMarker(mainRoot, {
      head_sha: headSha || '',
      dirty_digest: dirtyDigest,
      updated_at: new Date().toISOString(),
    });
    appendLog(mainRoot, logLine(via, 'reindexed', Date.now() - startedAt));
    console.log('codegraph reindex: reindexed ' + mainRoot);
  } catch (e) {
    try {
      process.stderr.write('codegraph reindex: unexpected error: ' + (e && e.message ? e.message : String(e)) + '\n');
    } catch (_) {
      // even stderr can fail in exotic hosts -- never let logging throw.
    }
  }
}

function logLine(via, decision, elapsedMs) {
  return new Date().toISOString() + ' via=' + via + ' decision=' + decision + ' elapsed_ms=' + elapsedMs;
}

module.exports = { route };
