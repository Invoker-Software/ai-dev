# Source map

Extracted on 2026-11-10 from local committed source. Re-read the target repository at its actual ref before adapting this procedure; these snapshots do not establish deployed state.

| Repository | Commit | Path |
|---|---|---|
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `infrastructure/lib/stacks/secrets-stack.ts` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `infrastructure/lib/stacks/service-stack.ts` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `infrastructure/lib/secrets.ts` |
| commerce-e2e | `98522643abdd91effa889ae50f6eda3dfd50d382` | `infrastructure/lib/GithubRunSupportStack.ts` |

The adjacent [sources.json](sources.json) records content hashes for verification. Resolve repositories from the active workspace or supplied local roots; do not assume the original username or checkout path. Use `git -C "$CODE_REPO" show "$SOURCE_REF:$SOURCE_PATH"` with those variables set to the selected row.

## Upstream comparison

- [AWS serverless skills](https://github.com/awslabs/agent-plugins/tree/main/plugins/aws-serverless/skills): Generic Lambda/CDK guidance; local platform integration remains in these procedures.

These procedures were written from local patterns; no upstream implementation was vendored, and no external skill/plugin is a required dependency.
