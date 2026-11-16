# Source map

Extracted on 2026-11-10 from local committed source. Re-read the target repository at its actual ref before adapting this procedure; these snapshots do not establish deployed state.

| Repository | Commit | Path |
|---|---|---|
| offer-service | `40fb548765c48b14878d339d4af75d779e776ce8` | `infrastructure/lib/stacks/stripe-sync-stack.ts` |
| redemption-service | `dfed57e12013b10d8954b69cce0fd295cd47f4b6` | `infrastructure/lib/stacks/kinesis-consumers-stack.ts` |
| eligibility-service | `19e3ad9bf3f3c0c6ff32a4dc458797d219607494` | `infrastructure/lib/stacks/link-account-sqs-stack.ts` |
| geo-service | `14aa218c3e472e1073c899dd76f24c2eb67335e0` | `infrastructure/lib/stacks/canada-score-sqs-stack.ts` |
| geo-service | `14aa218c3e472e1073c899dd76f24c2eb67335e0` | `infrastructure/lib/stacks/canada-score-updater-stack.ts` |

The adjacent [sources.json](sources.json) records content hashes for verification. Resolve repositories from the active workspace or supplied local roots; do not assume the original username or checkout path. Use `git -C "$CODE_REPO" show "$SOURCE_REF:$SOURCE_PATH"` with those variables set to the selected row.

## Upstream comparison

- [AWS serverless skills](https://github.com/awslabs/agent-plugins/tree/main/plugins/aws-serverless/skills): Generic Lambda/CDK guidance; local platform integration remains in these procedures.
- [Confluent skills](https://github.com/confluentinc/agent-skills): Kafka/schema/CDC guidance; not a direct replacement for local Kinesis consumers.

These procedures were written from local patterns; no upstream implementation was vendored, and no external skill/plugin is a required dependency.
