# Workflow and release handoff

Inspect build, prerequisite deployment, application deployment, PR lifecycle, observability, smoke/acceptance, and promotion workflows separately. Quote's main workflow at the recorded source deploys the application to dev; test/prod entries in config do not prove an active promotion. Its acceptance-test-dev input is disabled while smoke has its own gate. Report these distinctions accurately.

Trace workflow path filters as well as job `needs`, inputs, permissions, artifact upload/download references, image publication, and role assumption. A new infrastructure file excluded from the relevant trigger can leave required resources unapplied. Existing platform-common reusable workflows may be outside the local checkout; mark their internals unverified unless read from an authorized source.

For a new Lambda artifact, ensure build selectors and ECR tags are connected. For stateful dependencies, verify the approved ordering of primary creation and replica use. For observability, check the monitors resolve the actual final service names and tags.

Do not copy mutable third-party action references or broad token scopes merely because a sibling has them. General workflow hardening can use the public github-actions-hardening skill as an optional reference; installation is not required by this skill.

A handoff should state source commit, expected artifact/image identity, target environment/regions, prerequisites, generated changes, proposed pipeline entry point, rollback ownership, and evidence still required after deployment. Keep executable commands parameterized and local. Under the publishing boundary the user handles deployment; no git push, workflow dispatch, registry upload, release creation, or notification is authorized.
