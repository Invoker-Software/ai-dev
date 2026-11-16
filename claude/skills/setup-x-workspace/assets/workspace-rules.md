# Workspace conventions

Adapt the title and project description to the supplied code repository.

## Directory structure

- Workspace root: an independent local-only Git repository holding instructions, planning, tooling, and ticket artifacts.
- `dev`: a symlink to the real code repository, which owns application source and its own Git history.
- Optional reference-repository links: add only when relevant and their destinations are known; document which source is authoritative and why.
- `ECOM-xxxx/`: per-ticket notes, specifications, scratch files, research, command logs, and intermediate outputs that do not belong in the code repository. Use the actual ticket prefix when the project uses a different tracker.

Ignore `dev` and reference pointers in the workspace repository. Keep workspace artifacts out of the real code repository's history. The workspace repository is local-only and must never be pushed. Run build commands from the real project root through `dev`, not from the workspace root.

## Implementation references

Document the precedence of authoritative sources. Record deliberate divergences and consult the existing discrepancy index before treating a mismatch as a bug. Do not treat an abandoned implementation as authoritative.

Always check which branch is being read. Read committed source with `git show <ref>:<path>` and state the ref; inspect working-tree changes explicitly when they are relevant. Do not prune branches as part of setup.

## Command log

Every command run for a ticket goes into `commands.md` in that ticket's working directory, including filesystem, Git, build, cloud, and network commands.

- Append one entry when each command runs: a one-line purpose, then the exact command in a fenced `bash` block.
- Extract user-specific data into shell variables defined at the top of the entry or file. This includes account IDs, ARNs, hostnames, resource and table names, ticket and PR numbers, radio IDs, account numbers, emails, and paths containing usernames.
- Never write secrets. Set secret variables by retrieving them from their source.
- Make the log replayable by setting the variables.

For work without a ticket, keep the command log in the local workflow task directory.

## Git branches and commits

Branch names follow `ECOM-xxxx-short-description`: actual ticket identifier first, followed by a kebab-case task slug. Always propose the branch name and wait for explicit confirmation before any branch-creation command. Setup itself does not require a new branch.

Keep authorship tool references out of commits, comments, and PR descriptions. Do not add generated co-author trailers. Use the team's normal commit-message style. Outside the automatic commit exception in the working preferences, show the full proposed commit message and wait for approval. Never push or publish.

## Live systems

Ask before each production run. Keep sensitive contact and billing responses out of version control. Check required connectivity and credentials before interpreting failures as behavioral evidence. Document actual local prerequisites; do not guess accounts, environments, or profiles. Apply the publishing boundary to requests that transmit user content.

## Workflow enforcement

When GSD is available, start work through a GSD command before file-changing tools:

- `/gsd-quick` for small fixes, documentation updates, and ad-hoc tasks.
- `/gsd-debug` for investigation and bug fixing.
- `/gsd-execute-phase` for planned phase work.

Keep planning artifacts and execution context synchronized. Do not make direct repository edits outside the required workflow unless the user explicitly asks to bypass it. For a fresh workspace, bootstrap the basic layout before applying this rule to subsequent work; do not claim that GSD has been initialized until it has.

## Project guidance

Add verified project-specific build commands, Docker-free verification instructions, module paths, language and library conventions, generated-file boundaries, and testing rules. Preserve relevant rules from existing CLAUDE.md and AGENTS.md. The full x-quote snapshots supply the Scala quote-service profile; use that profile only for a matching project.
