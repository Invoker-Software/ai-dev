---
name: adhoc-platform-task
description: "Run an ad-hoc platform task through the dual-agent code-graph workflow — read-only investigation, then confined execution"
argument-hint: "[ad-hoc task description]"
allowed-tools:
  - Task
  - Read
  - Bash
---

<objective>
Ad-hoc platform tasks need a non-linear blast-radius map computed once, then a
confined write pass guided by it. Two stages, in order:

1. `adhoc-investigator` (read-only) explores the codebase through the
   `codebase-memory-mcp` code graph and writes a distilled context slice.
2. `adhoc-executor` (write-confined) performs the change, bounded to the file
   manifest that context slice names.

The split exists so investigation and execution never share a mutation
budget: the agent that decides what to touch cannot also touch it, and the
agent that touches files never has to also decide the blast radius from
scratch.
</objective>

<precondition>
Before Stage 2 may run, confirm the working tree is clean: `git status --short`
must report nothing. This is the compensating control for Stage 2's
manifest confinement, which is prompt-enforced only — a clean baseline makes
every edit Stage 2 makes diffable and revertable. If the tree is dirty, report
this to the user and stop; do not proceed to either stage.
</precondition>

<stage_1>
Spawn the `adhoc-investigator` subagent with:
- the ad-hoc task description supplied as this skill's argument
- an explicit absolute output path, defaulting to `adhoc_context.txt` in the
  current working directory if the caller does not name one
- the absolute path to the context template
  (`@@CLAUDE_CONFIG_DIR@@/skills/adhoc-platform-task/assets/adhoc_context_template.txt`,
  resolved to this profile's real config directory)

When it returns, read the produced context file and check, before dispatching
Stage 2:

1. The Minimal File Manifest is non-empty and holds between 3 and 10 paths.
2. Every path in the manifest exists on disk.
3. The `Blast-radius evidence:` line is present.
4. The `Indexed project:` line is present.

If the `Blast-radius evidence:` line reports `DEGRADED`, or the `Indexed
project:` line reads `UNINDEXED`, surface it to the user verbatim before
proceeding — a degraded manifest is a weaker authorisation than a full one,
and on this installation degradation is the expected case, not an exception.
An unindexed repository means Stage 2's blast-radius check cannot run at all.
If any of the four checks fails, report the failure and stop; do not dispatch
Stage 2 against an invalid context file.
</stage_1>

<stage_2>
Spawn the `adhoc-executor` subagent with the absolute path to the context file
produced in Stage 1, and the explicit instruction to confine all edits to the
Minimal File Manifest it contains and to never modify the context file
itself.
</stage_2>

<limitations>
Two limitations apply to every run of this workflow and are not resolved by
it — restated here so a caller sees them without opening either agent file:

- The Investigator holds `Write` (needed to emit its output file) even though
  its role is read-only. It cannot edit an existing file in place — `Edit`
  and `NotebookEdit` are absent from its harness allowlist — but it can still
  create or overwrite one caller-supplied path.
- The Executor's manifest confinement is prompt-enforced only; the harness
  grants it repo-wide write access. The clean-working-tree precondition above
  is the sole compensating control.

Do not add a cleanup step that deletes the context file after Stage 2
completes — it is the audit record of what Stage 2 was authorised to touch.
</limitations>
