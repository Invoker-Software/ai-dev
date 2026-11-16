# ai-dev

Set up project-local AI skills and working preferences for Claude Code,
Codex, or both. Node.js 20 or newer is required.

## Set up a project

Run the CLI from this local checkout, naming an existing project directory:

```sh
node /path/to/ai-dev/install/cli.js init /path/to/project --profile general --runtime claude
node /path/to/ai-dev/install/cli.js init /path/to/siriusxm-project --profile siriusxm --runtime codex
```

To configure both runtimes, use `--runtime both`. Defaults are `--profile
general --runtime claude`. The project directory must already exist; setup
can add assistant configuration to an existing application or empty project
directory. It does not create an application or initialize Git.

An installed `ai-dev` executable accepts the same arguments:

```sh
ai-dev init /path/to/project --profile general --runtime both --dry-run
ai-dev init /path/to/project --profile general --runtime both
```

`--dry-run` validates and prints the proposed changes without writing.
No package, repository, workflow, or configuration is uploaded by setup.

## Profiles

| Profile | Default skills and preferences |
|---|---|
| `general` | Code-graph query/setup, history amendment, work summaries, PR descriptions, and general working preferences. Claude also receives the adhoc task skill and its native agents. |
| `siriusxm` | Everything in `general`, plus service and infrastructure workflows, AWS authentication, live-service guidance, CDK dependency fixes, API registry and Smithy guidance, on-call reports, ticket pickup, workspace setup, and SiriusXM conventions. |

The explicit catalog is in [install/profiles.json](install/profiles.json).
Both profiles use the shared source skills under `claude/skills/`; the
directory name identifies the historical source location. Codex receives
the portable skills with runtime guidance for tool names, questions, and
delegation. Claude-only adhoc agents are excluded from Codex.

The workspace setup skill is SiriusXM-specific because its bundled
reference snapshots contain quote-service conventions. The general profile
does not copy those templates or any enterprise skill package.

Three specialized skills require explicit selection:

| `--skill` | Profile | Runtime | Prerequisites |
|---|---|---|---|
| `gsd-codebase-reindex` | Either | Claude | Existing global Claude GSD installation. Invoking this skill can change global GSD configuration. |
| `iswi-start-rancher-desktop` | SiriusXM | Either | Original machine's macOS ARM/Rancher configuration. General Docker-free rules still apply. |
| `spike-findings-x-quote` | SiriusXM | Either | Matching quote-service project and experiments. |

```sh
node /path/to/ai-dev/install/cli.js init /path/to/quote-project \
  --profile siriusxm --runtime both --skill spike-findings-x-quote
```

Repeat `--skill` for multiple optional packages. Specify selected optional
skills again on subsequent runs; omitting one removes its unchanged owned
files. `--runtime both --skill gsd-codebase-reindex` is rejected because
that skill supports only Claude.

## Files and updates

| Runtime | Skills | Native agents | Preferences | Ownership record |
|---|---|---|---|---|
| Claude | `.claude/skills/` | `.claude/agents/adhoc-*.md` | Managed block in root `CLAUDE.md` | `.ai-dev/claude.json` |
| Codex | `.agents/skills/` | None | Managed block in root `AGENTS.md` | `.ai-dev/codex.json` |

Canonical preferences are authored in `rules/general.md` and
`rules/siriusxm.md`. Existing instruction text is preserved outside the
`ai-dev:preferences` markers. Put project-specific additions outside that
block; its contents are managed by setup. Imported global instruction
snapshots remain under `rules/claude/` and `rules/codex/` for reference.

Run the same command to update. An identical run writes nothing. Changing
profiles removes obsolete owned files only when their hashes still match
the prior installation; unrelated files remain. Each runtime is tracked
separately, so updating Claude does not change the Codex selection.

Setup validates all selected runtimes before writing. Conflicting existing
files, local edits to managed files or preferences, malformed manifests, and
symlinked destinations stop setup. Preserve or move conflicting edits and
rerun; there is no force-overwrite option. Keep `.ai-dev/` manifests with
the project configuration so subsequent updates retain ownership history.
I/O failures can leave a partial run; rerun after resolving the filesystem
problem, or inspect conflicting files if interrupted before the manifest
was written.

## External prerequisites

Project setup writes local files and invokes no external commands. It does
not change home-level configuration, configure MCP servers, set a model,
change runtime permissions, install GSD, register hooks, index code, or
configure credentials. Preferences are prompt instructions; they do not
enforce runtime permissions.

The code-graph skills require a separately installed `codebase-memory-mcp`
binary and repository setup/indexing. They can use its CLI without MCP
registration. The adhoc Claude agents require the code-graph MCP tools to
be available in that session. Install and configure public dependencies
separately. Some SiriusXM skills additionally require private repositories,
corporate connectivity, or Datadog MCP tools. Read a skill's prerequisites
before invoking it. Skills remain subject to the project's instructions and
publishing boundary.

Start or refresh your assistant session after setup. Personal and managed
skills outside the project can still be loaded by the runtime; project
profiles do not remove global skills. Runtime skill paths follow the
[Claude skill documentation](https://code.claude.com/docs/en/skills) and
[Codex skill documentation](https://learn.chatgpt.com/docs/build-skills).

## Legacy global Claude installation

The existing config-directory command remains available:

```sh
node /path/to/ai-dev/install/cli.js /path/to/claude-config --dry-run
```

It deploys **all** source skills and agents into a Claude profile, registers
the code-graph MCP server, and merges a home-level GSD grant. It does not
apply project profile filtering. Its prerequisites and write contract are
documented in [install/README.md](install/README.md). Use `init` for project
profile separation.

## Development

```sh
npm ci
npm test
npm run typecheck
```

Tests are Docker-free and use temporary directories. On macOS, the legacy
deployment-log tests expect the canonical temporary-directory spelling;
set `TMPDIR` to its resolved `/private/var/...` path if necessary.
