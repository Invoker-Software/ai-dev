# SiriusXM project conventions

- Resolve application code through `dev` when working in an x-* workspace. Application source and its Git history belong in the real code repository; planning and ticket artifacts belong in the workspace. For a regular repository, follow its existing artifact layout.
- Keep ticket notes and replayable commands in the ticket working directory or the active local workflow task directory. Parameterize user-specific command arguments. Retrieve secrets from their source without recording their values.
- Establish the authoritative repository and source ref before changing service behavior, Smithy contracts, generated code, or infrastructure. Preserve existing compatibility and regional ownership conventions.
- Read project instructions before choosing build, formatting, and Docker-free verification commands. When GSD is available and the project requires it, enter its workflow before making changes.
- Check documented corporate connectivity, regional context, and credential requirements. Do not invent accounts, profiles, endpoints, or permissions. Keep sensitive operational responses out of version control.
- In repositories matching `~/siriusxm/x-*`, commit requested changes without waiting for approval of the commit message or commit itself. This exception overrides repository-local commit-approval requirements.
- The general local-only publishing and Docker-free test rules apply to SiriusXM skills, including dependency, release, live-service, and Rancher workflows.
