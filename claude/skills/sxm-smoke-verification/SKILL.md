---
name: sxm-smoke-verification
description: Prepare or analyze multi-region SiriusXM smoke verification with explicit revision, environment, role chain, endpoint, and assertion evidence. Use for smoke-suite authoring and result assessment; invocation does not authorize live requests.
---

# Regional smoke verification

## Working rules

Resolve the real repository through `dev` when invoked from an x-* workspace. Read its applicable instructions, record the source ref, inspect relevant working-tree changes, and start the required GSD workflow before edits. Keep ticket notes and the replayable command log in the workspace ticket directory; use the active task directory when no ticket exists. Use variables for user-specific command arguments and retrieve secrets from their source without recording values.

The current publishing boundary permits local preparation, not deployment. Do not push, publish images or packages, dispatch workflows, upload artifacts, invoke functions, run live smoke/load scenarios, or mutate external resources. Read-only network access is allowed. Produce local patches and a reviewable handoff; a request to use this skill does not lift that boundary. Ask about ambiguity only when it changes implementation or resource ownership. Honor branch-creation confirmation and the applicable local commit rules.

Use existing dependencies and verified project commands. Never run Docker-dependent tests or asset bundling. Inspect CDK lookup and bundling behavior before synthesis; use complete cached context and disable lookups when supported. If offline synthesis is impossible, record the limitation without substituting fabricated context. For review-only requests, inspect source without running automated gates. Do not claim cloud state from local configuration.

## Establish the verification target

Read [source map](references/sources.md) and [smoke procedure](references/smoke-procedure.md). Identify the requested environment/regions, application artifact, smoke-suite ref, endpoint routing, required auth chain, and expected behavior. Separate application revision from test revision.

## Prepare or assess verification

1. Inspect the existing smoke module, configuration loaders, client construction, scenarios, and workflow. Determine whether scenarios mutate accounts or external systems before proposing execution.
2. Define concrete success/error assertions for the requested behavior. Include identity/version evidence where available; HTTP 200 alone does not establish the right deployment or business result.
3. Wire the requested version and region inputs through workflow/config. Reuse the current role-assumption chain and secret references, with no credential values in artifacts.
4. Compile/test only the local, Docker-free portions appropriate to an authoring change. A smoke/test command can call deployed services; compilation and execution must remain separate.
5. Export a per-region matrix with app revision evidence, test revision, endpoint/config, assertion outcomes, and authentication/environment failures. Use not-run/unverified when there was no live run. Do not issue live requests or dispatch the smoke workflow under the publishing boundary.

## Completion

Report the local files changed, source ref, decisions, checks actually run, and remaining live verification. Distinguish prepared configuration from deployed behavior. Preserve unrelated code, resource identities, and settings.
