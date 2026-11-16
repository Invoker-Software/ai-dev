---
name: sxm-ddb-global-table
description: Add or change DynamoDB global tables in SiriusXM CDK services using primary-region ownership and replica imports. Use for replicated table provisioning or planning an existing-table migration, not application item updates.
---

# DynamoDB global tables

## Working rules

Resolve the real repository through `dev` when invoked from an x-* workspace. Read its applicable instructions, record the source ref, inspect relevant working-tree changes, and start the required GSD workflow before edits. Keep ticket notes and the replayable command log in the workspace ticket directory; use the active task directory when no ticket exists. Use variables for user-specific command arguments and retrieve secrets from their source without recording values.

The current publishing boundary permits local preparation, not deployment. Do not push, publish images or packages, dispatch workflows, upload artifacts, invoke functions, run live smoke/load scenarios, or mutate external resources. Read-only network access is allowed. Produce local patches and a reviewable handoff; a request to use this skill does not lift that boundary. Ask about ambiguity only when it changes implementation or resource ownership. Honor branch-creation confirmation and the applicable local commit rules.

Use existing dependencies and verified project commands. Never run Docker-dependent tests or asset bundling. Inspect CDK lookup and bundling behavior before synthesis; use complete cached context and disable lookups when supported. If offline synthesis is impossible, record the limitation without substituting fabricated context. For review-only requests, inspect source without running automated gates. Do not claim cloud state from local configuration.

## Select the operation

Read [source map](references/sources.md) and [provisioning](references/provisioning.md). For an existing table, logical-ID change, ownership conflict, or conversion from independent regional tables, also read [migration](references/migration.md) before proposing a patch.

Establish the target service/ref, environment, primary region, replica set, table key/index schema, current owner, and whether the resource is new. Derive names and regions from the target configuration; do not inherit quote's values. Where live ownership is unavailable, mark it unverified and produce a conditional migration plan.

## Prepare the change

1. Reuse the target's platform stack, naming, tags, and replica-lookup helper. Create the global table only in the primary-region branch; other regions import their local replica.
2. Preserve existing key schema, indexes, TTL, stream settings, encryption, billing, recovery, and removal behavior. For a new resource, make those choices explicit from requirements and the nearest current sibling pattern.
3. Wire the stack into the correct stage, with its primary/replica ordering and consumer dependencies. Check how PR stages reuse persistent tables.
4. Keep existing physical names and pinned logical IDs stable. Treat changes to either as migration work rather than refactoring.
5. Prepare focused assertions for primary ownership, exact replica membership, regional imports, schema, recovery, and retention. Review synthesized differences for replacement or duplicate table creation when offline synthesis is possible.

For stateful migration, return a preflight, transition options, recovery plan, and verification plan. Do not execute a historical cutover recipe.

## Completion

Report the local files changed, source ref, decisions, checks actually run, and remaining live verification. Distinguish a prepared configuration from a deployed resource. Keep application changes surgical and preserve existing names, logical IDs, policies, and unrelated settings unless the requested change requires them.
