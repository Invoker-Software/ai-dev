---
name: aws-auth
description: Refresh and verify AWS credentials on this machine (cmrc-svcs-dev / cmrc-svcs-test, Okta SAML federation). Use whenever an aws command fails with ExpiredToken or AccessDenied, before any sweep of an AWS account, or when deciding which profile a call should target. Covers the okta-aws-cli refresh flow, why aws sso login never works here, and the AWS_PROFILE trap that silently redirects calls to the dev account.
---

# AWS auth

Machine-level credential setup, shared by every project on this host.

## Ground truth about this machine

Verified 2026-08-24. Re-verify rather than trusting this list if a command behaves unexpectedly.

- **There is no `~/.aws/config`.** Both profiles live entirely in `~/.aws/credentials` as SAML-issued
  temporary credentials (`aws_access_key_id`, `aws_secret_access_key`, `aws_session_token`).
  Region comes from the `AWS_REGION` env var, not from a config file.
- **These are not SSO profiles.** `aws sso login` always fails here with
  `Missing the following required SSO configuration values: sso_start_url, sso_region`.
  Do not suggest it, and do not read "expired token" as "needs sso login".
- **The refresh tool is `okta-aws-cli`** (v2.6.0, `/opt/homebrew/bin/okta-aws-cli`), configured at
  `~/.okta/okta.yaml`, which defines both profiles with their org domain, federation app id, IdP and
  role ARNs, region, and `write-aws-credentials: true`.

| Profile | Account | Role | Notes |
|---|---|---|---|
| `cmrc-svcs-dev` | 314390065017 | `SAML-cmrc-svcs-Engineer` | Default via `AWS_PROFILE` in most shells |
| `cmrc-svcs-test` | 830441150610 | `SAML-cmrc-svcs-Engineer` | Needs explicit developer authorisation — see below |

`okta-aws-cli list-profiles` is the authoritative list; add rows here if it grows.

## Verify before doing anything

```bash
aws sts get-caller-identity --profile <profile>
```

Read the `Account` field, not just the exit code — a success against the *wrong* account is the
failure mode this skill exists to prevent.

## Refresh an expired profile

`okta-aws-cli` opens a browser (`open-browser: true`), so **the developer runs it, not you.** Hand
them the command; do not attempt to automate the browser step.

```
! okta-aws-cli --profile cmrc-svcs-test
```

The `~/.okta/okta.yaml` profile block supplies every other argument. Nothing else is needed.

Back up the credentials file first — `--write-aws-credentials` warns it "can inadvertently remove
dangling comments and extraneous formatting", and both profiles share one file:

```bash
cp -p ~/.aws/credentials ~/.aws/credentials.bak-$(date +%Y%m%d-%H%M%S)
```

After the developer reports back, confirm the refresh actually landed:

```bash
stat -f '%Sm  %N' ~/.aws/credentials          # mtime must be newer than the login
aws sts get-caller-identity --profile cmrc-svcs-test   # expect account 830441150610
aws sts get-caller-identity --profile cmrc-svcs-dev    # confirm the other entry survived
```

An unchanged mtime means the login wrote nothing — the flow targeted a different profile, or the
browser step never completed. Say so; do not retry silently or assume success.

## The AWS_PROFILE trap

`AWS_PROFILE` is commonly set to `cmrc-svcs-dev` in this workspace's shells. Any `aws` call without
an explicit `--profile` silently hits **dev**, which looks identical to success while sweeping the
wrong account.

Pass `--profile <name>` on **every** call. Never rely on the ambient value.

## Read-only boundary

Reaching into a test or prod account is never assumed — the developer authorises it per task, and
that authorisation does not carry to the next one. (For x-quote specifically the service under
development is dev-only, so a test-account call always needs an ask.)

- Permitted: `describe`, `get`, `list`, `sts get-caller-identity`.
- Not permitted without an explicit ask: anything that mutates, and any call against test or prod
  infrastructure not authorised for the task at hand.
- Never write a credential, token, or bearer value into any file in any repository. Account ids,
  role and IdP ARNs, profile names, org domain, federation app ids, task definition names and host
  names are non-secret identifiers and are fine to record.

## Diagnosing a failure, in order

1. `aws sts get-caller-identity --profile <p>` — expired, or wrong account?
2. `stat -f '%Sm  %N' ~/.aws/credentials` — when was it last written?
3. `env | grep -o '^AWS_[A-Z_]*'` — is `AWS_PROFILE` or `AWS_SHARED_CREDENTIALS_FILE` redirecting you?
4. `okta-aws-cli list-profiles` — is the profile even defined?
5. Only then ask the developer to refresh, naming the exact command.
