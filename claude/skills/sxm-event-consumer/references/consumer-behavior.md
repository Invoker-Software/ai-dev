# Queue and stream behavior

Geo's updater uses SQS batch size 1 with `reportBatchItemFailures`; eligibility's link-account queue additionally defines a DLQ and maxReceiveCount 3. These implementations differ. Do not claim geo has a DLQ or use a sibling's visibility value as a universal rule. Verify current AWS visibility-timeout guidance for the selected timeout and batching model when configuring a queue.

Offer's stripe-sync stack registers a stream consumer, grants Kinesis read/registration and KMS decrypt permissions, and creates a mapping with partial failures. Its calling code supplies LATEST and batch size 30 while the helper has a different default. Read call-site values, not only helper defaults. Changing these properties can alter replay, batching, and recovery.

For partial batches, verify the actual AWS response shape and record identifiers accepted for that event source; SQS item IDs and stream sequence checkpoints are not interchangeable. A configured event-source flag alone does not prove the handler reports failures correctly.

Map schema errors, unknown event types, downstream failures, and already-processed records to deliberate outcomes. Preserve per-entity ordering where required. Record whether idempotency comes from keys, conditional writes, an existing deduplication store, or a downstream contract; do not introduce new infrastructure without a demonstrated requirement.

Use existing pure handlers and in-memory dependencies for local verification. Docker-backed parity or integration suites remain pending. Do not run live failure injection, replay, or redrive during setup. A recovery plan must identify the source window, affected consumer, expected duplicate side effects, stop criteria, and validation evidence without claiming that data was recovered.
