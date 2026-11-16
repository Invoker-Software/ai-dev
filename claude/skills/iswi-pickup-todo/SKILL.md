---
name: iswi-pickup-todo
description: Pick up a pending quote-service todo in the x-quote workspace, validate its claim against BRM source and live SIT07 QQ, find the plans that trigger it, and draft a Jira ticket. Use when asked to "start with <todo>", "pick up todo N", "validate this todo against live BRM", "find triggering examples", or "draft jira" for an item in .planning/todos/pending or TODO.md. Covers reading BRM for the rule, replaying quote-service's origin/main logic over the committed config snapshot to size the population, checking the replay against deployed dev quote-service, choosing live quotes that separate competing rules, correcting the todo when live BRM disagrees, the evidence document, the Jira draft layout, and the workspace records to update.
argument-hint: "[todo filename or TODO.md row number]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

# Pick up a todo: validate, find triggering examples, draft Jira

The outputs are a ticket working directory with an evidence document, a replay script and its output, and a Jira draft, plus the todo and workspace records corrected to what BRM does. Nothing is filed in Jira, pushed or published. All files go in the workspace-root repo, never in `dev/`.

BRM (`brm-sms/`, called QQ in tickets) is the system of record. A todo's proposed rule is a hypothesis until live QQ confirms it. Expect it to be wrong: a rule inferred from a few live values often fits those values and fails on inputs that were never quoted.

## Rules

- Read-only against every live system. QQ quick-quote and quote-service `ComputeQuote` do not write.
- Credentials and tokens stay in shell variables. Raw live responses stay in the session scratchpad. No account-info responses anywhere.
- Code positions cite `origin/main` in `dev/` (`git -C dev fetch`, then `git -C dev show origin/main:<path>`). Do not switch the `dev/` branch.
- Ticket records follow the project voice: plain literal language, one line per paragraph, absolute dates, no AI mention, no GSD decision IDs or phase numbers in the Jira draft (name the Jira ticket, for example ECOM-13269, instead).
- Commit to the workspace-root repo without asking. Never commit in `dev/` from this skill.

## Step 1: Read the todo and its neighbours

1. Read the todo in full, and every todo, `TODO.md` row and `QUOTE-DISCREPANCIES.md` section it names.
2. Check `git log --oneline -10 -- <todo>`: the user may have edited it today.
3. Write down the todo's claim as a testable rule: which input decides which output.

## Step 2: Read BRM for the rule

1. Start at the field in `brm-sms/sys/fm_sir_srvc/fm_sir_srvc_get_quote.c` and follow the value back to where it is set. Upstream values often come from another module (`sys/fm_sir_utils/`, `sys/fm_sir_cust_gq_utils/`); `grep -rn` the field or constant (`include/sirius.h` for `IC_*` and similar).
2. Record the exact file and line range of each branch that sets the value.
3. Find the quote-service code that should correspond, including a signal quote-service already computes but does not use for this field (for example `QuoteContext.mrdEligible`).

## Step 3: Replay quote-service over the snapshot

1. Create the ticket directory: `ECOM-xxxxx/` if a ticket exists, else `NOJIRA-<short-slug>/`.
2. Export the snapshot: `git -C dev show origin/main:integration/src/test/resources/ddb-config-export.json > <scratchpad>/snapshot.json`. Items are `PLAN#<name>`/`RESOLVER` with an embedded `components` list, `MSRP#PRICES`/`<package>#TERM#<n>`, and `MRF#USA`/`RATE#`.
3. Write `find_<topic>_divergence.py` in the ticket directory. Python standard library only. It replays the `origin/main` logic for the field line by line, for each request type that can change the result (at least MRD-ineligible and MRD-eligible), computes what the BRM rule predicts, and writes a CSV with one row per plan per request type: plan, plan type, request type, code path taken, the inputs the rule reads, quote-service value, predicted value, and whether they differ.
4. Print a summary table: request type, code path, quote-service value, predicted value, plan count. Every path, not only the diverging ones.
5. Include every path that sets the field, not only the one the todo names. The zero-dollar path in `QuoteCalculator` is a separate path from `SavingsCalculator`.

## Step 4: Check the replay against deployed quote-service

Use the `sxm-service-call` skill for host, key and headers. Start with `/internal/meta/version` and record the deployed commit.

- The deployed request shape can differ from `api-registry`. Copy it from `ParityFixtures.request` and `ParityFixtures.testAddress` on `origin/main`. As of 2026-09-17: `{"quote":[{"plan":[{"planName":"..."}]}],"serviceAddress":{"streetAddress":"123 Main St","city":"Austin","state":"TX","postalCode":"78701","country":"US"}}`, headers `x-sxm-api-key`, `sourceName`, `transactionId`.
- Dev cannot resolve SIT07 accounts, so only anonymous (never MRD-eligible) quotes are possible. Quote the same plans chosen for live QQ. If the replay matches every anonymous call on the field and on `exactSavingAmount` and `savingsInMonths`, use its eligible-side values in the evidence and say so. If it does not match, fix the replay before going further.

## Step 5: Quote live QQ

Access: `ECOM-13163/qq-access-notes.md` and `ECOM-13163/mrd-savings-finding.md`. Summary:

1. Needs the corporate VPN and a valid `cmrc-svcs-dev` session. Check with `aws sts get-caller-identity --profile cmrc-svcs-dev`. If expired, ask the user to run `! okta-aws-cli --profile cmrc-svcs-dev` and wait; never `aws sso login`.
2. Client id and secret: Secrets Manager `/app-cmrc-svcs/geo-service/secrets/SMS_US_CLIENT_ID` and `SMS_US_CLIENT_SECRET`, `--profile cmrc-svcs-dev --region us-east-2`.
3. Token: `GET https://api-int-secsit07.tt.transformsec.corp.siriusxm.com/rest/v1/oauth/system/token` with basic auth, headers `sourceName: GEOSERVICE`, `transactionId: TX-001`; read `.access_token`.
4. Quote: `POST https://api-int-secsit07.tt.transformsec.corp.siriusxm.com/quotes/v1_0/getquickquote`, headers `Content-Type: application/json`, `sourceName: GEOSERVICE`, `transactionId: TX-001`, `timeStamp: <ISO8601>`, `SXM_M_A: <token>`.
5. Accounts and request shapes:

| Account | MRD | Shape | Body |
|---|---|---|---|
| `96571256` | not eligible | change-plan | `accountNumber`, `subscriptionId 96618494`, `deviceId 990003315810`, `customerType individual`, `quote[0].plan[0].planName` |
| `96571256` | not eligible | new subscription | same without `subscriptionId` and `deviceId` |
| `77379885` | eligible | new subscription | `accountNumber`, `customerType individual`, plan; never `subscriptionId` (MRD does not apply on change-plan) |

Sponsored plans on the change-plan shape return an empty `product` list.

Write one zsh script in the scratchpad that fetches the secrets and token into variables and saves each response to `<scratchpad>/qq/NN-<account>.json`. Tabulate with `jq`: status, plan, `mrdEligibleFlag`, `totalAmount`, `exactSavingAmount`, `savingsInMonths`, the field under test.

**Choosing plans.** The sample must be able to prove the rule wrong:

- At least one plan from every diverging class in the Step 3 summary, spread across plan types, and the smallest and largest values.
- Controls from paths where quote-service already agrees with the prediction.
- The same plan on both accounts, so the account is the only thing that changes.
- Plans that separate the todo's rule from the obvious alternatives. For MRD questions, quote an eligible account on plans with no MRD price: "MRD applied" and "account eligible" give different answers only there.
- Any field the rule feeds downstream (for example the divisor of `savingsInMonths`) on plans where the replay predicts a change.

About 20 to 40 calls. Record calls that fail (`Generic Error`) and move on.

## Step 6: When live QQ disagrees with the todo

1. Tabulate every live value against the todo's rule. Find the input that separates the agreeing and disagreeing rows.
2. Return to Step 2 with that input and find the BRM branch that uses it.
3. Update the replay's predicted rule, rerun it, and quote a second batch chosen to test the new rule on classes the first batch did not cover.
4. Stop when the prediction matches every live value that returned one. Report the count.

## Step 7: Write the evidence document

`<ticket-dir>/live-brm-validation-<date>.md`, sections in order:

1. Title and one paragraph: what was validated and the result, including a correction to the todo.
2. **Method**: live QQ (endpoint, accounts, shapes, call count with failures), deployed quote-service (commit, call count, why eligible calls were impossible), offline replay (script, snapshot ref, CSV, and that it matched the deployed calls). No credentials; raw responses kept in the scratchpad.
3. **BRM's rule, from source**: file and line ranges, the branches as bullets, and the quote-service signal that matches.
4. **Results**: one table per account, columns for plan, shape, QQ values, QQ field value in bold, quote-service value, predicted value. A sentence with the match counts.
5. Downstream field tables, if any.
6. **Population**: request type, path, quote-service value, QQ value, plan count; distinct plans affected.
7. **Other differences seen in these calls, not analysed**.
8. **Not established**.

## Step 8: Draft the Jira ticket

`<ticket-dir>/jira-draft.md`, the `ECOM-13261/extraction-zeroes-nonzero-components.md` layout:

1. `# <one-line defect title stating quote-service's behaviour and QQ's>`
2. `**Type:** Bug — Priority: <Highest|High|Medium>` and `**Component:** quote-service/<area>`
3. `## Summary`: the defect, how many plans, live confirmation with date and match count, downstream effect with one example.
4. `## Elaboration`: what QQ does (with line refs), what quote-service does (a table of paths when there are several), and the quote-service signal that already exists.
5. `## Code positions`: quote-service at `origin/main` with the short SHA, then QQ under `sms_src/...`.
6. `## Failing cases`: live tables stating which account type and where each quote-service value came from; the population table.
7. `## Acceptance criteria`: checkboxes, each testable. Include named tests for every failing case and re-derived parity expectations with each changed value listed in the PR.
8. `## Notes`: scope limits, not-confirmed items, and unrelated differences seen in the same calls.

Call the system of record QQ in the draft.

## Step 9: Correct the records

1. The todo: add a dated `## Correction` section when the rule changed, and rewrite the rule, scope and change sections to the confirmed version. Link the evidence document and the draft. If the filename or title states the disproven rule, `git mv` it and update every reference (`grep -rln <old-name> --include='*.md' .`, excluding `dev/`, `brm-sms/`, `legacy/`).
2. Before editing any file, check whether a phase `*-VERIFICATION.md` lists it in `covered_files`; editing it makes that verification stale. Leave phase documents unchanged.
3. `TODO.md`: the item's row and list entry, with the new counts.
4. `QUOTE-DISCREPANCIES.md`: a dated `**Corrected <date>.**` paragraph at the top of the relevant section, stating which earlier note it supersedes.
5. Todos that depend on the rule: update the sentences that assumed the old one.
6. Commit everything in one workspace-root commit, one or two lines, stating what was validated and what it corrected.

## Report

State the confirmed rule and its BRM source, the live match counts for the prediction and for quote-service, the population, any downstream field affected, what the todo said that was wrong, the paths of the evidence document and draft, the commit, and what is not established.
