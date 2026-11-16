---
name: sxm-service-deployment
description: Prepare SiriusXM service deployment wiring across CDK prerequisites, application stages, ECR artifacts, secrets, blue-green settings, observability, and reusable workflows. Use for service onboarding or deployment configuration changes, not authorization to deploy.
---

# Service deployment wiring

## Working rules

Resolve the real repository through `dev` when invoked from an x-* workspace. Read its applicable instructions, record the source ref, inspect relevant working-tree changes, and start the required GSD workflow before edits. Keep ticket notes and the replayable command log in the workspace ticket directory; use the active task directory when no ticket exists. Use variables for user-specific command arguments and retrieve secrets from their source without recording values.

The current publishing boundary permits local preparation, not deployment. Do not push, publish images or packages, dispatch workflows, upload artifacts, invoke functions, run live smoke/load scenarios, or mutate external resources. Read-only network access is allowed. Produce local patches and a reviewable handoff; a request to use this skill does not lift that boundary. Ask about ambiguity only when it changes implementation or resource ownership. Honor branch-creation confirmation and the applicable local commit rules.

Use existing dependencies and verified project commands. Never run Docker-dependent tests or asset bundling. Inspect CDK lookup and bundling behavior before synthesis; use complete cached context and disable lookups when supported. If offline synthesis is impossible, record the limitation without substituting fabricated context. For review-only requests, inspect source without running automated gates. Do not claim cloud state from local configuration.

## Inspect the deployment contract

Read [source map](references/sources.md), [stage wiring](references/stage-wiring.md), and [release handoff](references/release-handoff.md). Determine the actual target repo/ref, service/workload, environment matrix, primary region, existing pipeline, artifact identity, and stateful dependencies. A configured stage is not evidence of a deployed environment.

## Prepare the change

1. Trace the application entrypoint through stage definitions, environment setup, prerequisites, application stage, and observability stage. Reuse the target's platform constructs and installed package versions.
2. Wire image repository/build/publication configuration, version input, and application image tag. Preserve the same artifact identity through promotion. Do not create a new release workflow when an existing reusable workflow supplies it.
3. Connect persistent resources, regional secrets and references, runtime settings, task execution/application roles, health checks, and any sidecars. Distinguish prerequisites from resources owned by the application stage.
4. Configure rollout and monitoring per environment. Preserve the target's PR/sub-environment naming and isolation. Review default-region-only resources and primary/replica deployment order.
5. Update workflow path filters and dependency chains when required by the added files. Inspect the relevant reusable workflow contract rather than assuming every sibling has the same inputs.
6. Run only local, Docker-free checks justified by the change. Review stateful replacements, IAM changes, stage membership, artifact references, and rollout configuration in the diff when offline synthesis is possible.

Return a local patch and release handoff. Do not dispatch workflows or claim deployment/smoke success from generated configuration.

## Completion

Report the local files changed, source ref, decisions, checks actually run, and remaining live verification. Distinguish a prepared configuration from a deployed resource. Keep application changes surgical and preserve existing names, logical IDs, policies, and unrelated settings unless the requested change requires them.
