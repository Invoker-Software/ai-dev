# Event contracts

For S3 notifications, identify the actual bucket owner and notification manager. Attach the invocation permission, event filter, and notification without replacing unrelated rules. Geo filters object-created notifications to CSV files and sends chunk messages to SQS. Do not assume every object event has the same delivery/duplication behavior as an HTTP request.

For SQS, coordinate handler batch-failure response, event-source `reportBatchItemFailures`, batch size/window, function timeout, queue visibility, redrive/DLQ, and concurrency. Verify current AWS timeout/visibility guidance before choosing values; a historical visibility timeout merely greater than the function timeout is not a general sizing rule. Geo's updater uses batch size 1 and partial failures. Eligibility adds a DLQ with maxReceiveCount 3; geo's queue source does not establish an equivalent DLQ policy.

For Kinesis or DynamoDB Streams, establish ordering/partition behavior, checkpoint/replay expectations, starting position, batch/window, poison-record handling, record age/retry policy, partial failures, and failure destinations as required. Coordinate stream/KMS permissions and any enhanced-fan-out consumer registration. Do not reset an existing event-source mapping to LATEST or replay history as a side effect of adding a function.

Local checks should exercise success, duplicate delivery where relevant, malformed records, and mixed successful/failed batches against the actual response schema. Keep Docker-backed integration evidence explicitly pending.
