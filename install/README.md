# install/ — write contract

What `install/cli.js` writes, and where, when run as:

```
npx github:Invoker-Software/ai-dev <config-dir> [<config-dir> ...]
```

## Into each named config directory

For every config directory named on the command line:

- **Discovered artifacts.** Every file under `claude/agents/*.md` and every
  file inside a `claude/skills/*` directory that has a `SKILL.md`, deployed
  to the matching path under that config directory. A file is written only
  when its content differs from what is already there.
- **MCP registration.** `codebase-memory-mcp` is registered via
  `claude mcp add` (a leftover `vexp` registration is removed first,
  best-effort). Never hand-edits `.claude.json`.
- **The manifest.** `<config-dir>/ai-dev/manifest.json`, recording the
  installed commit and the deployed artifact list. Rewritten on every
  successful run.

## Agent tool grant (in place, same directory)

The installer also appends `mcp__codebase-memory-mcp__*` to the `tools:`
frontmatter of every `gsd-*.md` agent definition already present in that
same config directory's `agents/` folder — files the installer did not
deploy and does not own, put there by a separate `gsd-core` install. This
exists so a GSD agent can read the code graph without a separate manual
step.

It never touches a file this installer itself deploys: the grant step is
filtered to the `gsd-` filename prefix, which is disjoint from every
artifact under `claude/agents/`. Without that filter, the two stages would
rewrite each other's output on alternating runs.

Idempotent and dry-run safe: an already-granted definition is left byte-
identical, and a definition whose `tools:` value the installer cannot
safely rewrite (a quoted scalar, a flow sequence, or no `tools:` key at
all) is skipped and reported rather than corrupted.

## Home-level write (contract change)

The installer also writes one file **outside** every config directory
named on the command line: `~/.gsd/defaults.json` (or the path named by
`AI_DEV_GSD_DEFAULTS`, when set — this is the installer's test-injection
seam, and the only reason this file is never touched by `npm test`).

This is new: every other write this installer makes lands inside a config
directory the caller explicitly named. This one does not, because it
exists to survive an event the in-place grant above cannot: a later
`gsd-core` install overwrites the agent definitions the in-place grant just
edited, discarding that grant. Merging the same grant into
`~/.gsd/defaults.json`'s wildcard `agent_tools` selector (`"*"`) is what
lets `gsd-core` re-derive it the next time it runs.

The write is a merge, never an overwrite: unrelated top-level keys and
every other `agent_tools` selector are preserved untouched, and the grant
is added to the wildcard selector's existing entries rather than replacing
them. If the grant is already present, nothing is written at all — the
file's existing formatting is never reflowed. A file this installer cannot
parse, or whose `agent_tools` (or wildcard selector) is not the shape it
expects, makes the run throw and name the file, rather than being
overwritten.

## `--dry-run`

Identical discovery and comparison run for every write described above.
Nothing is written anywhere — including zero writes to the home-level
`~/.gsd/defaults.json` (or its `AI_DEV_GSD_DEFAULTS` override).
