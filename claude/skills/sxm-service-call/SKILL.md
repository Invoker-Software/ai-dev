---
name: sxm-service-call
description: Make an authenticated HTTP call to any deployed SiriusXM Commerce service (cmrc-svcs) in dev/test/prod — resolve the hostname, the /internal or /public path prefix, and the x-sxm-api-key credential. Use whenever a task needs to hit a live service endpoint, reproduce a request against a deployed environment, verify a deployment, or debug a 401/404/500 from one of these services. Covers the URL and path-prefix rules that are not guessable from the Smithy model, where API keys live, and the known dev-data limitations that make some endpoints fail for reasons unrelated to the code.
---

# Calling a SiriusXM Commerce service

Every `cmrc-svcs` service is a Smithy4s/http4s app behind an internal ALB. The four things you need
are the hostname, the path prefix, the API key, and (for some services) required Smithy headers.
Only the hostname is guessable; the rest are not.

Requires the corporate VPN. Pair with the `aws-auth` skill — every `aws` call below needs
`--profile` passed explicitly.

## 1. Hostname

```
https://<service>.<region>.cmrc-svcs.<stage>.cloud.siriusxm.com
```

`<region>`: `us-east-2` (primary), `us-east-1`, `us-west-2`. `<stage>`: `dev`, `test`, `prod`.
`<service>` is the ECS service name — list them with:

```bash
aws ecs list-services --cluster app-cmrc-svcs-private-primary-fargate \
  --profile cmrc-svcs-dev --region us-east-2 --output text | sed 's#.*/##' | sort
```

Dev has, among others: `atlas-bridge`, `quote-service`, `gapa-service`, `geo-service`,
`offer-service`, `eligibility-service`, `redemption-service`, `giftcard-service`,
`instant-quote-service`, `activation-service`, `entitlement-service`, `trial-orchestrator`.

**`curl` needs `-k`.** The ALB serves a cert chaining to an internal CA that is not in the macOS
trust store. Without `-k` you get exit 60 / "self signed certificate in certificate chain", which
looks like a network problem but isn't.

## 2. Path prefix — the part nobody guesses

The Smithy `@http` URI in api-registry is **not** the deployed path. Two prefixes are prepended:

| Smithy trait on the service | prefix |
|---|---|
| `@apiInternal` | `/internal` |
| `@apiPublic`   | `/public` |

…followed by the service's `version:` field as a path segment (`/v1`). So:

```
service AccountAttributesApi { version: "v1" }   @apiPublic
@http(uri: "/subscription/accounts/account/{accountNumber}/profile/attributes/predictive")
→ GET /public/v1/subscription/accounts/account/{accountNumber}/profile/attributes/predictive
```

`@unversioned` operations skip the version segment but keep the prefix — hence the meta endpoints,
which every service exposes and which need **no API key**:

```
/internal/meta/up        liveness
/internal/meta/health    per-dependency health checks
/internal/meta/version   deployed git sha, build time, implemented api-registry version
```

Start every investigation with `/internal/meta/version` — it proves reachability, TLS, and tells
you exactly which commit is running.

**If you don't know the prefix**, read it off the ALB health check, which always points at
`/internal/meta/up`:

```bash
TG=$(aws ecs describe-services --cluster app-cmrc-svcs-private-primary-fargate \
  --services <service> --profile cmrc-svcs-dev --region us-east-2 \
  --query 'services[0].loadBalancers[0].targetGroupArn' --output text)
aws elbv2 describe-target-groups --target-group-arns "$TG" \
  --profile cmrc-svcs-dev --region us-east-2 --query 'TargetGroups[0].HealthCheckPath'
```

A wrong prefix returns **404 with the body `Not found`** (http4s `orNotFound`) — indistinguishable
from a wrong path. A correct path with no key returns **401 with an empty body** and
`www-authenticate: SXM-API-Key`. Use 401-vs-404 to confirm you found the right path before
worrying about credentials.

## 3. API key

The header is **`x-sxm-api-key`**, optionally with `x-sxm-service-name: <your-caller-name>` for
log attribution. It is *not* `x-api-key`, and not an `Authorization` scheme — the
`www-authenticate: SXM-API-Key` response header misleads on this point. Source of truth:
`com.siriusxm.smithy:http4s-api-key-middleware`, `ApiKeyStore.apiKeyHeader`.

Each service has its own secret in the **core-svcs** account (not cmrc-svcs), readable with the
`cmrc-svcs-dev` profile:

```
arn:aws:secretsmanager:<region>:<coreSvcsAccount>:secret:<service>-api-keys-v3
```

core-svcs accounts: dev `892792066622`, test `612573312220`, prod `027420049545`.

```bash
aws secretsmanager get-secret-value \
  --secret-id "arn:aws:secretsmanager:us-east-2:892792066622:secret:<service>-api-keys-v3" \
  --profile cmrc-svcs-dev --region us-east-2 --query SecretString --output text > /tmp/keys.json
```

Two maps inside:

- **`serverKeys`** — `key → caller name`. **This is the one you want**: present any key here and the
  service authenticates you as that caller. Find a plausible caller with
  `python3 -c "import json;d=json.load(open('/tmp/keys.json'));print({k:v for k,v in d['serverKeys'].items() if 'gapa' in str(v).lower()})"`.
- **`clientKeys`** — `target service → key`, used by *this* service for its own outbound calls. Not
  useful for calling in.

Callers often have two entries, `<name>` and `<name>~P`. Use the **unsuffixed** one; the `~P`
variant does not authenticate in dev.

Never write a key value into a repository file, a skill, or a memory. Fetch it at call time and
keep it in a shell variable.

## 4. Required headers beyond the key

Read the operation's input in api-registry (`~/siriusxm/api-registry/smithy/...`) and supply every
`@httpHeader` marked `@required`. A missing required header yields a 4xx that does not name the
header.

Notable: `commerce.gapa` operations mix in `SmsHeaders`, which requires **`sourceName`**,
**`transactionId`**, and **`country`** (`timeStamp`, `language`, `vaid`, `clientId`,
`assertedIdentity`, `canary` are optional).

## 5. Verified examples

Fetch the key first (§3), then:

**quote-service — ComputeQuote** (anonymous mode; plan names and addresses that work live in
`quote-service/integration/src/test/scala/.../parity/ParityFixtures.scala`):

```bash
curl -sk -X POST \
  'https://quote-service.us-east-2.cmrc-svcs.dev.cloud.siriusxm.com/internal/v1/quotes' \
  -H 'content-type: application/json' -H "x-sxm-api-key: $KEY" \
  -d '{"quotes":[{"planName":"All Access - 12mo - wActv"}],
       "address":{"street":"123 Main St","city":"Austin","state":"TX","postalCode":"78701","country":"US"}}'
```

**atlas-bridge — GetAccount** (the fastest way to check whether an account exists in an env):

```bash
curl -sk 'https://atlas-bridge.us-east-2.cmrc-svcs.dev.cloud.siriusxm.com/internal/v1/accounts/<acct>' \
  -H "x-sxm-api-key: $KEY"
```

**gapa-service — GetPredictiveAttributes**:

```bash
curl -sk "https://gapa-service.us-east-2.cmrc-svcs.dev.cloud.siriusxm.com/public/v1/subscription/accounts/account/<acct>/profile/attributes/predictive" \
  -H "x-sxm-api-key: $KEY" \
  -H 'sourceName: SIERRA' -H 'transactionId: dev-probe-1' -H 'country: US'
```

## 6. Finding test data in dev

There is no fixture account list. Scan the owning service's DynamoDB table:

```bash
aws dynamodb scan --table-name app-cmrc-svcs-atlas-bridge --profile cmrc-svcs-dev \
  --region us-east-2 --max-items 40 --filter-expression 'sk = :s' \
  --expression-attribute-values '{":s":{"S":"acc"}}' --query 'Items[].pk.S' --output text
```

`pk` is `acc#<accountNumber>` / `sub#US#<subscriptionId>`; `ownedBy` on a `sub` item gives the
owning account. **Existing in the table is not enough** — verify with the atlas-bridge call above
before using an account in a higher-level service.

## 7. Dev-data failures that are not code bugs

Verified 2026-08-25. Re-check rather than trusting these — they may have been fixed.

- **atlas-bridge dev has partial records.** Most accounts return
  `500 {"description":"Unable to build response, missing fields: subscription[...].status", "code":"commerceTeam.atlasBridge.INTERNAL_SERVER_ERROR"}`.
  Roughly 1 in 20 sampled accounts resolves. Always confirm an account against atlas-bridge first.
- **The NBA BIaaS dev simulator has no data.** `BIAAS_SERVICE_URL` defaults to
  `https://devtst.svc.siriusxm.com/smsdmus01-simulator_ws/bi-lite-services/BIaaSLiteServiceNBA_SAVES_SCT_v8_0`,
  and it returns `resultCode FAILURE`, `errorCode 1228017` for **every** account tried, including
  ones atlas-bridge resolves. Any gapa-service call therefore 500s, because `GapaService` requires
  BIaaS and atlas-bridge to both succeed (`parTupled`), and `AccountAttributesApi` has no modeled
  errors — it `rethrowT`s every `ServiceError` into an empty-bodied 500. **An empty 500 from
  gapa-service in dev is the expected outcome, not evidence of a defect.** It also means quote
  enrichment cannot be exercised through gapa in dev: device IDs are read out of the BIaaS response.
- **Vertex tax is down in dev.** quote-service returns `taxDegraded: true`, `taxAmount: 0`, and
  `warnings: ["tax calculation unavailable: vertex error"]`. Priced components and MRF misc fees are
  still correct; the soft-failure path is working as designed.

## 8. Logs

Container logs go to **Datadog only** (`awsfirelens` driver, `dd_service:<service>`,
`env:dev`) — there is no CloudWatch log group for the ECS task, so `aws logs` will not find them.
An empty-bodied 500 gives you nothing locally; isolate instead by calling each downstream service
directly (§5) and comparing.
