---
name: sxm-event-consumer
description: Configure or change existing SiriusXM SQS, Kinesis, or DynamoDB-stream consumers with explicit batching, checkpoint, retry, permissions, and recovery behavior. Use for consumer semantics; new Lambda scaffolding belongs to sxm-add-lambda.
---

# Event consumers and recovery

## Working rules

Resolve the real repository through `dev` when invoked from an x-* workspace. Read its applicable instructions, record the source ref, inspect relevant working-tree changes, and start the required GSD workflow before edits. Keep ticket notes and the replayable command log in the workspace ticket directory; use the active task directory when no ticket exists. Use variables for user-specific command arguments and retrieve secrets from their source without recording values.

The current publishing boundary permits local preparation, not deployment. Do not push, publish images or packages, dispatch workflows, upload artifacts, invoke functions, run live smoke/load scenarios, or mutate external resources. Read-only network access is allowed. Produce local patches and a reviewable handoff; a request to use this skill does not lift that boundary. Ask about ambiguity only when it changes implementation or resource ownership. Honor branch-creation confirmation and the applicable local commit rules.

Use existing dependencies and verified project commands. Never run Docker-dependent tests or asset bundling. Inspect CDK lookup and bundling behavior before synthesis; use complete cached context and disable lookups when supported. If offline synthesis is impossible, record the limitation without substituting fabricated context. For review-only requests, inspect source without running automated gates. Do not claim cloud state from local configuration.

## Choose the delivery model

Read [source map](references/sources.md) and [consumer behavior](references/consumer-behavior.md). Identify event source, current mapping, producer schema, consumer role, side effects, ordering/idempotency requirements, and intended recovery behavior. For a new function, follow the target's Lambda setup as well; this skill does not require another installed skill.

## Prepare the change

1. Trace decoding, dispatch, processing, failure response, and persistence. Establish when a record is considered complete and what happens if a downstream side effect succeeds but acknowledgment fails.
2. For SQS, coordinate batch size/window, partial-batch response, visibility, retry/redrive, DLQ, and concurrency. For streams, coordinate starting position, partition order, checkpointing, partial failures, retry/age limits, and failure destination.
3. Reuse the target's stream/queue references and platform construct. Scope stream reads, consumer registration, table/queue writes, and KMS access. Preserve mapping identity and start position unless intentionally changing replay behavior.
4. Add focused local tests for mixed outcomes, malformed input, retryable versus permanent failure, ordering, and duplicate delivery as required by the actual contract. Check infrastructure settings agree with handler output.
5. Prepare a recovery handoff with failure signals, bounded replay criteria, duplicate-side-effect implications, and checks after recovery. Do not replay, purge, redrive, reset checkpoints, or invoke a live consumer.

## Completion

Report the local files changed, source ref, decisions, checks actually run, and remaining live verification. Distinguish prepared configuration from deployed behavior. Preserve unrelated code, resource identities, and settings.
