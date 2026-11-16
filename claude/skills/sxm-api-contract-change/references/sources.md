# Source map

Extracted on 2026-11-10 from local committed source. Re-read the target repository at its actual ref before adapting this procedure; these snapshots do not establish deployed state.

| Repository | Commit | Path |
|---|---|---|
| api-registry | `65722ff3c64bfa2cb1f988db9316e5311531c04a` | `.claude/skills/smithy-docs-navigator/SKILL.md` |
| api-registry | `65722ff3c64bfa2cb1f988db9316e5311531c04a` | `.claude/skills/smithy-selectors/SKILL.md` |
| api-registry | `65722ff3c64bfa2cb1f988db9316e5311531c04a` | `mill-wrapper.sh` |
| api-registry | `65722ff3c64bfa2cb1f988db9316e5311531c04a` | `build.mill` |
| api-registry | `65722ff3c64bfa2cb1f988db9316e5311531c04a` | `.github/workflows/main.yml` |
| api-registry | `65722ff3c64bfa2cb1f988db9316e5311531c04a` | `CLAUDE.md` |

| api-registry | `65722ff3c64bfa2cb1f988db9316e5311531c04a` | `AGENTS.md` |

The adjacent [sources.json](sources.json) records content hashes for verification. Resolve repositories from the active workspace or supplied local roots; do not assume the original username or checkout path. Use `git -C "$CODE_REPO" show "$SOURCE_REF:$SOURCE_PATH"` with those variables set to the selected row.

## Upstream comparison

No directly matching upstream replacement was established in the source comparison. Reuse existing local abstractions and, for Smithy, the two source skills listed above. This is not an exhaustive marketplace claim.

These procedures were written from local patterns; no upstream implementation was vendored, and no external skill/plugin is a required dependency.
