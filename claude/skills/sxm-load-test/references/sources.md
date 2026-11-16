# Source map

Extracted on 2026-11-10 from local committed source. Re-read the target repository at its actual ref before adapting this procedure; these snapshots do not establish deployed state.

| Repository | Commit | Path |
|---|---|---|
| commerce-e2e | `98522643abdd91effa889ae50f6eda3dfd50d382` | `load-tests/src/main/scala/com/siriusxm/commerce/e2e/gatling/SimulationBase.scala` |
| commerce-e2e | `98522643abdd91effa889ae50f6eda3dfd50d382` | `load-tests/src/main/scala/com/siriusxm/commerce/e2e/gatling/GiftCardServiceSimulation.scala` |
| commerce-e2e | `98522643abdd91effa889ae50f6eda3dfd50d382` | `load-tests/src/main/scala/com/siriusxm/commerce/e2e/config/LoadTestConfig.scala` |
| commerce-e2e | `98522643abdd91effa889ae50f6eda3dfd50d382` | `infrastructure/lib/LoadTestingStack.ts` |
| commerce-e2e | `98522643abdd91effa889ae50f6eda3dfd50d382` | `.github/workflows/run_load_ecs.yml` |
| commerce-e2e | `98522643abdd91effa889ae50f6eda3dfd50d382` | `common/src/main/scala/com/siriusxm/commerce/e2e/common/Scenario.scala` |

The adjacent [sources.json](sources.json) records content hashes for verification. Resolve repositories from the active workspace or supplied local roots; do not assume the original username or checkout path. Use `git -C "$CODE_REPO" show "$SOURCE_REF:$SOURCE_PATH"` with those variables set to the selected row.

## Upstream comparison

No directly matching upstream replacement was established in the source comparison. Reuse existing local abstractions and, for Smithy, the two source skills listed above. This is not an exhaustive marketplace claim.

These procedures were written from local patterns; no upstream implementation was vendored, and no external skill/plugin is a required dependency.
