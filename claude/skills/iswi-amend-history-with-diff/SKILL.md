---
name: iswi-amend-history-with-diff
description: Fold the uncommitted diff of a feature branch back into the historical commits that wrote the lines it replaces, so the branch history reads as if the final state had been written in the first attempt. Use when asked to "squash these changes into the commits that introduced them", "amend history with the latest diff", "absorb the working tree into history", or to fix up earlier commits without adding a new commit. Covers hunk-to-commit mapping with git blame, commits outside the branch, commits that later rewrote adjacent lines, stale commit messages, a plumbing-only rewrite that preserves authors and dates, per-commit compile checks in a detached worktree, and moving the branch only after the rewritten tip's tree equals the working tree.
argument-hint: "[base ref of the branch, e.g. origin/main or the parent of the first commit to rewrite]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

# Amend history with the uncommitted diff

The result is a rewritten branch whose tip tree is byte-identical to the current working tree, and
whose commits each contain the final form of the lines they introduced. No new commit is added.

Two scripts ship with this skill, in `scripts/` next to this file:

- `map_hunks.py` lists every uncommitted hunk and the commit that last wrote each replaced line.
- `rewrite_history.py` replays the branch from a spec file, applying exact text replacements to
  every commit in a range, and verifies the new tip tree against the working tree.

Neither script moves a branch, changes the index, or touches the working tree.

## Rules

- Follow the project's own git rules. Where the project requires approval of commit messages or
  branch names, a changed commit message is a commit message and needs approval before the rewrite.
- Never push. Never rewrite a commit that is reachable from the base branch (for example
  `origin/main`); those commits are shared.
- Do not use `git rebase -i`. The rewrite is done with plumbing (`commit-tree`) so no conflict
  resolution happens in the user's checkout.
- Do not move the branch until the new tip tree equals the working-tree snapshot and every rewritten
  commit has passed the compile check.
- Do not create branches for the check. Use a detached worktree and `refs/backup/*` refs.

## Step 1: Preflight

1. Record the branch, its tip, and the base: `git rev-parse --abbrev-ref HEAD`, `git rev-parse HEAD`,
   and the base ref given by the user or `git merge-base origin/main HEAD`.
2. Confirm the branch has no upstream copy that others use:
   `git rev-parse --verify origin/<branch>`. If it exists, state that the rewrite makes the local
   branch diverge from it and ask before continuing.
3. List the uncommitted changes, staged and unstaged, and any untracked files that belong to the
   change: `git status --porcelain`. Untracked files are included only when they fall under the
   pathspec given to the rewrite.
4. Confirm `git log --merges <base>..HEAD` is empty. The script handles linear history only.

## Step 2: Map each hunk to a commit

```
python3 <skill-dir>/scripts/map_hunks.py --repo <repo> --base <base> [pathspec ...]
```

For every hunk it prints the commits that last wrote the replaced lines, marks owners that are not
in `<base>..HEAD` as `OUTSIDE BRANCH`, and for a pure addition prints the owners of the neighbouring
lines. New files are printed as `NEW FILE`.

Decide one target commit per hunk:

| Hunk kind | Target |
|---|---|
| Replaces or deletes lines owned by a branch commit | that commit |
| Replaces lines owned by a commit outside the branch | the earliest branch commit that depends on the new form, usually the first commit whose code or tests use it; tell the user this substitution |
| Pure addition, or a new file | the commit that introduced the first use of the added code |
| A later branch commit rewrote lines inside or next to the hunk (for example a reformat) | two transforms: one limited to the range from the target up to that later commit, and one from the later commit onward, each matching that commit's text |

Read each target commit's diff for the affected files (`git show <sha> -- <file>`) before writing the
transforms. A target commit can contain text that a later commit changed, so check the exact text
at the target, not only at `HEAD`.

## Step 3: Check the commit messages

Search the target commits' messages for statements the change makes false:
`git log -1 --format=%B <sha>`. Propose revised messages for those commits only, in the same voice
as the originals. Present the target table and the revised messages to the user and wait for
approval.

## Step 4: Write the spec and run the rewrite

Write a spec file in a scratch directory, never in the repository. It is a Python file defining:

```python
REPO = "/abs/path/to/repo"
BASE = "b1a90ab"          # parent of the first rewritten commit
OLD_TIP = "968320c"       # current branch tip
PATHSPEC = ["script/"]    # paths whose working-tree state is the target end state
BACKUP_NAME = "my-branch"  # used in refs/backup/<BACKUP_NAME>-before-rewrite

# (file, start short sha, end short sha exclusive or None, exact old text, exact new text)
TRANSFORMS = [
    ("src/A.scala", "f224077", None, "old line\n", "new line\n"),
    ("src/B.scala", "f224077", "811bfe0", "text as f224077 wrote it\n", "final text\n"),
    ("src/B.scala", "811bfe0", None, "text as 811bfe0 reformatted it\n", "final text\n"),
]

# (path, start short sha): file content is taken from the working-tree snapshot
ADDED_FILES = [("src/test/Excerpt.scala", "f224077")]

# short sha -> full replacement message; other commits keep their message
MESSAGES = {"90f17d9": "Subject\n\nBody\n"}
```

Every old text must include its trailing newline and must match exactly once in every commit of its
range. Typing the texts by hand is where mistakes come from (typographic dashes, trailing spaces,
long comment lines), so build them inside the spec from the diff itself and set only the ranges by
hand:

```python
import subprocess

def hunks(path):
    # (old text, new text) for each -U0 hunk of the working tree against HEAD, in file order
    diff = subprocess.run(["git", "-C", REPO, "diff", "-U0", "HEAD", "--", path],
                          capture_output=True, check=True).stdout.decode("utf-8")
    result = []
    for line in diff.split("\n"):
        if line.startswith("@@"):
            result.append(["", ""])
        elif result and line.startswith("-") and not line.startswith("---"):
            result[-1][0] += line[1:] + "\n"
        elif result and line.startswith("+") and not line.startswith("+++"):
            result[-1][1] += line[1:] + "\n"
    return [tuple(h) for h in result]

h = hunks("src/A.scala")
assert len(h) == 2
TRANSFORMS = [("src/A.scala", "f224077", None, *h[0]), ("src/A.scala", "9ea955b", None, *h[1])]
```

For the earlier half of a split range, read the text as the target commit wrote it with
`git show <sha>:<path>` inside the spec, and assert its line count so a wrong match fails at once.

Run:

```
python3 <skill-dir>/scripts/rewrite_history.py <spec.py>
```

The script:

1. snapshots `HEAD` plus the working-tree state of `PATHSPEC` into a tree through a temporary index,
2. writes `refs/backup/<BACKUP_NAME>-before-rewrite` (old tip) and
   `refs/backup/<BACKUP_NAME>-working-tree-before-rewrite` (snapshot tree),
3. for each commit in `BASE..OLD_TIP`, reads its tree into a temporary index, applies every
   transform whose range covers it, adds the files from `ADDED_FILES`, and creates a commit with the
   original author and committer names, emails and dates,
4. writes `rewrite-mapping.txt` (old and new SHA per line) next to the spec,
5. prints `TREES MATCH` or `TREE MISMATCH`.

If a transform does not match exactly once, the script stops and names the commit, file and text.
Fix the transform and run it again; earlier runs leave only unreferenced objects behind.

A `TREE MISMATCH` means a hunk has no transform or a transform is wrong. Compare with
`git diff <new tip> <snapshot tree>` and add or correct transforms.

Changes outside `PATHSPEC` are not part of the snapshot. Stop if `git status --porcelain` shows any.

## Step 5: Check every rewritten commit

Create a detached worktree next to the repository and compile the affected module at every new commit:

```
git -C <repo> worktree add --detach <repo>-rewrite-check <BASE>
while read -r old new; do
  git -C <repo>-rewrite-check checkout -q --detach "$new"
  (cd <repo>-rewrite-check && <build command>) ; echo "${new:0:7} exit=$?"
done < rewrite-mapping.txt
```

Use the project's compile or test command that does not need external services. Run it in the
background when it is slow. If a new commit fails, check whether the original commit failed the same
way (`git checkout <old>`) before treating it as a fault of the rewrite.

Judge each commit by the command's exit code, not by searching the log for `[error]`. A detached
worktree has no tags, so build plugins that derive a version with `git describe` print
`fatal: No names found` as an error line while the build itself succeeds. In zsh, write shell
variables next to a colon with braces (`"${sha}:${path}"`); `$sha:Q` is read as a modifier.

## Step 6: Move the branch

If `git status --porcelain` shows changes that were not in the snapshot (the user kept editing while
the checks ran), do not move the branch. Tell the user, run `map_hunks.py` again, and either rebuild
the rewrite with the new hunks or wait until the editing is finished.

Only after `TREES MATCH`, all checks pass, and the working tree still equals the snapshot:

```
git -C <repo> update-ref refs/heads/<branch> <new tip> <old tip>
git -C <repo> reset -q
git -C <repo> status --porcelain
```

`update-ref` with the old value refuses the move if the branch changed in the meantime. `reset`
without flags resets only the index to the new tip; the working tree already equals it, so
`status` must print nothing. Then remove the check worktree with
`git worktree remove <repo>-rewrite-check`.

## Step 7: Report

Report the old-to-new SHA mapping, the revised messages, any hunk whose target was substituted
because its owner was outside the branch, the check results, and the backup refs. State that
documents citing the old SHAs are now out of date. The backup refs can be deleted with
`git update-ref -d refs/backup/<name>` once the user no longer needs them.
