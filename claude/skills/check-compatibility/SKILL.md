# SKILL: check-compatibility

## Repository Conventions

- Project documentation is located under the `documentation` directory.
- API documentation, migration guides and architectural notes can be found there.

## Purpose
Verify backward compatibility of the current Smithy model against the baseline model (latest model from the main branch).

This uses the Mill task:
    ./mill show smithy.debugCompatibility

## When to use
- After modifying Smithy models.
- Before merging changes to main.
- When asked whether changes are backward compatible.
- As a release safety gate.

## Tooling
Requires access to a command execution tool (e.g. `run_command`).

## Steps

1. Assume the current working directory is the repository root.

2. Execute:
   Command:
       ./mill show smithy.debugCompatibility

   Using `run_command`.

   - Do NOT simulate the result.
   - Wait for completion.

3. Interpret results:

   SUCCESS condition:
   - exitCode == 0

   FAILURE condition:
   - exitCode != 0

4. On failure:
   - Extract and summarize:
       - All lines starting with:
             CompatibilityCheck:
       - All lines starting with:
             [ERROR]
   - Highlight:
       - Owner
       - Context
       - message
       - Whether it breaks if client/server gets deployed first

5. Always report:
   - Exact command executed
   - Exit code
   - Clear final status (COMPATIBLE / INCOMPATIBLE)

## Expected Output

### On success

✅ Smithy model is backward compatible with baseline.
Command: ./mill show smithy.debugCompatibility
Exit code: 0

### On failure

❌ Smithy model is NOT backward compatible with baseline.
Command: ./mill show smithy.debugCompatibility
Exit code: <non-zero>

Detected compatibility violations:
- <summarized list grouped by Owner or Context>

## Notes

- Do not attempt to fix incompatibilities automatically unless explicitly requested.
- Treat any "[ERROR]" line as a breaking change.
- Prefer structured summary over raw full output dump.
- If the command is slow, wait for completion before summarizing.
