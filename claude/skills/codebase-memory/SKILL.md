---

name: codebase-memory
description: "Queries the codebase-memory-mcp code graph to locate symbols, trace callers and callees, and scope blast radius without reading files. Read before grep when the question is structural."
allowed-tools:
  - Read
  - Bash
---

# Codebase Memory

`codebase-memory-mcp` indexes this repository into a persistent, tree-sitter-parsed code
graph. Use it to answer *structural* questions — who calls this, what breaks if I change
it, where does this concept live — in one query instead of a grep-then-read sweep.

## Resolving the project name

Every query tool below requires `--project <name>`. The name is never hardcoded in this
file or in any recipe. Resolve it before the first query in a session or task:

```bash
git rev-parse --show-toplevel
codebase-memory-mcp cli list_projects
```

Take the `name` field of the `list_projects` entry whose `root_path` equals the
`git rev-parse --show-toplevel` output. The response shape, verified live:

```json
{"projects":[{"name":"<name>","root_path":"<path>"}],"total":1,"offset":0,"limit":50,"returned":1,"has_more":false}
```

No match means this repository is not indexed. The answer is to run the
`codebase-memory-setup` skill, not to guess a name or fall back to grep silently.

## Two access paths

| Caller | How |
|---|---|
| Main Claude Code session, and the `adhoc-investigator`/`adhoc-executor` agents | MCP tools: `mcp__codebase-memory-mcp__<tool>` |
| Every other subagent | Bash: `codebase-memory-mcp cli <tool> --flag value` |

Subagent tool whitelists do not include MCP servers, so a subagent with no MCP access
runs the Bash CLI form instead. The tool surface is identical across both forms. Run
`codebase-memory-mcp cli <tool> --help` to see the exact flags for any tool.

## Graph before grep — the routing rule

Recognize these questions and reach for the graph instead of grep:

- "where is X defined" / "find the X function" → `search_graph --query`
- "who calls X" / "what uses X" → `trace_path --direction inbound`
- "what does X call" → `trace_path --direction outbound`
- "what breaks if I change this" / "what is the blast radius" → `detect_changes`
- "how is this codebase organised" / orienting in unfamiliar territory → `get_architecture`
- "show me the body of X" without opening the file → `get_code_snippet`
- a pattern search that wants symbol metadata attached, not just matching lines → `search_code`

**Where grep still wins:** the graph complements grep, it does not replace it. Grep still
wins for string literals, configuration values, comments, non-code files, and any path the
index does not cover — a rule that overclaims gets ignored wholesale, which is the failure
this line exists to prevent.

### The rule's reach

This routing rule is not a house convention and is not authored into `dev/conventions/`
(D-10) — it binds only a session that has read this skill. The two adhoc agents
(`adhoc-investigator`, `adhoc-executor`) carry the MCP tools in their harness allowlists
regardless of whether any rule text was read, so the reach gap is the main session's, not
theirs.

## Core recipes

Every recipe below is written in the `codebase-memory-mcp cli` form so a subagent can
paste it verbatim. `<name>` is the project name resolved above.

**Locate a symbol or concept:**
```bash
codebase-memory-mcp cli search_graph --project <name> --query "flat fill mask" --label Function --file-pattern 'src/**' --limit 10
```
Response carries `total` and `has_more`; page with `--offset`.

**Who calls this / what does it call:**
```bash
codebase-memory-mcp cli trace_path --project <name> --function-name <qualified-name> --direction inbound --depth 3
```
`--direction` is `inbound` (callers) | `outbound` (callees) | `both`.

**Blast radius of the working-tree diff:**
```bash
codebase-memory-mcp cli detect_changes --project <name>
codebase-memory-mcp cli detect_changes --project <name> --since <ref>
```
`--scope impact` and `--direction inbound` are already the defaults — a bare
`detect_changes --project <name>` already runs in impact/inbound mode. `--since <ref>`
diffs a committed range instead of the working tree. The `impacted_modules` rollup stays
complete even when individual rows are truncated.

**Read one function without opening the file:**
```bash
codebase-memory-mcp cli get_code_snippet --project <name> --qualified-name <qualified-name>
```

**Symbol-enriched pattern search:**
```bash
codebase-memory-mcp cli search_code --project <name> --pattern '<pattern>' --path-filter '^src/'
```

**Orientation on unfamiliar territory:**
```bash
codebase-memory-mcp cli get_architecture --project <name>
```

`query_graph`, `get_graph_schema`, `index_status`, `check_index_coverage`, `manage_adr`,
and `ingest_traces` are also available; run `codebase-memory-mcp cli <tool> --help` before
using any of them.

## Freshness

The graph is a snapshot. A symbol returned at a line number that does not match the file
means the index is stale — re-index rather than work around it.

```bash
codebase-memory-mcp cli index_status --project <name>
codebase-memory-mcp cli check_index_coverage --project <name> --scopes .
```

Automatic re-indexing after work is set up per repository by the `codebase-memory-setup`
skill. The manual command below is the fallback of last resort:

```bash
codebase-memory-mcp cli index_repository --repo-path "$(git rev-parse --show-toplevel)" --name <name>
```
