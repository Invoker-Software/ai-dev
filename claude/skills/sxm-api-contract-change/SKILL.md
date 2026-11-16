---
name: sxm-api-contract-change
description: Change SiriusXM Smithy API contracts with authoritative specification lookup, shape-impact analysis, compatibility validation, and downstream code-generation planning. Use for registry or service-model changes rather than generated Scala edits.
---

# API contract changes

## Working rules

Resolve the real repository through `dev` when invoked from an x-* workspace. Read its applicable instructions, record the source ref, inspect relevant working-tree changes, and start the required GSD workflow before edits. Keep ticket notes and the replayable command log in the workspace ticket directory; use the active task directory when no ticket exists. Use variables for user-specific command arguments and retrieve secrets from their source without recording values.

The current publishing boundary permits local preparation, not deployment. Do not push, publish images or packages, dispatch workflows, upload artifacts, invoke functions, run live smoke/load scenarios, or mutate external resources. Read-only network access is allowed. Produce local patches and a reviewable handoff; a request to use this skill does not lift that boundary. Ask about ambiguity only when it changes implementation or resource ownership. Honor branch-creation confirmation and the applicable local commit rules.

Use existing dependencies and verified project commands. Never run Docker-dependent tests or asset bundling. Inspect CDK lookup and bundling behavior before synthesis; use complete cached context and disable lookups when supported. If offline synthesis is impossible, record the limitation without substituting fabricated context. For review-only requests, inspect source without running automated gates. Do not claim cloud state from local configuration.

## Locate the contract and consumers

Read [source map](references/sources.md) and [contract procedure](references/contract-procedure.md). Determine registry versus local service model ownership, namespace/service/operation, source ref, expected wire behavior, and affected consumers. Model semantics come from the service's authoritative behavior source, not an abandoned port.

## Prepare the contract change

1. Resolve exact syntax/trait rules from the canonical Smithy source when needed. Use existing smithy-docs-navigator and smithy-selectors skills if available; [the reference](references/contract-procedure.md) supplies the essential procedure without requiring those skills or a particular tool.
2. Trace shapes, operation bindings, error models, public/internal exposure, registry metadata, and codegen consumers. Assess backward compatibility before adding required fields or changing serialization.
3. Edit source Smithy only. Preserve the registry's naming, ownership/CODEOWNERS boundaries, and service wire contract. Do not hand-edit generated Scala or release metadata to bypass the normal build.
4. For implementation changes, run the target's justified local formatting/model/compatibility checks in the documented order with existing credentials/dependencies. For review-only work, inspect source without running gates. Do not publish artifacts or call external registry mutation APIs.
5. Prepare downstream dependency/codegen adoption and behavior-test changes. Export compatibility status, affected consumers, and any pending release/version dependency. Do not claim a registry contract is available to consumers until the required release exists.

## Completion

Report the local files changed, source ref, decisions, checks actually run, and remaining live verification. Distinguish prepared configuration from deployed behavior. Preserve unrelated code, resource identities, and settings.
