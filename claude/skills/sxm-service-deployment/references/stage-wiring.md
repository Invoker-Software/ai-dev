# Stages, artifacts, and runtime wiring

Quote's `SxmApp` loads stage definitions and `setupEnvStage`; PRClassifier receives the PR number from the environment. Follow this chain in the target repo rather than editing a stack in isolation.

Quote's prerequisites stage creates ECR and a primary-region secrets stack with replica regions. The application stage constructs the service stack in each applicable region and persistent DynamoDB stacks outside PR mode; the global table is created only by its primary branch. Alarms are restricted to the default region and non-PR deployments. Geo's stage additionally owns data-pipeline dependencies and has sub-environment-specific monitor behavior. Preserve the target's decisions rather than assuming quote's conditions are universal.

Trace secrets from definition through regional creation/replication and references into the service. Distinguish ECS task role, execution role, application secret access, and cross-account key policy. Keep secret payloads out of local configuration and output.

Quote's service stack includes an optional Vertex sidecar. This is a quote-specific deployment choice, not baseline scaffolding for every service. For another service, add only required containers/dependencies. Check image repository, architecture, environment, health/readiness behavior, and startup order for each actual container.

The inspected quote rollout config uses all-at-once in dev, canary in test/prod, and stronger prod alarm rollback. Those values are evidence of configuration, not proof those environments are deployed or appropriate defaults elsewhere.

Use existing package scripts only after inspecting their behavior. Quote's synth script cleans output, runs CDK, and formats templates with shell tooling; do not assume it is a pure read. Synthesis can invoke lookups and Docker bundling in other projects. Prefer the smallest offline checks available with installed dependencies.
