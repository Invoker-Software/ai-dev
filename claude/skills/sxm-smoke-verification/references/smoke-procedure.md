# Revisions, credentials, and evidence

Geo's workflow checks out the supplied version, compiles smoke/Test, selects the target environment, assumes the platform action role and then the commerce e2e role, and runs smoke/test with regional AWS_REGION values. The initial workflow region is not necessarily the region of each test invocation. Read env overrides at the actual run step.

Geo's smoke fixtures build generated Smithy clients and an API-key store. Follow the client/resource setup rather than inserting ad-hoc headers or copying credentials. Read the entire scenario before declaring it read-only. Health/meta checks and business smoke calls have different behavior and side effects.

The quote repository at the recorded ref has a smoke placeholder, not a complete suite to transplant. Use geo as a design source and implement assertions appropriate to quote's actual contract. Do not claim parity scenarios are deployed smoke coverage.

Separate expired authentication, missing VPN, incorrect endpoint/version, unavailable dependency, assertion mismatch, and skipped test. A failed request with no established environment is not a business regression. A green pipeline whose smoke step is disabled/skipped is not smoke evidence.

Reports should record time, region, source/app/test identity, expected result, observed result or not-run status, and evidence path. Keep contact/billing payloads and secret headers out of reports and history. Existing logs may be analyzed locally without rerunning calls. Preserve actual command exit status when piping to tee; a log file existing is not evidence that a suite passed.
