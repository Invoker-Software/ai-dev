# Source map

Extracted on 2026-11-10 from local committed source. Re-read the target repository at its actual ref before adapting this procedure; these snapshots do not establish deployed state.

| Repository | Commit | Path |
|---|---|---|
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `infrastructure/lib/stacks/alarms-stack.ts` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `infrastructure/lib/stacks/observability-stack.ts` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `infrastructure/config/code-deploy-config.ts` |
| geo-service | `14aa218c3e472e1073c899dd76f24c2eb67335e0` | `infrastructure/lib/stages/deployment-stage.ts` |
| geo-service | `14aa218c3e472e1073c899dd76f24c2eb67335e0` | `infrastructure/lib/stacks/alarms-stack.ts` |

The adjacent [sources.json](sources.json) records content hashes for verification. Resolve repositories from the active workspace or supplied local roots; do not assume the original username or checkout path. Use `git -C "$CODE_REPO" show "$SOURCE_REF:$SOURCE_PATH"` with those variables set to the selected row.

## Upstream comparison

- [Datadog integration skill](https://github.com/DataDog/pup/blob/main/skills/dd-code-generation/SKILL.md): Optional Datadog queries/API reference; local monitor naming and stage wiring remain specific.

These procedures were written from local patterns; no upstream implementation was vendored, and no external skill/plugin is a required dependency.
