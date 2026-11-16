---
name: sxm-observability
description: Onboard or change SiriusXM service telemetry and CDK-managed ECS, ALB, or Lambda monitors with correct naming, tags, stage ownership, and alert routing. Use for operational monitoring configuration rather than generic application logging.
---

# Service observability

## Working rules

Resolve the real repository through `dev` when invoked from an x-* workspace. Read its applicable instructions, record the source ref, inspect relevant working-tree changes, and start the required GSD workflow before edits. Keep ticket notes and the replayable command log in the workspace ticket directory; use the active task directory when no ticket exists. Use variables for user-specific command arguments and retrieve secrets from their source without recording values.

The current publishing boundary permits local preparation, not deployment. Do not push, publish images or packages, dispatch workflows, upload artifacts, invoke functions, run live smoke/load scenarios, or mutate external resources. Read-only network access is allowed. Produce local patches and a reviewable handoff; a request to use this skill does not lift that boundary. Ask about ambiguity only when it changes implementation or resource ownership. Honor branch-creation confirmation and the applicable local commit rules.

Use existing dependencies and verified project commands. Never run Docker-dependent tests or asset bundling. Inspect CDK lookup and bundling behavior before synthesis; use complete cached context and disable lookups when supported. If offline synthesis is impossible, record the limitation without substituting fabricated context. For review-only requests, inspect source without running automated gates. Do not claim cloud state from local configuration.

## Trace telemetry to monitors

Read [source map](references/sources.md) and [monitor wiring](references/monitor-wiring.md). Establish the service/component, deployment identity, stage/region/sub-environment, telemetry source, monitor owner, and intended responder. Read the actual query/tag conventions before adding a monitor.

## Prepare the change

1. Trace runtime service/version/env/component tags through logging/tracing wrappers, platform constructs, and monitor filters. Use the same resolved identity at both ends.
2. Reuse current ECS, ALB, Lambda, and default-observability constructs. Keep primary-region-only and PR/sub-environment creation behavior aligned with the target stage.
3. Select failure/latency/availability signals from the requested behavior. Define thresholds, evaluation window, missing-data behavior, and routing based on requirements or an existing approved policy; do not invent service SLOs.
4. Distinguish an observability monitor from a CodeDeploy rollback alarm. Wire release blocking only when requested and supported by the rollout configuration.
5. Verify monitor identifiers, filters, regional ownership, and stage dependencies locally. Report telemetry/query/live-alert validation as pending unless supported by permitted read-only evidence. Do not create monitors through external APIs, emit test metrics, or send alerts.

## Completion

Report the local files changed, source ref, decisions, checks actually run, and remaining live verification. Distinguish prepared configuration from deployed behavior. Preserve unrelated code, resource identities, and settings.
