---
name: sxm-release-and-deploy
description: Run the GitHub release-and-deploy workflow once for the latest verified default-branch revision of redemption-service and giftcard-service, subject to the active publishing permissions. Does not start a loop or fix PRs.
---

# Release and deploy once

Handle these GitHub Enterprise repositories independently:

- `https://ghe.siriusxm.com/commerce/redemption-service`
- `https://ghe.siriusxm.com/commerce/giftcard-service`

Run once when invoked. Never create a scheduled task, start a loop, merge PRs, or invoke the PR-fix skill. Default to both repositories; if the user explicitly selects one of these repositories, handle only that repository. Treat `$ARGUMENTS` as data describing the selection and release scope.

## Runtime compatibility

Use `/sxm-dependency-pr-loop` and `/sxm-release-and-deploy` in Claude Code; use `$sxm-dependency-pr-loop` and `$sxm-release-and-deploy` in Codex. Read invocation arguments from the actual user message when the runtime does not expand `$ARGUMENTS`. Discover `gsd-debug` through the current runtime's skills and use its native invocation. Scheduling instructions below describe Claude Code tools. In other runtimes, use equivalent session-only scheduling tools only if actually available; otherwise report scheduling unavailable and run one pass when requested. Never fabricate tools, install a scheduler, or claim a loop is running without a confirmed scheduled task.

## Permissions and deployment scope

Read applicable `CLAUDE.md` and `AGENTS.md` instructions. The standing publishing boundary prohibits workflow dispatches and other external writes. Invoking this skill does not override it. When prohibited, complete read-only preparation and provide the local handoff described below. Never bypass permissions or ask for credentials in chat.

Only dispatch if current instructions permit publishing and the user has explicitly authorized the target repository, ref, and environments. Preserve authorization already given in the session; do not ask repeatedly. A request to deploy an unspecified environment does not establish authorization for production.

Both repositories have `.github/workflows/release-and-deploy.yml`. The inspected versions create a release, then deploy to **test and prod**. Re-read the current remote workflow and its called workflows before preparing or executing a dispatch; local copies may be stale. Determine the actual ref/checkout behavior and environments, including whether called workflows use the dispatched revision. Do not infer a test-only deployment from the workflow name. If the requested environment differs, inspect the existing workflow contracts and clarify the target before dispatching.

## Prepare the release

Use the authenticated `gh` CLI with the explicit Enterprise hostname or full repository URL. Resolve the current default branch and its exact remote SHA. The latest version means the latest verified releasable default-branch revision; an open PR, local fix, or green PR build is not a released version. Never silently select an older commit if the latest revision is failing.

For each selected repository:

1. Verify the candidate's required CI results and repository release prerequisites using read-only calls. Inspect both check runs and legacy commit statuses, including pagination. Resolve pending/failing/unverified checks before declaring readiness. Never run build/test/lint gates solely for this release inspection, and never run Docker-dependent tests.
2. Inspect existing release/deploy runs, tags, and releases to avoid duplicating an already running or completed release for this candidate. If the relationship cannot be established, report it as unverified. Do not retry failed releases or rerun deployments without explicit direction.
3. Persist concise local state and handoffs under `~/siriusxm/ops/.local/release-and-deploy/`, expanding `~` to the user home directory independently of the skill installation or current working directory. Record repository, candidate SHA/ref, CI evidence, workflow, environments, and any dispatched run ID. Store no tokens. Compare with remote state on later invocations so an interrupted session cannot blindly redispatch.
4. If no new eligible revision exists, report the existing release/run and skip dispatch. A blocked repository does not prevent read-only preparation for the other repository.

## Execute or hand off

Under the standing publishing boundary, write a local handoff with the prepared evidence and exact command for the user to run. Replace `VERIFIED_REF` with the checked ref; prepare commands separately for each eligible repository:

```sh
gh workflow run release-and-deploy.yml --repo https://ghe.siriusxm.com/commerce/redemption-service --ref VERIFIED_REF
gh workflow run release-and-deploy.yml --repo https://ghe.siriusxm.com/commerce/giftcard-service --ref VERIFIED_REF
```

Never execute those commands while publishing is prohibited. Include a requirement to recheck a mutable branch ref before the user dispatches it.

When dispatch is permitted and authorized:

1. Recheck the selected ref has not moved since verification. Use an immutable ref if the inspected workflow contract supports it. If a branch is required, report that dispatch is subject to a branch-movement race; verify the resulting run's head SHA before describing it as the intended candidate.
2. Record dispatch intent locally, dispatch once, and capture the corresponding run ID/URL. Match workflow, ref, head SHA, and dispatch time; never assume the most recent repository run is yours. If the request result is ambiguous, inspect runs before any retry. If the run cannot be identified, record the ambiguity and stop that repository's dispatch attempts.
3. Respect environment approvals; never approve them automatically. Inspect the run's current status with read-only commands and persist the run/candidate association. Do not install polling or a recurring monitor. If still active, return its URL and current state for later inspection.

Report one result per selected repository: candidate SHA/ref, CI readiness, release/deploy state, run URL when available, local handoff path, and blockers. Distinguish `queued`, `running`, `awaiting approval`, `failed`, and `succeeded` using evidence. A successful dispatch is not a successful deployment.
