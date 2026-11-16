# Preference sources

`general.md` and `siriusxm.md` are the canonical project preferences used by
`ai-dev init`. The SiriusXM profile adds `siriusxm.md` to `general.md`.
The general file is derived from the common imported global preferences;
the SiriusXM-only commit exception and work-repository conventions live
in the SiriusXM file. Runtime guidance is appended by `install/project.js`.

## Imported global snapshots

These files preserve the global preferences imported on 2026-11-16:

- `claude/CLAUDE.md`: the primary Claude profile's global instruction file.
  The alternate Claude profiles had identical global instruction files.
- `codex/AGENTS.md`: the global Codex instruction file.

Both cover minimal changes, explicit assumptions, verification, fast-forward
Git history, concise communication, trusting user statements, local-only
publishing boundaries, source-focused PR review, and Docker-free tests.
Claude provides more detailed wording and examples. Codex also contains the
commit-approval exception for `~/siriusxm/x-*` repositories.

The original files are retained separately to preserve runtime-specific
preferences and provenance. They are not deployed directly. Project setup
merges canonical preferences into a managed block in the project's root
CLAUDE.md or AGENTS.md. To adopt a snapshot globally, merge it manually
into the runtime's existing global instruction file. Neither installer
path deploys or overwrites global instruction files.

Source paths and SHA-256 hashes are recorded in `imports/local-skills.json`.
