# Re-establishing the codebase-reindex automation

Both mechanisms below are machine-local and deliberately untracked (`.gsd/`
and `.claude/` are typically gitignored, and the capability's consent record
lives in the user's Claude config home, never in the repository). A fresh
clone of a repository this has been set up in, or the same machine after a
reinstall of Claude Code or GSD, starts with BOTH mechanisms inactive by
design (fail-closed) — this bundle plus the commands below is what rebuilds
them.

## 1. The GSD capability (covers `execute:post` workflows)

Install project-scope from the repository root. A developer on a non-default
Claude Code profile must point `CLAUDE_CONFIG_DIR` at their own profile
before running this:

```bash
node "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/gsd-core/bin/gsd-tools.cjs" \
  capability install <path-to-this-bundle-directory> --scope project --yes
```

Verify it is active:

```bash
node "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/gsd-core/bin/gsd-tools.cjs" \
  loop render-hooks execute:post --raw
```

`activeHooks` should list a `codebase-reindex` step. This covers GSD
workflows that dispatch the `execute:post` loop point — for example
`/gsd-execute-phase`, `/gsd-autonomous`, and `/gsd-quick --full`.

## 2. The Claude Code `Stop` hook (covers everything else)

Merge the following into `.claude/settings.json` at the repository root —
create the file if it does not exist, but if it already exists, **merge**
into its `hooks.Stop` array; **never overwrite an existing `hooks.Stop`
array**, or any other hook another tool may have registered there:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cd <repository-root> && node \"${CLAUDE_CONFIG_DIR:-$HOME/.claude}/gsd-core/bin/gsd-tools.cjs\" codegraph reindex --via stop-hook >/dev/null 2>&1 || true",
            "async": true,
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

The command above may need a `node`-resolving `PATH` prefix on machines
where a hook's minimal environment does not already carry one — that
resolution is the installing skill's job, not this template's.

After creating or editing this file for the first time in a session, open
`/hooks` once (or restart Claude Code) — the settings watcher only watches
directories that already had a settings file when the session started, so a
brand-new `.claude/settings.json` is not picked up until then.

This hook fires on every `Stop` event (turn end, clear, resume, compact) in
the main session, regardless of which GSD workflow ran — including plain
`/gsd-quick`, `/gsd-fast`, `/gsd-debug`, and `/gsd-quick-batch`, none of which
dispatch any `execute:post` loop hook.

## 3. The shared toggle

Both entry points are gated by the same key, read inside the shared
`codegraph-command.cjs` module rather than duplicated per entry point:

```bash
node "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/gsd-core/bin/gsd-tools.cjs" \
  config-set workflow.codebase_reindex true
```

Default is `true` (declared in `capability.json`'s `config` block). Setting
it to `false` removes the capability step from `render-hooks execute:post`
AND makes the Stop hook's shared module skip immediately
(`skipped-disabled` in the decision log) — one key, two entry points,
because the gate lives inside the shared module, not duplicated in each
entry point.

## Why both start inactive on a fresh clone / reinstall

- The capability's consent record (bound to the project path, the
  capability id, and a content hash of the bundle) lives under the user's
  Claude config home, not in the repository. A ledger file may be committed
  in the repository, but it is only a ledger — it grants nothing on its own.
- `.claude/settings.json` is commonly gitignored, so it never leaves the
  machine it was created on.

## Evidence of a live invocation

Every invocation of either mechanism appends one line to
`<mainRoot>/.gsd/codebase-reindex.log` (also gitignored), recording an ISO
timestamp, `via=loop` or `via=stop-hook`, the decision
(`reindexed` / `skipped-no-change` / `skipped-disabled` / `failed-<reason>`),
and elapsed milliseconds (`elapsed_ms=`). This is the durable evidence a
`Stop` hook fired, since a `Stop` hook cannot be observed from inside the
turn that registers it.

## Known limitation

Whether Claude Code's harness reliably lets the `Stop` hook's async
background process finish before the harness moves on is unverified. The
durable evidence, if it does, is a non-manual `via=stop-hook` line appearing
in the log after a turn that registered the hook has ended. If it does not,
the fallback is to drop `async` from the hook command and accept the
measured sub-second skip-path cost on every turn.
