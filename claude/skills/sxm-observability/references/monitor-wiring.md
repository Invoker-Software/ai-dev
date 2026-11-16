# Platform monitoring conventions

Quote's observability stack invokes SxmDefaultObservability with manifest, workload, environment, account/region, and dev/test/prod monitor stages. Its alarm stack uses SxmEcsDatadogMonitors and SxmAlbDatadogMonitors and enforces deployment in the default global-resource region. Its deployment stage also suppresses alarms for PRs.

Geo passes Lambda monitor metadata from its orchestrator/updater stacks into the alarm stack and has sub-environment-aware monitor names/tags/query filters. Reuse those distinctions when adding functions; creating an ordinary service monitor for each replica can duplicate alerts.

Follow the target's datadogServiceName and component/platform naming helpers. Check monitor queries resolve workload, environment, region, version, and any sub-environment exactly as telemetry emits them. A monitor definition existing in CDK does not prove data reaches it.

Quote's rollout config separately enables prod alarm rollback and provides a managed HTTP 5xx alarm. Operational Datadog monitors and deployment rollback alarms have different consumers and lifecycles. Do not infer one from the other.

DataDog/pup and Datadog's public tooling can supply general query/API knowledge if already available. They are optional, not prerequisites. Do not install a plugin, change its connection, publish telemetry, or create external monitors as a side effect of onboarding. Use permitted read-only observations only when needed; report unavailable live evidence accurately.
