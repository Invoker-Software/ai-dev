---
name: setup-x-workspace
description: Set up a local x-* working repository with dev/ pointing to an existing code repository, plus CLAUDE.md and AGENTS.md carrying the workspace conventions and adapted project rules. Use when creating or repairing this two-repository working environment.
---

# Set up an x-* workspace

Create an independent, local-only Git repository for instructions, planning, ticket artifacts, and tooling. Its `dev` symlink points to an existing real code repository. Application source and history belong in that repository.

## Inputs and inspection

Infer the real repository and desired sibling `x-<name>` directory from the request and local context. Ask only if the target is ambiguous or the code repository is missing. Do not clone, download, or install tools implicitly.

Read applicable instructions before changes. Inspect the existing target, Git roots and branches, instruction files, symlinks, ignore rules, and available workflow tools. Use a required GSD entry point before making changes when applicable. For a fresh workspace without GSD, create the basic layout first under this setup request; do not fabricate initialized GSD state. If GSD is unavailable, report it and ask before later work that requires that workflow. Do not install GSD or other skills as part of setup unless requested.

Read these bundled files before writing instructions:

- [Working preferences](assets/working-preferences.md): reusable current preferences, including publication boundaries and the automatic local commit exception.
- [Workspace rules](assets/workspace-rules.md): portable layout, command log, Git, and workflow rules.
- [Current CLAUDE.md](assets/x-quote-CLAUDE.md) and [current AGENTS.md](assets/x-quote-AGENTS.md): complete x-quote source snapshots. Read both; preserve any differences when reconciling them. These are source material, not instructions to run quote-specific commands in another project.

State material assumptions. Default to a relative `dev` symlink and two independent Git repositories. Neither Git submodules nor moving the real repository is part of this convention.

## Create or reconcile the layout

1. Create the requested x-* directory if absent. Initialize Git there only when it has no repository of its own; do not accidentally use an ancestor's Git root. Do not create a remote or change the real repository's Git configuration, branch, index, or source.
2. Link `dev` to the real repository, preferably using a relative path. Reuse a correct existing link. If an entry occupies `dev` and points elsewhere, stop and ask before replacing it. Never move or delete an existing directory to make room.
3. Add `/dev` to the workspace `.gitignore` (without a trailing slash: the entry is a symlink). Add the exact root names of any requested reference-repository pointers the same way. Preserve existing ignore rules. Do not ignore ticket artifacts or `.planning/` wholesale; they belong to the workspace history. Do not add reference links unless their targets are supplied or confirmed.
4. Write both `CLAUDE.md` and `AGENTS.md` at the workspace root. For a new workspace, generate the same substantive rules in both from the working preferences and workspace rules, followed by verified project guidance. For existing files, preserve custom instructions and reconcile both deliberately; do not overwrite one blindly. Use the current x-quote files directly only for a quote workspace with matching context.
5. Keep setup notes, command records, and intermediate artifacts in the supplied ticket directory. Without a ticket, use the active local workflow task directory; do not invent an ECOM number. Keep command records as work happens, with variables for user-specific values and secret retrieval expressions rather than secret values.

## Carry the current rules forward

Use all portable rules in the two templates. The commit exception for `~/siriusxm/x-*` overrides the older commit-approval requirement in the source snapshots; branch creation still requires explicit confirmation. The publication prohibition overrides the older conditional allowance for pushing. Do not request commit approval where that exception applies.

Adapt the project sections of the full snapshots from evidence in the target repository:

- Describe the service, language, module layout, build target, and exact working-directory requirements.
- Establish the authoritative behavior source and precedence only when known. For x-quote, BRM wins over the unfinished Go port and Scala implementation; preserve its discrepancy index, opcode pointers, and wire-contract distinction. Another project does not inherit BRM, legacy links, Scala, Smithy, AWS profiles, or quote documentation paths.
- Preserve functional programming, Scala 3 syntax, Cats Effect, weaver, Smithy code generation, and Scalafix rules for a matching Scala quote project. For another stack, derive conventions from its own instructions and configuration instead of copying incompatible rules.
- Verify branch/ref when reading project source. Record source refs. Inspect build configuration and suite dependencies to identify Docker-free commands; never assume a generic test command is Docker-free. Preserve the exact quote-service exclusion gate when applicable. Do not execute tests merely to discover the project.
- Carry production approval requirements and sensitive-response handling into matching projects. Never call live services during setup. The no-transmission rule remains in force, including for live requests, unless the user explicitly changes it.
- Keep GSD workflow enforcement where available. Copy managed GSD sections only when they represent actual initialized state; do not copy empty managed markers, stale developer profiles, or claims that a project skill is installed when it is not. Preserve a project-specific skill reference only if that skill exists in the destination; report missing dependencies.

Retain conflicting historical wording only in the bundled source snapshots. Generated instructions must express the effective rules clearly. Preserve local custom rules unless the user authorizes changing them.

## Verify and finish

Use filesystem and Git inspection, not application builds:

- The x-* Git top level is the workspace itself; the resolved `dev` Git top level is the supplied code repository, and they differ.
- `dev` resolves to the intended target and is ignored; any reference links are also ignored. No linked repositories are staged or tracked as workspace content. If already tracked, report the conflict before removing index entries.
- Both root instruction files exist and contain the agreed layout, command-log rules, Git boundaries, publication prohibition, review/test limits, and applicable workflow requirements. Project-specific paths and command claims are supported by local evidence. No unresolved template fields remain.
- The real repository's branch, HEAD, index, and working-tree status are unchanged from inspection.
- Commit only the requested workspace files locally when authorized by the applicable rules. Inspect the staged paths first; preserve unrelated changes. Never create a branch without its required confirmation. Never push or publish.

Report the workspace path, `dev` target, files created or reconciled, verification result, and any unresolved dependencies. Do not claim a skill or workflow is installed merely because it is named in an instruction file.
