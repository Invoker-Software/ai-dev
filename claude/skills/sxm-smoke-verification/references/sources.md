# Source map

Extracted on 2026-11-10 from local committed source. Re-read the target repository at its actual ref before adapting this procedure; these snapshots do not establish deployed state.

| Repository | Commit | Path |
|---|---|---|
| geo-service | `14aa218c3e472e1073c899dd76f24c2eb67335e0` | `.github/workflows/smoke-test.yml` |
| geo-service | `14aa218c3e472e1073c899dd76f24c2eb67335e0` | `smoke/src/test/scala/com/siriusxm/commerce/geo/smoke/BaseSmokeSpec.scala` |
| geo-service | `14aa218c3e472e1073c899dd76f24c2eb67335e0` | `smoke/src/test/scala/com/siriusxm/commerce/geo/smoke/SmokeTestConfig.scala` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `.github/workflows/main.yml` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `smoke/src/test/scala/com/siriusxm/commerce/quote/.gitkeep` |

The adjacent [sources.json](sources.json) records content hashes for verification. Resolve repositories from the active workspace or supplied local roots; do not assume the original username or checkout path. Use `git -C "$CODE_REPO" show "$SOURCE_REF:$SOURCE_PATH"` with those variables set to the selected row.

## Upstream comparison

- [GitHub Actions hardening](https://github.com/github/awesome-copilot/blob/main/skills/github-actions-hardening/SKILL.md): Optional general workflow security reference; does not replace the platform pipeline contract.

These procedures were written from local patterns; no upstream implementation was vendored, and no external skill/plugin is a required dependency.
