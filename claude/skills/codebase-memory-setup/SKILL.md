---
description: "Prepares one repository for the codebase-memory-mcp code graph — ignore rules and a first index. Works in any git repository, with no dependency on GSD, .planning/, or any capability system. Run once per repository."
name: codebase-memory-setup
argument-hint: "[repository path, defaults to the current working directory]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
---

<objective>
This skill is a model run, not tested code, and it is not idempotent in the
installer's diff-before-write sense: a second run re-does its steps rather
than comparing against a prior write. Every step below checks its own
precondition before writing anything, so re-running this skill against an
already-prepared repository should converge rather than duplicate work — but
the guarantee rests on this skill following its own instructions correctly
at run time, not on any tooling enforcing it.

It needs exactly two things — a git repository and the `codebase-memory-mcp`
binary on `PATH`. Nothing here depends on GSD, on `.planning/` existing, on
hooks, or on any capability system.
</objective>

<step_1_preflight>
## Step 1 — Preflight

Run every check below before any write.

1. Resolve the target repository root with `git rev-parse --show-toplevel`.
   Halt if the path is not inside a git repository.
2. Confirm `codebase-memory-mcp` is on `PATH`, and that
   `codebase-memory-mcp --version` reports `0.10.8` or newer.

If either check in step 2 fails, halt. Do not attempt to acquire the binary
yourself — report the failure and give the developer the verified acquisition
path:

```
curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash -s -- --skip-config
```

Never invoke the vendor's own auto-configuring install subcommand — it
performs unprompted machine-global agent, MCP, and hook writes across many
client surfaces, which this project's install-behavior constraints forbid.
Never recommend the freshly-published npm package as an acquisition path —
it is materially newer than the verified GitHub release and its own
postinstall step is suspected of the same unprompted-write behavior. Never
point at any other repository with a similar name; the one verified,
checksum-matched source is `github.com/DeusData/codebase-memory-mcp`.

These two checks are this skill's only prerequisites. It needs a git
repository and the binary — nothing about GSD, `.planning/`, hooks, or
capabilities enters into whether this skill can run.
</step_1_preflight>

<step_2_ignore_rules>
## Step 2 — Ignore rules

Create `<root>/.cbmignore` if it is absent. If it already exists, add
missing lines rather than rewriting the file.

Seed it with the throwaway and vendored directories this specific repository
actually has — determine them by listing the repository root, not by
copying another repository's list. Write a one-line comment above each entry
explaining why it is excluded.

Keep the file short. The indexer already skips a sensible default set of
directories on its own; `.cbmignore` exists only for this repository's own
additions on top of that default.
</step_2_ignore_rules>

<step_3_index>
## Step 3 — Index, bootstrap-if-present

If `<root>/.codebase-memory/graph.db.zst` exists, use it to bootstrap rather
than running a full index.

Otherwise, run:

```
codebase-memory-mcp cli index_repository --repo-path <root> --mode moderate --name <name>
```

where `<name>` comes from the project-name rule in Step 4.

Do **not** pass `--persistence`. This skill consumes the shared bootstrap
artifact when one is already present, but it does not produce one — who
publishes it, and how often it gets refreshed, is deliberately left open.
State this plainly to the reader so nobody assumes the bootstrap path will
ever get populated by this skill, or by anything else that ships today.
</step_3_index>

<step_4_resolve_live>
## Step 4 — Resolve live, against this repository

Do not restate the resolution rules here. They live in exactly one place:
`@@CLAUDE_CONFIG_DIR@@/skills/codebase-memory-setup/assets/resolution-rules.md`.
Both this skill and `gsd-codebase-reindex` follow that file. A rule that
changes in one skill's head rather than in that shared file is how the two
skills drift apart — read the rules there, do not copy them into this
prose.

This step applies two of the three rules from that file:

- **The project name rule** (resolved via `list_projects`, matched against
  this repository's root path). Step 3 needs its output to run the first
  index, and its result is reported back to the developer in Step 5, because
  the name is what every later query has to be given.
- **The deny-list rule**, run here as a coverage report: it names what the
  index did not take in, which is the direct evidence for whether Step 2's
  `.cbmignore` needs another line, or already has one too many. Report the
  entries and their count in Step 5 — this skill does not bake them into
  anything.

The binary-path rule is **not** applied by this skill. It exists for the
generated module that `gsd-codebase-reindex` writes; this skill only needs
the binary to be on `PATH`, which Step 1 already established.
</step_4_resolve_live>

<step_5_report>
## Step 5 — Report

State, in the response to the developer:

- The resolved project name.
- Whether Step 3 bootstrapped from an existing artifact or ran a first
  index.
- The `.cbmignore` lines added, if any.
- The coverage entries from Step 4's deny-list report, and their count.
</step_5_report>

<automatic_refresh>
## Automatic refresh — the half this skill does not do

This skill indexes a repository once. It does not keep the index fresh. The
graph goes stale from the next commit onward and stays stale until this
skill is run again.

The `gsd-codebase-reindex` skill closes that gap: it installs a re-index
that fires after work happens, and it requires the repository to be a GSD
project — it refuses to run in a repository with no `.planning/`.

For every other repository, the standing fallback is plain: re-run this
skill, or run `index_repository` by hand. There is no third option that
ships today. The index does not "mostly stay current" on its own — treat it
as stale the moment work happens, until one of those two things runs again.
</automatic_refresh>

<disclosure>
## What Does Not Travel

The index itself is machine-local: it lives in the server's own store on
the machine that built it. A teammate who clones this repository gets
`.cbmignore` and nothing else — the index is not part of the clone — and
must run this skill themselves to get one.

The one form the index could travel in is
`<root>/.codebase-memory/graph.db.zst`, which Step 3 reads when present but
deliberately never writes. On a repository nobody has published one for,
the bootstrap branch is unreachable. State that as a present fact, not a
future feature — nothing in this skill, or shipped alongside it today,
produces that artifact.

`.cbmignore` is the one artifact this skill produces that is tracked in git
and does travel with the repository.
</disclosure>

<registration>
## Registration

This skill does not register the MCP server. The installer already
registers `codebase-memory-mcp` at user scope in each config directory it
was pointed at, which covers the main session in every repository the
developer opens. A project-scope `<root>/.mcp.json` is therefore
deliberately **not** written by this skill — it would be a second
registration of the same server, requiring a separate per-repository
approval, for a developer who by definition already ran the installer.

For a teammate who has not run the installer and wants this repository to
carry its own registration anyway, the content is two lines:

```json
{"command":"codebase-memory-mcp","args":[]}
```

Adopting that means living with the duplicate approval prompt it introduces
for anyone who already has the user-scope registration from the installer.
</registration>
