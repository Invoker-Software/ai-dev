# Global preference sources

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
preferences. No combined rule file is generated. To adopt these preferences,
merge the relevant source into the runtime's existing global instruction
file, preserving local and repository-specific instructions. The ai-dev
installer does not deploy or overwrite global instruction files.

Source paths and SHA-256 hashes are recorded in `imports/local-skills.json`.
