---
name: sxm-load-test
description: Add or configure Gatling load simulations in commerce-e2e using the shared scenario DSL, regional context, bounded load configuration, and ECS workflow wiring. Use for load-test authoring or result analysis, not permission to generate live traffic.
---

# Commerce load testing

## Working rules

Resolve the real repository through `dev` when invoked from an x-* workspace. Read its applicable instructions, record the source ref, inspect relevant working-tree changes, and start the required GSD workflow before edits. Keep ticket notes and the replayable command log in the workspace ticket directory; use the active task directory when no ticket exists. Use variables for user-specific command arguments and retrieve secrets from their source without recording values.

The current publishing boundary permits local preparation, not deployment. Do not push, publish images or packages, dispatch workflows, upload artifacts, invoke functions, run live smoke/load scenarios, or mutate external resources. Read-only network access is allowed. Produce local patches and a reviewable handoff; a request to use this skill does not lift that boundary. Ask about ambiguity only when it changes implementation or resource ownership. Honor branch-creation confirmation and the applicable local commit rules.

Use existing dependencies and verified project commands. Never run Docker-dependent tests or asset bundling. Inspect CDK lookup and bundling behavior before synthesis; use complete cached context and disable lookups when supported. If offline synthesis is impossible, record the limitation without substituting fabricated context. For review-only requests, inspect source without running automated gates. Do not claim cloud state from local configuration.

## Choose the scenario and load model

Read [source map](references/sources.md) and [simulation setup](references/simulation-setup.md). Establish the service/scenario, test ref, target environment/regions, account/data effects, load model, task count, duration, and measurable success criteria. Ask for missing load limits if they affect implementation; do not choose a production load by default.

## Prepare the simulation

1. Reuse or extend the shared Scenario/Step definitions and their resource-managed clients. Keep business behavior shared between integration and Gatling interpreters.
2. Add the simulation using the target's SimulationBase/toGatling pattern. Match its concurrency model and configure pacing/ramp/duration deliberately.
3. Wire configuration, simulation selection, CI choices, image artifact, ECS task inputs, regional context, and report destination as required. Inspect both workflow and Step Functions/ECS input defaults.
4. Calculate expected aggregate load across tasks and scenarios; distinguish concurrent users from request arrival rate. Define assertions and data cleanup requirements without inventing thresholds.
5. Run only local compilation/pure tests that do not generate traffic or use Docker. Export proposed run inputs, limits, stop criteria, and pending environment checks. Do not start Gatling traffic, ECS tasks, state-machine executions, workflow dispatch, or report uploads.

## Completion

Report the local files changed, source ref, decisions, checks actually run, and remaining live verification. Distinguish prepared configuration from deployed behavior. Preserve unrelated code, resource identities, and settings.
