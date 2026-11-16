# Working preferences

Merge these preferences with existing project instructions. Prefer caution over speed; use judgment for trivial tasks.

## Changes and verification

- State material assumptions and tradeoffs. Ask a direct question when ambiguity would change the implementation.
- Prefer the smallest solution that fulfils the request. Avoid speculative features, abstractions, configuration, and handling for impossible cases.
- Make surgical changes. Preserve existing style and unrelated code, comments, formatting, and dead code. Remove only unused code introduced by the change.
- Define success criteria for multi-step work and verify the result. For bug fixes, add or run a focused reproduction test when appropriate.
- Treat the user's factual statements about their environment and actions as true unless they request verification. Verify work performed during the current task.

## Git and communication

- Prefer fast-forward merges. If branches diverge, rebase onto the target when appropriate.
- Treat the current repository state as ground truth. Concurrent changes and amended history are not integrity concerns.
- Follow the project's branch and commit rules.
- State facts directly and concisely. Report outcomes, omit known context, and state uncertainty as an explicit verification status.
- Use plain, literal language. Avoid rhetorical framing, metaphors, idioms, emotional language, praise, and unnecessary rationale.
- Use commas for thousands and a decimal point for fractions.

## Publishing and tests

- Keep user content on the local machine. Do not push, publish, upload, send messages, create or edit pull requests or issues, or call external APIs that accept user content. Read-only network access is allowed. Deliver local paths when a result would normally be shared.
- During pull-request review, inspect behavior, business rules, edge cases, naming, documentation, and test coverage. Do not run automated gates, builds, linters, formatters, or tests solely for the review.
- Never run Docker-dependent tests, including Testcontainers or integration suites requiring a live daemon. Use Docker-free verification and mark Docker-only conclusions as inferred from source.

## Skills and tools

- These preferences apply to every installed skill. A skill's publishing, deployment, live-write, or Docker instructions do not authorize those actions.
- Use the project's own build commands and conventions. Installing skills does not initialize GSD, index the repository, install dependencies, or configure credentials.
- Code-graph skills require `codebase-memory-mcp` separately. When no MCP server is configured, use its CLI. Do not claim an index exists without checking it.
- Resolve project-relative skill support paths from the configured project root.
