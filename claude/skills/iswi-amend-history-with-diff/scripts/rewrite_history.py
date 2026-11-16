"""Replay BASE..OLD_TIP with exact text transforms and verify the new tip against the working tree.

Usage: rewrite_history.py SPEC.py

The spec defines REPO, BASE, OLD_TIP, PATHSPEC, BACKUP_NAME, TRANSFORMS, ADDED_FILES and MESSAGES.
See SKILL.md for the format. Nothing here moves a branch or touches the index or working tree.
"""
import os
import runpy
import subprocess
import sys
import tempfile


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    spec_path = os.path.abspath(sys.argv[1])
    spec = runpy.run_path(spec_path)
    repo = spec["REPO"]
    base = spec["BASE"]
    old_tip = spec["OLD_TIP"]
    pathspec = spec["PATHSPEC"]
    backup_name = spec["BACKUP_NAME"]
    transforms = spec.get("TRANSFORMS", [])
    added_files = spec.get("ADDED_FILES", [])
    messages = spec.get("MESSAGES", {})
    scratch = os.path.dirname(spec_path)

    def git(*args, env=None, data=None):
        r = subprocess.run(["git", "-C", repo, *args], capture_output=True, env=env, input=data)
        if r.returncode != 0:
            sys.exit(f"FAILED: git {' '.join(args)}\n{r.stderr.decode()}")
        return r.stdout

    def out(*args, env=None, data=None):
        return git(*args, env=env, data=data).decode("utf-8").strip()

    head = out("rev-parse", "HEAD")
    if head != out("rev-parse", old_tip):
        sys.exit(f"HEAD is {head}, but OLD_TIP resolves to {out('rev-parse', old_tip)}")

    outside = [line for line in out("status", "--porcelain").splitlines()
               if not any(line[3:].startswith(p) for p in pathspec)]
    if outside:
        sys.exit("uncommitted changes outside PATHSPEC:\n" + "\n".join(outside))

    snapshot_index = tempfile.mktemp(prefix="snapshot-index-", dir=scratch)
    snapshot_env = dict(os.environ, GIT_INDEX_FILE=snapshot_index)
    git("read-tree", "HEAD", env=snapshot_env)
    git("add", "-A", "--", *pathspec, env=snapshot_env)
    snapshot_tree = out("write-tree", env=snapshot_env)
    os.remove(snapshot_index)
    git("update-ref", f"refs/backup/{backup_name}-before-rewrite", head)
    git("update-ref", f"refs/backup/{backup_name}-working-tree-before-rewrite", snapshot_tree)

    commits = out("rev-list", "--reverse", f"{base}..{old_tip}").split()
    if not commits:
        sys.exit(f"no commits in {base}..{old_tip}")
    for c in commits:
        if len(out("rev-list", "--parents", "-n", "1", c).split()) != 2:
            sys.exit(f"{c[:7]} is a merge or root commit; only linear history is supported")

    def position(short):
        matches = [i for i, c in enumerate(commits) if c.startswith(short)]
        if len(matches) != 1:
            sys.exit(f"{short} matches {len(matches)} commits in {base}..{old_tip}")
        return matches[0]

    for short in messages:
        position(short)
    ranges = [(f, position(s), None if e is None else position(e), o, n) for (f, s, e, o, n) in transforms]
    additions = [(p, position(s), out("rev-parse", f"{snapshot_tree}:{p}")) for (p, s) in added_files]

    parent = out("rev-parse", base)
    mapping = []
    for i, c in enumerate(commits):
        index_file = tempfile.mktemp(prefix="rewrite-index-", dir=scratch)
        env = dict(os.environ, GIT_INDEX_FILE=index_file)
        git("read-tree", c, env=env)
        by_file = {}
        for (f, start, end, old, new) in ranges:
            if start <= i and (end is None or i < end):
                by_file.setdefault(f, []).append((old, new))
        for f, pairs in by_file.items():
            content = git("show", f"{c}:{f}").decode("utf-8")
            for old, new in pairs:
                count = content.count(old)
                if count != 1:
                    sys.exit(f"{c[:7]} {f}: transform matched {count} times:\n{old}")
                content = content.replace(old, new)
            blob = out("hash-object", "-w", "--stdin", data=content.encode("utf-8"))
            mode = out("ls-tree", c, "--", f).split()[0]
            git("update-index", "--cacheinfo", f"{mode},{blob},{f}", env=env)
        for (p, start, blob) in additions:
            if start <= i:
                git("update-index", "--add", "--cacheinfo", f"100644,{blob},{p}", env=env)
        tree = out("write-tree", env=env)
        os.remove(index_file)

        meta = git("log", "-1", "--format=%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%B", c)
        an, ae, ad, cn, ce, cd, body = meta.decode("utf-8").split("\x00")
        message = next((m for s, m in messages.items() if c.startswith(s)), body)
        commit_env = dict(os.environ, GIT_AUTHOR_NAME=an, GIT_AUTHOR_EMAIL=ae, GIT_AUTHOR_DATE=ad,
                          GIT_COMMITTER_NAME=cn, GIT_COMMITTER_EMAIL=ce, GIT_COMMITTER_DATE=cd)
        new_commit = out("commit-tree", tree, "-p", parent, "-F", "-", env=commit_env,
                         data=message.encode("utf-8"))
        mapping.append((c, new_commit))
        parent = new_commit

    with open(os.path.join(scratch, "rewrite-mapping.txt"), "w") as f:
        for old, new in mapping:
            f.write(f"{old} {new}\n")
    for old, new in mapping:
        print(old[:7], "->", new[:7], out("log", "-1", "--format=%s", new))
    new_tip_tree = out("rev-parse", f"{parent}^{{tree}}")
    print("snapshot tree:", snapshot_tree)
    print("new tip tree: ", new_tip_tree)
    print("NEW TIP", parent)
    print("TREES MATCH" if new_tip_tree == snapshot_tree else "TREE MISMATCH")


if __name__ == "__main__":
    main()
