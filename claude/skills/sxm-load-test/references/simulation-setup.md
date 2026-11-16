# Shared DSL and distributed execution

Commerce-e2e's SimulationBase acquires Scenarios/clients from ScenariosBuilder using environment, API keys, Stripe configuration, service-name overrides, and regionContext. It transforms Scenario values with GatlingScenarioTransform and releases acquired resources in its after hook. Reuse the existing lifecycle instead of opening extra clients in a simulation.

GiftCardServiceSimulation is a compact example: it selects performanceScenarios, maps each through toGatling, and injects configurableRampUpConcurrent. That helper uses rampConcurrentUsers, a closed concurrency model. Do not describe its configured user count as requests per second.

LoadTestConfig includes rampConcurrentUsers from/to/duration, region context, service suffixes, and credential references. Read the application configuration/env mapping as well as the case classes. The run_load_ecs workflow exposes scenario selection, target environment, task count, and regional settings. LoadTestingStack maps run inputs into ECS environment and starts tasks through Step Functions.

Multiple ECS tasks and multiple scenarios can multiply intended load. State both per-task/per-scenario settings and aggregate expectations, including duration and stop conditions. Some commerce scenarios create or alter data and interact with payment systems; review those effects before designing a run.

Separate benchmark validity from compilation: warmed dependencies, account pools, data contention, routing, task placement, and errors can invalidate results. Analyze existing local reports with these limits. No empirical throughput/latency conclusion is available until an explicitly permitted run produces evidence; this skill's invocation does not authorize that run.
