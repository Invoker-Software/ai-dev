---
name: sxm-config-replacement
description: Prepare scoped SiriusXM configuration refresh or replacement with dry-run evidence, protected failed inputs, upsert-before-delete ordering, and partial-write checks. Use for configuration data operations, not DynamoDB table topology changes.
---

# Configuration refresh and replacement

## Working rules

Resolve the real repository through `dev` when invoked from an x-* workspace. Read its applicable instructions, record the source ref, inspect relevant working-tree changes, and start the required GSD workflow before edits. Keep ticket notes and the replayable command log in the workspace ticket directory; use the active task directory when no ticket exists. Use variables for user-specific command arguments and retrieve secrets from their source without recording values.

The current publishing boundary permits local preparation, not deployment. Do not push, publish images or packages, dispatch workflows, upload artifacts, invoke functions, run live smoke/load scenarios, or mutate external resources. Read-only network access is allowed. Produce local patches and a reviewable handoff; a request to use this skill does not lift that boundary. Ask about ambiguity only when it changes implementation or resource ownership. Honor branch-creation confirmation and the applicable local commit rules.

Use existing dependencies and verified project commands. Never run Docker-dependent tests or asset bundling. Inspect CDK lookup and bundling behavior before synthesis; use complete cached context and disable lookups when supported. If offline synthesis is impossible, record the limitation without substituting fabricated context. For review-only requests, inspect source without running automated gates. Do not claim cloud state from local configuration.

## Establish source and replacement scope

Read [source map](references/sources.md) and [replacement procedure](references/replacement-procedure.md). Identify the authoritative input snapshot/ref, target schema, country/tenant scope, operation mode, active writers, and expected additions/updates/removals. Do not infer live data from a committed fixture.

## Prepare or inspect replacement

1. Trace the existing writer and CLI mode rather than constructing raw batch-delete commands. Confirm dry-run is genuinely side-effect-free, including all downstream code paths.
2. Capture or consume permitted local input evidence, derive proposed keys, and calculate exact scoped stale candidates using the same pure logic as replacement. Report skipped/failed inputs and protected rows.
3. Verify writes complete successfully before deletion begins. Partial/unidentified failures must prevent unsafe deletion according to the target's protection rules; do not catch a batch failure and continue.
4. Add focused Docker-free tests for the change: scope boundaries, failed input protection, version/baseline keys, partial writes, and deletion ordering. Use in-memory implementations, not a live table.
5. Export a dry-run/result interpretation and a proposed execution/recovery handoff. Do not scan sensitive live data unnecessarily, write the table, delete stale keys, or upload captures under the publishing boundary. A dry run is not a completed refresh.

## Completion

Report the local files changed, source ref, decisions, checks actually run, and remaining live verification. Distinguish prepared configuration from deployed behavior. Preserve unrelated code, resource identities, and settings.
