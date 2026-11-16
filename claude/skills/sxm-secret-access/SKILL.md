---
name: sxm-secret-access
description: Wire SiriusXM regional and cross-account secret references, runtime identities, and KMS permissions into CDK services or functions. Use for access configuration and secret onboarding, not retrieving or rotating secret payloads.
---

# Secret references and access

## Working rules

Resolve the real repository through `dev` when invoked from an x-* workspace. Read its applicable instructions, record the source ref, inspect relevant working-tree changes, and start the required GSD workflow before edits. Keep ticket notes and the replayable command log in the workspace ticket directory; use the active task directory when no ticket exists. Use variables for user-specific command arguments and retrieve secrets from their source without recording values.

The current publishing boundary permits local preparation, not deployment. Do not push, publish images or packages, dispatch workflows, upload artifacts, invoke functions, run live smoke/load scenarios, or mutate external resources. Read-only network access is allowed. Produce local patches and a reviewable handoff; a request to use this skill does not lift that boundary. Ask about ambiguity only when it changes implementation or resource ownership. Honor branch-creation confirmation and the applicable local commit rules.

Use existing dependencies and verified project commands. Never run Docker-dependent tests or asset bundling. Inspect CDK lookup and bundling behavior before synthesis; use complete cached context and disable lookups when supported. If offline synthesis is impossible, record the limitation without substituting fabricated context. For review-only requests, inspect source without running automated gates. Do not claim cloud state from local configuration.

## Establish identities and ownership

Read [source map](references/sources.md) and [access wiring](references/access-wiring.md). Determine secret owner, consuming identity, environment/region, key owner, creation versus import, and runtime retrieval mechanism. Do not fetch secret payloads to inspect access configuration.

## Prepare the change

1. Trace the secret descriptor/naming helper to primary-region creation and regional replicas or an externally owned reference. Reuse existing ownership; do not create another secret merely because a lookup is unavailable locally.
2. Identify the correct runtime principal: Lambda role, ECS task role, ECS execution role for injected secrets, or test role. Place permissions on the identity that actually performs retrieval/decryption.
3. Scope secret and KMS grants and required cross-account resource policies. Preserve environment-specific human access policies. Do not copy account IDs, key aliases, or role names from a different service.
4. Add references to runtime config and required stage dependencies. Keep values and credentials out of source, generated reports, tests, and command logs.
5. Verify resource references and IAM statement shape locally. Export an access matrix and pending live checks; do not read values, rotate secrets, add live policies, or populate deployed secrets.

## Completion

Report the local files changed, source ref, decisions, checks actually run, and remaining live verification. Distinguish prepared configuration from deployed behavior. Preserve unrelated code, resource identities, and settings.
