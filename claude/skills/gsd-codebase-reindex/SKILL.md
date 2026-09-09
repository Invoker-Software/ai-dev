---
name: gsd-codebase-reindex
description: "Installs the automatic codebase-memory-mcp re-index into one GSD repository — a capability step plus a Stop hook sharing one gate. Requires a GSD project (.planning/ must exist). Run once per repository."
argument-hint: "[repository path, defaults to the current working directory]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
---

<objective>
This skill is a model run, not tested code, and is not idempotent in the
installer's diff-before-write sense — each step below checks before it
writes rather than relying on a diff. It is the second half of a two-skill
setup: `codebase-memory-setup` prepares and indexes a repository and works
anywhere; this skill keeps that index fresh and works only inside a GSD
project.
</objective>

<procedure>

## Step 1 — Preflight (fail closed, all checks before any write)

Check these, in this exact order, and report by name which one halted the
run. Do not perform any write before every applicable check has passed.

1. `git rev-parse --show-toplevel` does not resolve — this is not a git
   repository. Halt.
2. `<root>/.planning/` does not exist — **this is not a GSD project**. Halt
   with a plain statement: this skill installs a capability step and a hook
   that dispatch a capability command, the shared module itself refuses to
   act outside a GSD project, and installing them here would produce a
   mechanism that can never fire. Name what the developer still has:
   `codebase-memory-setup` works in this repository and indexes it, and
   re-running that skill is the standing refresh path. Do not offer a
   partial install, do not write the `Stop` hook alone as a consolation, and
   do not attempt the capability install to see what happens.
3. `codebase-memory-mcp` is absent from `PATH`, or `codebase-memory-mcp
   --version` reports a version below `0.10.8`. Halt with the same
   acquisition guidance the installer's own gate gives:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash -s -- --skip-config
   ```

   Cite `github.com/DeusData/codebase-memory-mcp` as the source. Never the
   vendor's own auto-configuring install subcommand, never the npm package,
   and never any other repository with a similar name.

Then one more halt condition — not an error in the same sense, and must be
worded as a prerequisite rather than a failure: if the repository is not yet
indexed, there is nothing to keep fresh. Detect this by the project-name
resolution rule in Step 2 finding no match, and halt telling the developer
to run `codebase-memory-setup` first.

## Step 2 — Resolve the three values

Follow `@@CLAUDE_CONFIG_DIR@@/skills/codebase-memory-setup/assets/resolution-rules.md`.
It is the only place the project-name, deny-list, and binary-path resolution
rules are written down; `codebase-memory-setup` follows the same file.
Resolving a value some other way here is how the two skills come apart — do
not restate any rule from that file. State only what this skill does with
each result:

- The resolved project name becomes `@@CBM_PROJECT_NAME@@`.
- The resolved deny list becomes `@@CBM_DENY_LIST@@`, written as a JSON
  array literal.
- The resolved binary absolute path becomes `@@CBM_BINARY@@`.

Two properties belong to this skill rather than to the shared rules:

- The deny list is baked in as a **snapshot**, deliberately, so the skip
  path never pays for a live query. Refresh it by re-running this skill if
  the repository's excluded directories change.
- The binary path is machine-local on purpose — it is the fallback the
  generated module uses when a hook's minimal environment does not carry
  the directory the binary lives in.

## Step 3 — Generate the bundle

Read the three template files from
`@@CLAUDE_CONFIG_DIR@@/skills/gsd-codebase-reindex/assets/capability/`.
Substitute the three tokens with Step 2's values and write the result to
`<root>/.planning/capabilities/codebase-reindex/` — a tracked location, so
the bundle a teammate needs in order to re-establish the mechanism travels
with the repository even though the installation itself does not.

Verify the written `codegraph-command.cjs` contains no remaining `@@CBM_`
token. Halt if one survives rather than installing a bundle that cannot run.

## Step 4 — Install the capability

```bash
node "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/gsd-core/bin/gsd-tools.cjs" \
  capability install <root>/.planning/capabilities/codebase-reindex --scope project --yes
```

Then confirm with:

```bash
node "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/gsd-core/bin/gsd-tools.cjs" \
  loop render-hooks execute:post --raw
```

that a `codebase-reindex` step is listed. Never hand-write into the
capability store or its ledger — `capability install` is the supported
path, and it is what records consent and verifies the bundle's integrity.

## Step 5 — The Stop hook

Write `hooks.Stop` into `<root>/.claude/settings.json`, creating the file if
it is absent, and **merging** into it if it is present — **never overwrite
an existing `hooks.Stop` array**, and never remove any other hook already
registered there.

The command dispatches `codegraph reindex --via stop-hook` through
`gsd-tools.cjs`, prefixed by whatever is needed to make `node` resolvable
in a minimal environment on this machine, `cd`-ing to the repository root,
redirecting output, and ending with `|| true` so a failure never affects
the turn.

Tell the developer to open `/hooks` once (or restart the session) after the
file is first created — the settings watcher does not pick up a settings
file that did not exist when the session started.

This is the second of the two entry points. Both share one module, one
marker, and one toggle, so neither can double-index or drift from the
other.

## Step 6 — Map GSD's own agents to the graph

Without this step, `gsd-executor`, `gsd-planner`, `gsd-debugger`,
`gsd-phase-researcher`, `gsd-code-reviewer`, `gsd-code-fixer`, and
`gsd-verifier` carry no `mcp__codebase-memory-mcp__*` in their tool
allowlists and read nothing that points them at the CLI — every step above
keeps the graph indexed and current while every GSD subagent that could
read it stays blind to its existence.

Read `<root>/.planning/config.json` (treat it as `{}` if the file is
absent) and, for each of those seven slugs, ensure its `agent_skills` array
contains `global:codebase-memory`: append it if the slug already has an
array and lacks the entry, create a one-entry array if the slug has no
entry yet, and change nothing if the entry is already present. Never
replace an existing array wholesale — a slug already mapped to some other
skill keeps that entry — and never touch any other top-level config key or
any other agent's `agent_skills` entry, including `gsd-pattern-mapper`'s if
one exists. Write the file only if the computed result differs from what
was read.

`gsd-pattern-mapper` is deliberately excluded from the seven: it carries no
`agent_skills` self-load contract in its own definition, so a mapping here
would never be read.

The value is `global:codebase-memory`, not a repo-relative path, because
that prefix resolves through each developer's own config directory, so the
identical string works on every machine regardless of which config home
that developer installed into.

Verify with:

```bash
for slug in gsd-executor gsd-planner gsd-debugger gsd-phase-researcher \
    gsd-code-reviewer gsd-code-fixer gsd-verifier; do
  node "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/gsd-core/bin/gsd-tools.cjs" \
    query agent-skills "$slug"
done
```

Each of the seven must print an `<agent_skills>` block. A
`[agent-skills] WARNING:` on stderr for any of them means it did not
resolve — most likely this developer has not run the ai-dev installer into
the config directory this runtime is using.

## Step 7 — Verify and report

Run the reindex command once manually and show the resulting line from
`<root>/.gsd/codebase-reindex.log`. Run it a second time with nothing
changed and show that the decision is the no-change skip and how long it
took — the skip path is the one that must stay cheap, and the budget is
under 1.5 seconds.

Report: the resolved project name, the deny-list entry count, that the
capability step is listed, and whether the `Stop` hook file was created or
merged.

</procedure>

<disclosure>
## What does not travel with an install

Each of the following is a machine-local artifact. None of them travels
when the repository is cloned elsewhere or when this profile is
reinstalled. Each has a re-establish recipe.

- **The capability's consent record.** Bound to the project path, the
  capability id, and a content hash of the bundle, and stored under the
  user's config home — never in the repository. Re-established by
  re-running `capability install --scope project --yes`.
- **`<root>/.claude/settings.json`.** Gitignored on machines whose global
  ignore covers it. Re-established by re-creating the `hooks.Stop` block,
  which the generated bundle's own `README.md` carries verbatim.
- **`<root>/.gsd/`, holding the marker and the decision log.** Gitignored.
  A missing marker simply means the next run treats the change set as
  unknown and re-indexes once — this is a self-healing absence, not a
  failure.

The generated bundle under `<root>/.planning/capabilities/codebase-reindex/`
**is** tracked, and is what makes this recipe reproducible without
re-running this skill from scratch.

`<root>/.planning/config.json`'s `agent_skills` mapping (Step 6) is
different from everything above: it **is** git-tracked, so it travels with
the repository. What does not travel is the skill it points at —
`global:codebase-memory` resolves through each developer's own config
directory, and a teammate who clones this repository without having run
the ai-dev installer into that directory gets a
`[agent-skills] WARNING:` at resolution time, not a working mapping. This
is not fully installed on their machine until they do.

**Known limitation, carried across unchanged rather than upgraded into a
reliability claim:** whether the harness's async `Stop`-hook runner
reliably lets a multi-second background process finish before the harness
moves on is unverified. The durable evidence, if it does, is a non-manual
`via=stop-hook` line appearing in `codebase-reindex.log` after a turn that
registered the hook has ended. If it does not, the fallback is to drop
`async` from the hook command and accept the measured sub-second skip-path
cost on every turn.
</disclosure>
