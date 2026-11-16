# Source map

Extracted on 2026-11-10 from local committed source. Re-read the target repository at its actual ref before adapting this procedure; these snapshots do not establish deployed state.

| Repository | Commit | Path |
|---|---|---|
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `script/src/main/scala/com/siriusxm/commerce/quote/script/ConfigTableWriter.scala` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `script/src/test/scala/com/siriusxm/commerce/quote/script/ConfigTableWriterSuite.scala` |
| quote-service | `ebe8515f6121ee18ac09de1966b68c10d6d96342` | `script/src/test/scala/com/siriusxm/commerce/quote/script/RefreshCliArgsSuite.scala` |

The adjacent [sources.json](sources.json) records content hashes for verification. Resolve repositories from the active workspace or supplied local roots; do not assume the original username or checkout path. Use `git -C "$CODE_REPO" show "$SOURCE_REF:$SOURCE_PATH"` with those variables set to the selected row.

## Upstream comparison

No directly matching upstream replacement was established in the source comparison. Reuse existing local abstractions and, for Smithy, the two source skills listed above. This is not an exhaustive marketplace claim.

These procedures were written from local patterns; no upstream implementation was vendored, and no external skill/plugin is a required dependency.
