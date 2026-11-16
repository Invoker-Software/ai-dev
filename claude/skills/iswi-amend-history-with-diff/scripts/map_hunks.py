"""List each uncommitted hunk with the commits that last wrote the lines it replaces.

Usage: map_hunks.py --repo REPO --base BASE [pathspec ...]
"""
import argparse
import collections
import re
import subprocess
import sys


def git(repo, *args):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.decode()}")
    return r.stdout.decode("utf-8", errors="replace")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    parser.add_argument("--base", required=True)
    parser.add_argument("pathspec", nargs="*")
    args = parser.parse_args()
    repo = args.repo

    branch = set(git(repo, "rev-list", f"{args.base}..HEAD").split())
    subjects = {}

    def describe(sha):
        if sha not in subjects:
            subjects[sha] = git(repo, "log", "-1", "--format=%h %s", sha).strip()
        marker = "" if sha in branch else " [OUTSIDE BRANCH]"
        return subjects[sha] + marker

    def blame(path, start, count):
        out = git(repo, "blame", "--porcelain", "-L", f"{start},+{count}", "HEAD", "--", path)
        return [line.split()[0] for line in out.splitlines() if re.match(r"^[0-9a-f]{40} ", line)]

    untracked = git(repo, "ls-files", "--others", "--exclude-standard", "--", *args.pathspec).split()
    for path in untracked:
        print(f"\n##### {path}\n  NEW FILE (untracked)")

    diff = git(repo, "diff", "-U0", "HEAD", "--", *args.pathspec)
    path = None
    for line in diff.splitlines():
        if line.startswith("diff --git"):
            path = line.split(" b/", 1)[1]
            print(f"\n##### {path}")
            continue
        if line.startswith("new file"):
            print("  NEW FILE (staged)")
            path = None
            continue
        if line.startswith("deleted file"):
            print("  DELETED FILE")
            continue
        m = re.match(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", line)
        if not m or path is None:
            continue
        old_start, old_count = int(m.group(1)), int(m.group(2) or 1)
        new_start, new_count = int(m.group(3)), int(m.group(4) or 1)
        if old_count > 0:
            try:
                owners = collections.Counter(blame(path, old_start, old_count))
            except RuntimeError:
                print(f"  hunk old {old_start},{old_count} new {new_start},{new_count}: no blame (file not in HEAD)")
                continue
            listing = "; ".join(f"{describe(sha)} x{n}" for sha, n in owners.items())
            print(f"  hunk old {old_start},{old_count} new {new_start},{new_count}: replaces lines from {listing}")
        else:
            neighbours = []
            for probe in (old_start, old_start + 1):
                try:
                    neighbours.append(describe(blame(path, probe, 1)[0]))
                except (RuntimeError, IndexError):
                    neighbours.append("(none)")
            print(
                f"  hunk pure addition after old line {old_start}, new {new_start},{new_count}: "
                f"line before from {neighbours[0]}; line after from {neighbours[1]}"
            )


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as err:
        sys.exit(f"FAILED: {err}")
