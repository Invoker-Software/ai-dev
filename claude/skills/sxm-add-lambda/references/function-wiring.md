# Function, artifact, and permissions wiring

Geo's orchestrator/updater and offer's change processor use `SxmDockerImageFunction`, ECR image references, stage image tags, platform naming, VPC/security groups, and Datadog settings. Inspect the exact construct props in the target's installed version. A generic `DockerImageFunction` replacement can lose platform behavior.

Follow the image from the runtime module/build definition through CI publication to ECR repository lookup and stack `imageTag`. Check CPU architecture and handler entrypoint agree. Preserve pinned artifact identity across regions. Never assume a successful TypeScript build means the Lambda artifact exists.

Identify execution-role responsibilities separately from invocation permissions and application data grants. Use the correct custom-resource permissions boundary for helper resources when required by the platform. Grant the function only the bucket, queue, table, stream, secret, and KMS operations it needs. Existing broad managed policies in sibling code are observations, not templates to copy automatically.

Resolve secret values at runtime using the established mechanism. Store references rather than plaintext in CDK props and environment files. Distinguish the function's role from any role shared with notification helpers; reuse a shared role only when the target design calls for it.

Check default/replica region and PR/sub-environment creation conditions. Geo instantiates its S3 processing pipeline only where its notification-handler role exists. That is a specific stage decision; it does not mean every Lambda must run in a primary region.

Keep the platform logging/tracing adapter, service/component tags, monitor metadata, and alarm-stage wiring aligned with the final function name. Verify runtime support from current official documentation before selecting a version; historical sibling runtimes are not a support guarantee.
