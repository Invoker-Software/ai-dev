---
name: oncall-report
description: Use this skill only when the user explicitly asks for an on-call report or team operational report for a responsible on-call engineer, preferably with a team ownership handle or enough context to resolve one from environment variables. Do not use it for generic, unrelated, or vague Datadog checks, health checks, monitor checks, log investigations, status checks, or troubleshooting requests unless the user clearly asks for this on-call report workflow. Build the report by checking open Alert or Warn monitors for the resolved team ownership string, limited to prod and test by default, and include a warning/error log summary across the same team services in scope.
---

# On-Call Report

Use this skill when the user wants a fast operational report of the services a team on-call engineer is responsible for monitoring. Do not use it for vague prompts such as "check Datadog" unless the user also makes it clear they want this on-call report workflow.

## Preflight

Before resolving inputs or querying anything, confirm the Datadog MCP server and required tools are available in the active tool list:

- `mcp__datadog__search_datadog_monitors`
- `mcp__datadog__analyze_datadog_logs`
- `mcp__datadog__search_datadog_logs`

If the `mcp__datadog__` namespace or any required tool is unavailable, stop immediately. Tell the user which Datadog MCP capability is missing and that the on-call report cannot be generated until the Datadog MCP integration with those tools is available. Do not substitute web search, Datadog UI guesses, repository context, or shell commands for Datadog MCP data.

## Inputs

- Required: one team ownership handle, for example `@opsgenie-Example-Team`
- Optional: log window, default `last 7 days`
- Optional: environments, default `prod` and `test`

Resolve the team handle in this order:

1. explicit user input
2. `DATADOG_TEAM`
3. `DD_TEAM`
4. `TEAM_NAME`
5. `TEAM`

If no handle is available, ask the user.

## Operating Rules

- Use one handle only. Do not invent or maintain a second team identifier.
- Treat the handle as the monitor notification or ownership handle; do not hardcode, normalize, add, or strip prefixes.
- Do not infer ownership from repo context, folder names, or Datadog service-catalog `team:` fields.
- Derive services only from monitors matched by the handle:
  1. `service:<name>` in the monitor query
  2. `for <service>` in the monitor message
  3. service-like segment in the monitor name
- Scope environments to `prod` and `test` unless the user says otherwise.
- Report only open `Alert` and `Warn` monitors for derived services in scoped environments. Exclude `No Data`.
- Determine monitor environment from `env:<value>` in the query, then monitor name, then monitor message.
- Include monitor open duration only from a reliable open or state-change timestamp; otherwise use `unavailable`.
- Include warn/error-class logs for derived services in scoped environments, using `status:(warn OR error OR critical OR alert OR emergency)`.
- Prefer one team-scoped monitor query and one grouped log-count query across the full service/environment set.
- Do not run per-service monitor queries or per-`(environment, service)` log-count queries when grouped data can supply the result.
- Do not assume a field-qualified monitor search works in every Datadog org; fall back to a plain handle search if a field-qualified query is unexpectedly narrow.
- Fetch log patterns only for pairs with non-zero grouped log counts. Render Datadog pattern output for readability as described in `references/response-format.md`; raw Datadog `[wildcard]...[/wildcard]` tags are clustering syntax, not report text.
- Follow `references/response-format.md` for all report structure and presentation rules.

## Workflow

1. Complete the preflight check. Continue only if the Datadog MCP namespace and all required tools are available.
2. Resolve the team handle, log window, and environments from user input or defaults.
3. Query `mcp__datadog__search_datadog_monitors` once with the resolved handle to discover the service set.
   Prefer the least restrictive query that still matches the handle in this org. If a field-qualified search such as `notification:<handle>` is known to work, use it. Otherwise use a plain handle search instead of assuming a specific field.
4. Page until all relevant monitor results are collected. If needed for service discovery, do not restrict this first pass to open `Alert` and `Warn`.
5. Derive services from the monitor data. If no services can be derived, say the handle did not match any monitor-backed services and stop.
6. Reuse the same monitor results for alert output when possible. Only run one narrower monitor query if needed for cleaner alert output.
7. Filter, classify, and bucket open monitors by `(environment, service)` using the operating rules.
8. Build the full `(environment, service)` set from derived services and scoped environments.
9. Run `mcp__datadog__analyze_datadog_logs` once for grouped warn/error-class counts by `env`, `service`, and `status`.
10. Reuse grouped counts for quiet services. Run `mcp__datadog__search_datadog_logs` with `use_log_patterns:true` only for non-zero pairs.
11. Build the report from the bucketed monitor data, grouped log counts, and fetched patterns.
12. Write the final standalone `.md` report using [references/response-format.md](references/response-format.md).

## Aggregate SQL Example

Use scoped environment and service filters in `mcp__datadog__analyze_datadog_logs`. Example SQL shape:

```sql
SELECT env, service, status, count(*) AS count
FROM logs
GROUP BY env, service, status
ORDER BY env, service, status
```
