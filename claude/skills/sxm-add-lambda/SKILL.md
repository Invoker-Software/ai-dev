---
name: sxm-add-lambda
description: Add a container-based Lambda to SiriusXM service repositories with platform CDK constructs, image build wiring, permissions, telemetry, and stage integration. Use for a new function; use event-consumer guidance for changes confined to an existing consumer.
---

# Add a platform Lambda

## Working rules

Resolve the real repository through `dev` when invoked from an x-* workspace. Read its applicable instructions, record the source ref, inspect relevant working-tree changes, and start the required GSD workflow before edits. Keep ticket notes and the replayable command log in the workspace ticket directory; use the active task directory when no ticket exists. Use variables for user-specific command arguments and retrieve secrets from their source without recording values.

The current publishing boundary permits local preparation, not deployment. Do not push, publish images or packages, dispatch workflows, upload artifacts, invoke functions, run live smoke/load scenarios, or mutate external resources. Read-only network access is allowed. Produce local patches and a reviewable handoff; a request to use this skill does not lift that boundary. Ask about ambiguity only when it changes implementation or resource ownership. Honor branch-creation confirmation and the applicable local commit rules.

Use existing dependencies and verified project commands. Never run Docker-dependent tests or asset bundling. Inspect CDK lookup and bundling behavior before synthesis; use complete cached context and disable lookups when supported. If offline synthesis is impossible, record the limitation without substituting fabricated context. For review-only requests, inspect source without running automated gates. Do not claim cloud state from local configuration.

## Inspect and choose a sibling

Read [source map](references/sources.md) and [function wiring](references/function-wiring.md). Establish the target repo/ref, purpose, runtime/package format, trigger, environment/region scope, network dependencies, data access, and expected failure handling. Prefer the current sibling in the target repo over a remote template. Do not force container packaging when the requested runtime has an established non-container pattern.

## Prepare the function

1. Add the handler and module using the target's build/runtime conventions. Keep domain computation separately testable from the Lambda adapter. Match the handler's actual event and response contract.
2. Wire image build, repository, immutable tag, architecture, entrypoint, and platform function construct. Determine every workflow/build selector needed to publish the new binary later; adding a stack alone does not produce an image.
3. Configure network access, execution role, resource grants, environment references, timeout, memory, concurrency, logging, and telemetry from requirements. Read the available platform construct version before adding fields.
4. Wire the trigger and stage dependencies. For queue/stream consumers, read [event integration](references/event-integration.md); for a substantial consumer change, use `sxm-event-consumer` if available, or follow the local reference without requiring another installed skill.
5. Add local handler/contract tests and focused infrastructure assertions appropriate to the change. Check regional/PR creation behavior and monitoring integration. Do not build a Docker image during verification.

## Completion

Report the local files changed, source ref, decisions, checks actually run, and remaining live verification. Distinguish a prepared configuration from a deployed resource. Keep application changes surgical and preserve existing names, logical IDs, policies, and unrelated settings unless the requested change requires them.
