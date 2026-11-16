---
name: iswi-write-work-summary
description: Write a SUMMARY.md for a ticket's finished or in-progress work, in the ticket's working directory, from its planning artifacts, ticket records and git history. Use when asked to "write a summary for ECOM-xxxx", "summarise phase N and M", "write the work summary document", or to close out a ticket with a single document stating what was wrong, what changed, what was measured, what was verified, and what is still open. Covers gathering facts in a subagent, mapping commit SHAs after squashes or history rewrites, the section layout, and checking every figure against its source before committing.
argument-hint: "[ticket id, e.g. ECOM-13270] [optional: planning phase numbers the ticket's work spans]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
---

# Write a work summary

The output is one file, `<ticket-dir>/SUMMARY.md`, that a reader who has not followed the work can
use to learn what the ticket found, what shipped, the evidence for it, and what remains. Every
number, date, SHA and path in it is taken from a source and checked.

## Rules

- The document goes in the ticket's working directory (for example `ECOM-13270/`), never into the
  product repository, unless the project's instructions say otherwise.
- Follow the project's rules for documents in ticket directories: voice, whether decision
  identifiers or planning-phase names may appear, AI attribution, and whether and where to commit.
  A sibling ticket's `SUMMARY.md` is the best evidence of the local convention.
- State facts directly. Dates are absolute (`2026-09-10`, never "yesterday"). State what was not run
  or not confirmed as a fact ("not run locally; runs in CI"), not as a hedge.
- Do not publish the document anywhere. Commit it only where the project allows commits of ticket
  records, and follow its commit-approval rules.

## Step 1: Establish scope

1. Ticket id, ticket directory, product repository and branch.
2. The planning artifacts, if the project uses them: phase directories whose name or roadmap entry
   carries the ticket id (`ls .planning/phases | grep -i <ticket>`, `grep -n <ticket> .planning/ROADMAP.md`),
   pending and completed todos that mention it, and `STATE.md` decisions for those phases.
3. Precedent: `ls */SUMMARY.md` in sibling ticket directories. Read one in full and follow its
   layout and voice.
4. Current state: which plans have summaries, which are stopped at a checkpoint, which have not
   started. A summary of in-progress work says so in its first paragraph.

## Step 2: Gather facts in a subagent

The sources are usually tens of files. Delegate the reading to one general-purpose subagent so the
source text stays out of the main context, and write the document from its fact sheet. The prompt
must state:

- read-only: no edits, commits, builds, or calls to live services;
- the exact source list: every PLAN/SUMMARY/CONTEXT/VERIFICATION/REVIEW file in the phase
  directories, the relevant `STATE.md` and `ROADMAP.md` entries, every `.md` in the ticket
  directory (skip bulky data files but note which records cite them), related todos, and
  `git log --format='%h %ad %s' --date=short <base>..HEAD` in the product repository;
- the SHA rule in Step 3;
- a numbered list of facts to extract, each with its source path: the problem, decisions in date
  order with what each replaced and why, code changes grouped by purpose with current SHAs, live
  data or infrastructure operations with exact counts, measurements behind any "no output change"
  claim, verification that ran locally versus only in CI or not at all, current state, known bounds
  and out-of-scope follow-ups with where each is recorded, and an index of the ticket directory's
  documents marking superseded ones;
- to report conflicts between sources and missing facts explicitly instead of guessing;
- an output limit (about 3000 words).

## Step 3: Map commit SHAs

Planning summaries and ticket records cite the SHAs that existed when they were written. Squashes,
amends and history rewrites change them. Cite only SHAs reachable from the current branch:

1. `git log --format='%h %s' <base>..HEAD` gives the current list.
2. Match every cited SHA to a current one by commit subject. `refs/backup/*` refs and a rewrite's
   mapping file, when present, give the mapping directly.
3. `git cat-file -e <sha>^{commit}` and `git merge-base --is-ancestor <sha> HEAD` confirm each SHA
   used in the document.
4. When earlier records in the directory cite SHAs that no longer resolve, say so once near the
   commit table, as the precedent does.

## Step 4: Write the document

Use the sections below in this order and omit any that have nothing to say. Keep code excerpts
short and only where they show the change more exactly than prose.

1. `# <TICKET> — summary`, then one paragraph: the problem in one or two sentences, the state
   (shipped with PR link and date, or where the work stopped), and the verification status.
2. **Commit table**: current SHA and one-line contents per commit, grouped by purpose when there are
   many. A note on SHAs that earlier documents cite and that no longer resolve.
3. **The problem** (or "The defect"): what was wrong, the mechanism, and where it came from.
4. **Decisions**: in date order, what was chosen, what it replaced, and the reason, when the work
   involved choices that changed direction.
5. **The change**: what the code does now.
6. **Measured effect**: tables with exact counts, and what did not change.
7. **Before and after**: one concrete case with its figures.
8. **Live operations**: each write to shared data or infrastructure, with date, scope, counts and
   the record file.
9. **Tests and verification**: what ran with counts, what did not run and why, and where the gap is
   recorded.
10. **What clients will see**: the visible effect, or "Nothing yet" with the reason.
11. **Successor defects**: problems found while doing the work that it does not fix.
12. **Open items**: a numbered list, each starting with a bold one-line status, followed by detail,
    dates and the record that tracks it.
13. **Documents in this directory**: a table of file and contents, marking superseded files.

## Step 5: Check before committing

1. Every number: find it in the named source (`grep -n` in the record or summary). Recompute any
   derived figure (sums, differences).
2. Every SHA: Step 3's confirmation commands.
3. Every path: `test -e`.
4. Claims about the current code or data: a plan summary or record describes the state when it was
   written, and later work (including a history rewrite) can change it. Check each such claim ("a
   test reads file X", "symbol Y still exists", "CI runs suite Z") against the current tree with
   `grep` or the build and workflow files, and attribute a quoted decision to the file that
   actually contains it.
5. The project's voice rules: grep for forbidden terms, for example decision identifiers or AI
   attribution, if the project bans them in ticket records.
5. Read the document once in full for statements the sources do not support. Remove them or add the
   source.

Then commit following the project's rules, naming the file explicitly, and report the path, the
commit, and any conflicts between sources that the document had to resolve.
