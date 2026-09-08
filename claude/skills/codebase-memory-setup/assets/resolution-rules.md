# Resolution Rules

This file is the single source of three values that are repository-specific or
machine-specific and must be resolved live, never copied from one repository
or machine to another. Any skill that needs one of these three values cites
this file by its deployed path and does not restate the rule in its own body.
A second copy of a rule living in a skill's own prose is exactly the
divergence this file exists to prevent — if a rule changes, it changes here
and nowhere else.

Two skills cite this file today: `codebase-memory-setup` (the run-once
per-repository setup this file ships alongside) and `gsd-codebase-reindex`
(the automatic re-index mechanism, which needs the same three values and
re-resolves them itself rather than reading a record either skill leaves
behind).

## Rule 1 — The project name

Resolve the repository root with `git rev-parse --show-toplevel`. Run
`codebase-memory-mcp cli list_projects` and take the `name` of the entry
whose `root_path` equals that root, compared as absolute paths.

No matching entry means the repository is not indexed. This rule does not
decide what to do about that — the citing skill states its own behavior
(setup indexes; reindex halts).

On a first index the name is chosen, not resolved: the default is the
repository directory's own basename, and it is what gets passed to
`index_repository --name`.

Never carry a name across from another repository. The name is the key every
later query, every generated module, and both agents' root-path resolution
use — a wrong one produces empty results rather than an error, which is a
harder failure to notice than a loud one.

## Rule 2 — The deny list

Run `codebase-memory-mcp cli check_index_coverage --project <name> --scopes .`
and read `scopes[0].entries`, an array of `{ path, kind, detail }` objects.

The deny list is the `path` of every entry whose `kind` is exactly
`not_indexed_dir`. Discard every other kind — the others describe files
rather than directories, and adding a file entry to a directory-prefix deny
list silently suppresses matching for real source changes that happen to
share that path prefix.

Two properties of this rule, recorded explicitly because both were verified
live and both are easy to get wrong:

1. **The `--scopes` argument must be the bare `.`.** The quoted JSON-array
   form (`--scopes '["."]'`) is accepted without complaint — no error, no
   warning — and returns an empty result (`total: 0`, `entries: []`,
   `status: "no_recorded_issue"`). An empty result reads as "nothing is
   excluded," which is wrong; it means the query itself was malformed, not
   that the repository has full coverage.
2. **The result is a snapshot at the moment it is taken, not a live query.**
   A caller that bakes this list into a generated file must say when it was
   taken and what re-running the query costs, so a reader does not mistake a
   stale snapshot for a currently-accurate one.

## Rule 3 — The binary path

Resolve the absolute path of the `codebase-memory-mcp` executable with
`command -v codebase-memory-mcp`.

This value is machine-local by construction and belongs only in a file that
is itself machine-local — a path resolved on one machine and committed for
use on another is wrong, the same way a project name from one repository is
wrong when carried into another.

This value is resolved at all, rather than left to a bare command name,
because a bare name resolves fine in a developer's own interactive shell but
a hook runs in a minimal environment where the directory the binary lives in
was measured to be absent from `PATH`. Resolving the absolute path once, at
setup time, and writing it into a machine-local file avoids that gap.

## Version note

These command shapes and response fields were verified against
`codebase-memory-mcp` 0.10.8. A caller that finds a different shape on a
newer or older version should treat this file as the thing to correct,
rather than working around the mismatch locally in whichever skill
encountered it.
