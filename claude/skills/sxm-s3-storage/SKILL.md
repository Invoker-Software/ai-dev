---
name: sxm-s3-storage
description: Provision or change S3 buckets, notifications, and regional replication in SiriusXM CDK repositories using local naming, KMS, IAM boundaries, and stage conventions. Use for storage infrastructure rather than object uploads.
---

# S3 storage and replication

## Working rules

Resolve the real repository through `dev` when invoked from an x-* workspace. Read its applicable instructions, record the source ref, inspect relevant working-tree changes, and start the required GSD workflow before edits. Keep ticket notes and the replayable command log in the workspace ticket directory; use the active task directory when no ticket exists. Use variables for user-specific command arguments and retrieve secrets from their source without recording values.

The current publishing boundary permits local preparation, not deployment. Do not push, publish images or packages, dispatch workflows, upload artifacts, invoke functions, run live smoke/load scenarios, or mutate external resources. Read-only network access is allowed. Produce local patches and a reviewable handoff; a request to use this skill does not lift that boundary. Ask about ambiguity only when it changes implementation or resource ownership. Honor branch-creation confirmation and the applicable local commit rules.

Use existing dependencies and verified project commands. Never run Docker-dependent tests or asset bundling. Inspect CDK lookup and bundling behavior before synthesis; use complete cached context and disable lookups when supported. If offline synthesis is impossible, record the limitation without substituting fabricated context. For review-only requests, inspect source without running automated gates. Do not claim cloud state from local configuration.

## Select the storage task

Read [source map](references/sources.md) and [bucket setup](references/bucket-setup.md). For replication, also read [replication](references/replication.md). Establish ownership, environment/region scope, object access, encryption, retention/lifecycle, notifications, and whether the bucket already exists.

## Prepare the storage change

1. Reuse the target's platform naming and stage ownership. Distinguish creating a regional bucket from importing an existing bucket reference into another stack.
2. Specify access, encryption/key ownership, versioning, lifecycle, and removal behavior for the actual workload. Preserve existing bucket names, keys, and objects. Do not copy incompatible settings across geo's ingestion bucket and redemption's replicated buckets.
3. Wire resource policies, application grants, KMS grants, and any notification-helper permissions boundary. Trace bucket and key policies together for cross-account consumers.
4. Add notifications without replacing unrelated configuration. For replication, prepare the complete topology and custom-resource lifecycle behavior before wiring deployment stages.
5. Prepare focused infrastructure assertions covering creation/import behavior, encryption, versioning where required, retention, policies, filters, and stage ordering. Use offline synthesis only when it avoids Docker and cloud lookups.

The inspected redemption pattern demonstrates regional replication. Cross-account S3 setup needs additional evidence for ownership and destination policies; do not present it as already implemented by that source.

## Completion

Report the local files changed, source ref, decisions, checks actually run, and remaining live verification. Distinguish a prepared configuration from a deployed resource. Keep application changes surgical and preserve existing names, logical IDs, policies, and unrelated settings unless the requested change requires them.
