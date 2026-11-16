# Scoped replacement and failed-input protection

Quote's ConfigTableWriter exposes shared staleCandidates logic, country-scoped replacement, and protections for skipped plan keys, failed MSRP baseline derivation, unidentified failures, and unresolved version boundaries. Verify the exact target-ref schema before interpreting keys; the source branch has dated/versioned configuration.

Its baseline protection covers the failed package/term key and related versioned keys. Unidentified baseline failures can block deletion of baseline rows more broadly. Boundary failures protect specific version keys. Do not flatten these distinct conditions into a generic skip-failed-record rule: deriving fewer records does not make previously valid rows stale.

The writer executes upserts with retries and raises on partial batch failure. Replacement writes new records before deleting candidates; a failed or partial put must leave deletion candidates intact. DynamoDB batch operations are not a transactional country replacement, so the plan must describe partial progress and recovery using actual writer behavior.

A dry-run should show source provenance, target scope/schema, input success/failure counts, proposed put keys, proposed delete keys, protected keys, and unresolved conditions. Match dry-run and execution candidate logic. Do not substitute whole-table key differences for country/tenant-scoped differences.

The available CLI and input flags can change between refs. Discover them from the current script entrypoint and configuration rather than guessing commands. Keep tax-config replacement behavior separate from plan/baseline replacement if their selectors differ.

Use existing captures only with their timestamp, source ref, and limitations. A committed fixture is repeatable local evidence, not current deployed state. A recovery handoff must identify source inputs, backup/snapshot evidence if available, interruption behavior, and the safe rerun path. Never claim backups or restores are available without evidence.
