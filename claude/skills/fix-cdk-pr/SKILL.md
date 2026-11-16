---
name: fix-cdk-pr
description: Fix a bot-created CDK dependency-bump PR that the user has checked out — strip Build(deps) prefix from commit messages, run npm install + validate + test -u, fold snapshot updates into the commit, and force-push. Use when the user says they checked out a dependabot/bot infra PR and wants it fixed up.
disable-model-invocation: true
---

# CDK PR Fix Workflow

The user has already checked out a bot-created PR branch. Execute these steps in order. Stop and report to the user if any step fails.

## Current State
- Branch: !`git branch --show-current`
- Commits not in main: !`git log origin/main..HEAD --oneline`
- Repo root: !`git rev-parse --show-toplevel`

---

## Step 1 — Fix Commit Messages

Check whether any branch commits start with `Build(deps):` or `Build(deps-dev):`:

```bash
git log origin/main..HEAD --format="%H|%s"
```

If none match, skip to Step 2.

If any match, write and run this rebase exec script to strip the prefix from every matching commit non-interactively:

```bash
cat > /tmp/fix-build-deps-msg.sh << 'EOF'
#!/bin/bash
msg=$(git log -1 --format="%s")
body=$(git log -1 --format="%b")
new_msg="${msg#Build(deps): }"
new_msg="${new_msg#Build(deps-dev): }"
if [ "$new_msg" != "$msg" ]; then
  if [ -n "$body" ]; then
    git commit --amend -m "$new_msg" -m "$body"
  else
    git commit --amend -m "$new_msg"
  fi
fi
EOF
chmod +x /tmp/fix-build-deps-msg.sh
git fetch origin main && git rebase origin/main -x /tmp/fix-build-deps-msg.sh
```

Confirm the result:
```bash
git log origin/main..HEAD --oneline
```

Show the updated commit list to the user before continuing.

---

## Step 2 — npm install

Run from the `infrastructure/` directory under the repo root:

```bash
cd "$(git rev-parse --show-toplevel)/infrastructure" && npm install
```

Stop if this fails.

---

## Step 3 — Validate (build + lint)

```bash
npm run validate
```

Stop and report the full error if this fails. Do not proceed to tests.

---

## Step 4 — Update Snapshots

```bash
npm test -- -u
```

This runs `IMAGE_TAG=local jest --updateSnapshot`.

If this fails:
- **Type/compile error**: means validate missed something — report the error, stop
- **Test assertion error** (not a snapshot mismatch): a construct is broken — report the full failure, stop
- **Any other error**: report the full output, stop

---

## Step 5 — Review and Commit Snapshot Changes

Check whether snapshots changed:

```bash
git diff test/__snapshots__/
```

If there are no changes, skip to Step 6.

If there are changes, show the diff summary to the user and flag any of these:
- IAM statement additions or removals
- Resource type changes on stateful resources (DynamoDB, Kinesis, SQS, S3)
- Changes in `s3-replication-*.snap` files (cross-account — extra caution)

Then fold the snapshot changes into the tip commit:

```bash
git add test/__snapshots__/
git commit --amend --no-edit
```

---

## Step 6 — Force Push

```bash
git push --force-with-lease
```

Report the push result to the user. If it fails due to a remote ref mismatch, tell the user to fetch and retry.

---

## Step 7 — Clean Up Local Branch

Capture the current branch name, switch to main, fast-forward it, then delete the local dependabot branch:

```bash
BRANCH=$(git branch --show-current)
git checkout main
git merge origin/main --ff-only
git branch -D "$BRANCH"
```

Report the final state: current branch and that the dependabot branch has been removed locally.

---

## Reference

**CI that fires automatically on this PR** (path-triggered, no commit message keywords needed):
- `cdk-diff.yml` — runs on any PR touching `infrastructure/**`, posts CDK diff as a comment
- To trigger a full PR environment deploy, post a PR comment: `wf:deploy`

**Snapshot files**: `infrastructure/test/__snapshots__/` — one `.snap` per environment+region combo (dev/test/prod × us-east-1/us-east-2/us-west-2) plus `infrastructure.test.ts.snap`.
