# Response Format

Use this reference after data collection to write the shareable on-call report.

## Output File

- Write a standalone `.md` file.
- If the user does not specify a path, write directly to the workspace root:

```text
./oncall-report-<team>-<YYYY-MM-DD>.md
```

- Use a filesystem-safe team fragment in the filename.
- Keep the file content limited to the report itself. Do not add chat framing before or after the Markdown document.

## Document Shape

Use this structure exactly:

```md
# On-Call Report

Report for `<team-handle>` across `<environment-list>` for `<log-window>`.

Services in scope: `<service-a>`, `<service-b>`.

Summary: <open Alert monitor count>, <open Warn monitor count>, <warn/error-class log totals>.

## <environment>

### <service-name>

<one-line service interpretation>

#### Monitors

<monitor table or quiet monitor sentence>

#### Logs

<log table or quiet log sentence>
```

Repeat each `## <environment>` section for every scoped environment, and each `### <service-name>` subsection for every derived service in that environment.

## Ordering

- List environments in the requested order, or `prod` then `test` by default.
- Keep services in a stable order within each environment, preferably alphabetical.
- Include every scoped service exactly once per environment, even when it has no open monitors or matching logs.
- Do not collapse quiet services into environment-level prose.

## Content Rules

- The introduction must state the resolved team handle, scoped environments, selected log window, and services in scope.
- Keep the three introduction lines as separate Markdown paragraphs: `Report for`, `Services in scope`, and `Summary` must each start on a new rendered line with a blank line between them.
- The `Summary:` line must be one line with counts by severity across the full report. Include open `Alert` monitors, open `Warn` monitors, and compact warn/error-class log totals using only severities that are present.
- Each service interpretation must be one concise operational sentence based only on monitor state, open duration, log severity, and counts.
- Do not claim root cause unless it is explicit in the source data.
- Preserve monitor names, alert messages, and raw log messages exactly when including them. Do not paraphrase or reinterpret source text.
- Wrap statements extracted from logs in backticks when they appear in report prose or the `Top Patterns` column.
- For Datadog log patterns, stay as close as possible to the original message while optimizing readability:
  - Keep the static words, punctuation, and ordering Datadog returned.
  - Remove Datadog clustering markup such as `[wildcard]...[/wildcard]`; do not print those tags in the report.
  - Replace variable regions with concise placeholders such as `<value>`, `<id>`, `<duration-ms>`, or `<timestamp>` when the surrounding text makes the variable type clear.
  - If the variable type is unclear, use `<value>`.
  - Do not invent static words, omit meaningful fixed text, or rewrite the message in your own words.
- Omit message or pattern text when exact wording is unavailable.
- Keep pattern text short when Datadog provides concise patterns; avoid dumping raw log lines.
- Do not rank services unless the user explicitly asks for prioritization.

## Monitor Section

Always include `#### Monitors`.

If the service has open `Alert` or `Warn` monitors, use this table:

| Status | Monitor | ID | Open For |
| ------ | ------- | --: | -------- |
| Alert or Warn | Exact Datadog monitor name | Datadog monitor id | Duration or `unavailable` |

If there are no open monitors, write:

```md
No open `Alert` or `Warn` monitors.
```

## Log Section

Always include `#### Logs`.

If warn/error-class logs exist, use this table:

| Level | Count | Top Patterns |
| ----- | ----: | ------------ |
| warn/error/critical/alert/emergency | Matching count | `Readable Datadog pattern text` or `exact raw log message` when available |

If there are no matching logs, write:

```md
No warn/error-class logs in the selected time window.
```
