# Source map

Extracted on 2026-11-10 from local committed source. Re-read the target repository at its actual ref before adapting this procedure; these snapshots do not establish deployed state.

| Repository | Commit | Path |
|---|---|---|
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `infrastructure/bin/app.ts` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `infrastructure/lib/setup-env-stage.ts` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `infrastructure/lib/stages/prereqs-stage.ts` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `infrastructure/lib/stages/deployment-stage.ts` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `infrastructure/lib/stacks/service-stack.ts` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `infrastructure/config/code-deploy-config.ts` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `.github/workflows/main.yml` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `.github/workflows/deploy-prereqs.yml` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `infrastructure/package.json` |
| gapa-service | `4e658c892f0e11de74ea9187be5b1f8240378565` | `infrastructure/lib/stages/deployment-stage.ts` |

The adjacent [sources.json](sources.json) records content hashes for verification. Resolve repositories from the active workspace or supplied local roots; do not assume the original username or checkout path. Use `git -C "$CODE_REPO" show "$SOURCE_REF:$SOURCE_PATH"` with those variables set to the selected row.

## Upstream comparison

- [AWS serverless skills](https://github.com/awslabs/agent-plugins/tree/main/plugins/aws-serverless/skills): Generic Lambda/CDK guidance; local platform integration remains in these procedures.
- [GitHub Actions hardening](https://github.com/github/awesome-copilot/blob/main/skills/github-actions-hardening/SKILL.md): Optional general workflow security reference; does not replace the platform pipeline contract.

These procedures were written from local patterns; no upstream implementation was vendored, and no external skill/plugin is a required dependency.
