# Source map

Extracted on 2026-11-10 from local committed source. Re-read the target repository at its actual ref before adapting this procedure; these snapshots do not establish deployed state.

| Repository | Commit | Path |
|---|---|---|
| geo-service | `14aa218c3e472e1073c899dd76f24c2eb67335e0` | `infrastructure/lib/stacks/s3-stack.ts` |
| redemption-service | `dfed57e12013b10d8954b69cce0fd295cd47f4b6` | `infrastructure/lib/stacks/s3-bucket-stack.ts` |
| redemption-service | `dfed57e12013b10d8954b69cce0fd295cd47f4b6` | `infrastructure/lib/stacks/s3-replication-stack.ts` |
| redemption-service | `dfed57e12013b10d8954b69cce0fd295cd47f4b6` | `infrastructure/lib/stages/s3-replication-stage.ts` |
| redemption-service | `dfed57e12013b10d8954b69cce0fd295cd47f4b6` | `infrastructure/lib/utils/replication-roles.ts` |
| redemption-service | `dfed57e12013b10d8954b69cce0fd295cd47f4b6` | `infrastructure/lambda/push-replication-configuration.ts` |

The adjacent [sources.json](sources.json) records content hashes for verification. Resolve repositories from the active workspace or supplied local roots; do not assume the original username or checkout path. Use `git -C "$CODE_REPO" show "$SOURCE_REF:$SOURCE_PATH"` with those variables set to the selected row.

## Upstream comparison

- [Community CDK skill](https://github.com/zxkane/aws-skills/blob/main/plugins/aws-iac/skills/aws-cdk-development/SKILL.md): Optional CDK reference. Its blanket avoidance of explicit names conflicts with intentional platform naming/imports; do not apply it unchanged.

These procedures were written from local patterns; no upstream implementation was vendored, and no external skill/plugin is a required dependency.
