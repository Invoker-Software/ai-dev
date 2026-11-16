# Local skill import

The 2026-11-16 import contains 28 custom skill packages and preserves the four
packages already owned by ai-dev. All 32 packages live in `claude/skills/`;
the existing installer discovers their `SKILL.md` files and support files.

Only skills without a known public upstream were selected. Sources include
custom global Claude and Codex skills, private SiriusXM work repositories,
and the private SiriusXM plugin marketplace. Standalone custom skills were
classified from local provenance; public availability was not established by
searching their contents online.

Public GSD distribution skills, Codex system skills, official marketplace
skills, synchronized vendor skills, and VirtusLab Cellar were excluded.
Temporary directories, npm caches, and backups were excluded.

`local-skills.json` records selected sources, other local copies, destination
paths, and SHA-256 hashes of every package file and global rule source.
Existing ai-dev packages take precedence. For new packages, the primary
Claude profile takes precedence over alternate profiles, Codex copies, work
repositories, and marketplace copies. Other versions are left in their
original locations. Imported package contents are unchanged.

Some skills depend on private repositories, machine-specific paths, GSD,
corporate access, or MCP tools. Importing a package does not install those
dependencies or authorize its commands. Global rules and current user
instructions take precedence over skill instructions, including older skill
instructions about publishing or Docker tests.

Global preference files are stored under `rules/`; see `rules/README.md` for
their merge instructions. The installer continues to deploy skills and
agents only. No active global configuration was changed by this import.
