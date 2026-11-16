---
name: api-registry
description: "Query the SiriusXM API registry (Smithy models + app manifests) via the api-registry MCP server. Use when the user asks about: Smithy shapes / operations / services / resources / traits, structural dependencies between shapes, who exports/imports a shape, application manifests, workspace validation, or the Maven dependencies that contribute Smithy models. Triggers on phrases like 'smithy shape', 'find references to', 'who imports/exports', 'dependency path', 'validate the model', 'list applications', 'which app owns', or `/api-registry <query>`."
---

# API Registry Skill

Route a user message about Smithy shapes or application manifests to the right `mcp__api-registry__*` tool and return a concise answer. Prefer these MCP tools over `grep`/`Read` on raw `.smithy` files — the tools operate on the assembled model, so they see traits, mixins, closures, and shapes contributed by Maven dependencies that a text search will miss.

## Inputs

- `$ARGUMENTS` (when invoked as `/api-registry …`) — the user's query.
- Otherwise, use the most recent user message as the query.

If the query is empty, ask the user what they want to look up before calling any tool.

## Available MCP Tools

| Tool | Purpose | Key Parameters |
|---|---|---|
| `mcp__api-registry__ReadSmithyShapes` | Full shape details (kind, members, traits, source location) for shapes matching a selector | `selector` (required), `modelSource` (required) |
| `mcp__api-registry__ReadSmithyShapeIndex` | Compact index of shapes with optional selector filtering — kind + docs, no members/traits | `modelSource` (required), `selector`, `includeDocumentation`, `includeDependencies`, `includePrelude` |
| `mcp__api-registry__FindSmithyShapeReferences` | All workspace references to a shape (member targets, mixins, trait apps, operation I/O, etc.) | `shapeId` (required), `modelSource` (required) |
| `mcp__api-registry__DependencyPath` | Shortest dependency path between two shapes; returns DEPENDS or DOES_NOT_DEPEND | `source`, `target` (both required), `modelSource` (required) |
| `mcp__api-registry__ValidateSmithyModel` | Assemble the workspace model and return LSP-style diagnostics grouped by severity | `modelSource` (required), `severityFilter` |
| `mcp__api-registry__ListSmithyDependencies` | Maven deps that contribute Smithy models, with the namespaces each JAR provides | `modelSource` (required) |
| `mcp__api-registry__ListApplications` | All app-manifest entries with fully resolved import/export links | `modelSource` (required), `includeTestApps` |
| `mcp__api-registry__GetApplication` | One app by name, with resolved imports/exports | `name` (required), `modelSource` (required), `includeTestApps` |
| `mcp__api-registry__FindApplicationsByExportedShapes` | Given shape IDs → apps that export (or derive) each | `shapeIds` (required), `modelSource` (required), `includeTestApps` |
| `mcp__api-registry__FindApplicationsByImportedShapes` | Given shape IDs → apps that directly import each | `shapeIds` (required), `modelSource` (required), `includeTestApps` |

## Model source

Every tool takes a required `modelSource` saying which model to read. Always send it: a server that has it rejects a call without it ("Required field not found (path: .modelSource)").

**`local`** is the model of this checkout, with the same post-processing as the registry build (synthesized edge services and so on). Use it unless the user asks about something that is not in this checkout.

```json
"modelSource": {"local": {}}
```

**`assembly`** builds a model from what is in the request, reading nothing from disk. Use it for a published artifact or a snippet that is not in this checkout.

```json
"modelSource": {"assembly": {
  "files": {"meta.smithy": "$version: \"2\"\nnamespace example\n..."},
  "dependencies": [{"groupId": "com.siriusxm.api-registry.apps", "artifactId": "account-service", "version": "<version>"}]
}}
```

- `files` maps a relative file name (`.smithy` or `.json`) to its content. The name is what appears as the source location in results. `dependencies` are Maven coordinates, resolved with their transitive dependencies from the server's own Artifactory configuration. Either one can be left out, or both.
- An `assembly` is validated like the local model but not post-processed, so it has no `@sxmGenerated` shapes. Do not read that difference as a change in the source. It is not cached, so a large dependency set makes each call slow.
- A model that does not assemble is the answer for `ValidateSmithyModel` (`ok: false` with diagnostics). Other tools fail with `ModelAssemblyError`, which lists the errors. An unresolvable coordinate fails with `MavenResolutionError` naming it; report it instead of guessing another coordinate.
- `ListSmithyDependencies` lists a dependency's namespaces only when the model has a shape in them, so a namespace that holds only `apply` statements does not appear.

A server from before this argument existed ignores it, so sending it is safe against older versions too.

## Tool Routing

Pick the **single best tool** for the query. Prefer specific tools over broad ones.

| Query intent | Tool | Notes |
|---|---|---|
| "Show me shape X" / "what does X look like" / "traits on X" | `ReadSmithyShapes` with `[id = 'ns#X']` | Batch multiple IDs into one call: `:is([id = 'a#X'], [id = 'b#Y'])`. |
| "List all shapes in namespace X" / "all HTTP operations" / trait/kind survey | `ReadSmithyShapeIndex` with a selector | Compact — no members/traits. Combine kind + trait + namespace filters. See the `smithy-selectors` skill for syntax. |
| "Which shapes are trait-tagged X" living outside the workspace | `ReadSmithyShapeIndex` with `includeDependencies: true` + namespace filter | Empty result on a plain call usually means the trait is defined in a Maven dep — retry with dependencies before falling back to anything else. |
| "Who uses shape X" / "impact of changing X" / "safe to delete X" | `FindSmithyShapeReferences` | Only walks workspace shapes; the target itself may be external. |
| "Does A depend on B" / "path from A to B" | `DependencyPath` | Returns the shortest path; use for cycle-style questions and dependency-audit prompts. |
| "Is the model valid" / "why won't Smithy compile" / diagnostics | `ValidateSmithyModel` | Returns `ok`, then errors/dangers/warnings/notes lists. Same view Smithy's assembler produces. |
| "What Smithy dependencies do we pull in" / "which JAR contributes namespace X" | `ListSmithyDependencies` | Also reports workspace-defined namespaces. |
| "For each app, what does it expose/consume" / whole-graph app view | `ListApplications` | Wide response; only use when the answer really is graph-wide. |
| "Tell me about app X" / one named app | `GetApplication` | Don't loop this over a list — use `ListApplications` once instead. |
| "Which apps export these shapes" (any set size) | `FindApplicationsByExportedShapes` | Feed shape IDs from a prior `ReadSmithyShapeIndex`. Includes apps that only *derive* the shape. |
| "Which apps import these shapes" (any set size) | `FindApplicationsByImportedShapes` | Direct importers only — not the transitive closure over type references. |

### Closure questions

Any prompt of the form *"which X contains / uses / transitively references / has at least one Y"* is a closure question — answer it with **one** `ReadSmithyShapeIndex` call using `X :test(~> Y-selector)`, not by enumerating X and Y separately.

Examples:
- "services that expose a paginated operation" → `service :test(~> [trait|smithy.api#paginated])`
- "operations whose input contains a `@sensitive` member" → `operation :test(-[input]-> ~> [trait|smithy.api#sensitive])`

If your first call returned the wrong granularity (e.g. operations when the question was about services), re-frame the selector rather than reconciling two enumerations client-side.

### Shape IDs

Fully-qualified: `namespace#ShapeName` (e.g. `commerce.offer.api.internal#BatchApi`). Member IDs use `parent#Shape$member`; the parent is everything before `$` — no follow-up call needed to attribute a member.

### Empty results are authoritative

- `ReadSmithyShapeIndex` / `ReadSmithyShapes` returning `shapes: {}` / `shapes: []` means zero matches in the scope you queried — **not** that the query failed. Do not fall back to `grep` on `.smithy` files: the index covers the same files the parser does.
- If the selector references a trait or shape ID and the result is empty, the canonical follow-up is at most **two calls, then stop**:
  1. Re-run with `includeDependencies: true` — the referenced trait may live in a JAR.
  2. If still empty, call `ReadSmithyShapes` with `[id = 'the-id']` — an empty result there is a definitive "this ID does not exist" answer.

### Trust the selector

When your selector already filters by trait/id (e.g. `[trait|...]`), every returned shape matches by construction. Do not re-filter the response client-side by the same predicate.

### Test apps

`ListApplications`, `GetApplication`, and both `FindApplicationsBy*` finders exclude test apps (`isTest: true`) by default. The finders report `filteredTestAppMatchCount` — when non-zero, retry with `includeTestApps: true` before concluding a shape is unused / unowned. An empty importer list is never proof a shape is orphaned; use `FindSmithyShapeReferences` to walk the type closure first.

### Direct vs transitive

`FindApplicationsByImportedShapes` returns *literal* entries from each app's `metadata.smithy` `imports` list — it does **not** compute the transitive closure over Smithy type references. A shape may be in active use via another shape that transitively depends on it. Combine with `FindSmithyShapeReferences` when the question is "is anything using this at all".

### Response size hygiene

- For `ReadSmithyShapeIndex` with `includeDependencies: true`, **always** add a namespace filter (`[id|namespace = '...']` or `^= '...'`) — the un-filtered dependency index can be huge.
- Prefer one selector-batched `ReadSmithyShapes` call over N single-shape calls.
- Reach for `ListApplications` only when the question is genuinely whole-graph; if you have a shape set in hand, `FindApplicationsBy{Exported,Imported}Shapes` returns only the relevant matches.

## Output Format

Lead with the direct answer in 1–3 lines. Then a short bulleted list of supporting facts (shape IDs, source locations as `file:line`, app names, reference kinds). Skip chrome — get to the answer.

When surfacing a shape or diagnostic, include its source location so the user can jump straight to the file. Don't fabricate shape IDs, app names, or trait IDs.

## When NOT to use this skill

- Smithy backward-compatibility checks against the baseline → use the `check-compatibility` skill.
- Selector syntax reference / cheatsheet → use the `smithy-selectors` skill.
- Editing `.smithy` files or Mill build config → normal editor/bash workflow, not this skill.
- Questions about non-Smithy dependencies (regular Scala libs) → use `cellar` from AGENTS.md.
