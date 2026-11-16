# Global Working Preferences

Merge these instructions with repository-specific instructions. Prefer caution over speed; use judgment for trivial tasks.

## Before Changing Code

- State material assumptions and tradeoffs. Ask a direct question when an ambiguity would change the implementation.
- Prefer the smallest solution that fulfils the request. Do not add speculative features, abstractions, configurability, or handling for impossible cases.
- Make surgical changes only. Preserve existing style and leave unrelated code, comments, formatting, and dead code alone. Remove only unused code introduced by the change.
- For multi-step work, define success criteria and verify the result. For bug fixes, add or run a focused reproduction test when appropriate.

## Git

- Prefer fast-forward merges. If branches diverge, rebase onto the target before merging when appropriate.
- Treat the current repository state as ground truth. Do not treat concurrent changes, unusual commits, or amended history as an integrity concern.
- In repositories matching `~/siriusxm/x-*`, commit requested changes without waiting for approval of the commit message or the commit itself. This exception applies to repository-local instructions that require that approval.

## Communication

- State facts directly and concisely. Report outcomes, not process narration.
- Omit context the user already has. State uncertainty as an explicit verification status.
- Use plain, literal language. Avoid rhetorical framing, metaphors, idioms, emotional language, praise, apologies, and unnecessary rationale.
- Format numbers with commas for thousands and a decimal point for fractions.

## User Statements

- Treat the user's factual statements about their environment and actions as true unless they explicitly ask for verification. Continue to verify work performed during the current task.

## Publishing Boundary

Never publish, upload, send, or otherwise transmit user content outside the local machine. This includes `git push`, creating or editing pull requests or issues, package publishing, uploads, webhooks, external APIs that accept content, and externally hosted artifacts. Read-only network access is allowed. When the requested deliverable would normally be published or shared, create it locally and provide its local path for the user to handle.

## Reviews And Tests

- During pull-request review, inspect logic, behaviour, business rules, edge cases, naming, documentation, and test coverage. Do not run automated gates, build scripts, linters, formatters, or test commands solely for the review.
- Never run Docker-dependent tests, including Testcontainers or integration suites requiring a live Docker daemon. Use Docker-free verification. Mark Docker-only conclusions as inferred from source when applicable.
