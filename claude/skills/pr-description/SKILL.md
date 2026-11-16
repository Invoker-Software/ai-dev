---
name: pr-description
description: Draft a pull request description with Summary, Testing and Notes sections in a terse, plain-language house style. Use whenever asked to write or draft a PR description, PR body, or PR write-up, or to prepare a branch for review. Covers what belongs in each section, what to leave out, and the wording rules (hyphens not em dashes, no hard wrapping, project abbreviations over expansions).
---

# PR description

Drafts the PR body only. Do not create, push, or edit a PR — write the text to a file and hand back
the path, unless the user explicitly asks for it to be posted.

Put the draft in the ticket working directory when the project has one (`ECOM-xxxx/`,
`.planning/`), otherwise a scratch path. Never commit it into the source repo.

## Sections

Four sections, in this order. Only Summary is required; include the rest when there is real content
for them. An empty or padded section is worse than an absent one.

```
# <TICKET-ID> <what changed, plainly>

## Summary
## Testing
## Notes
## Not included
```

### Summary

Why the PR exists, in four short paragraphs separated by blank lines. Not one block of prose, and
never more than eight sentences total. No code, no identifiers from the diff, no file paths.

1. **The issue.** What the code did and what wrong output it produced. State the mechanism in one
   or two sentences, in terms a reviewer who has not read the diff can follow.
2. **The triggering case.** Open with the literal words `Triggering case:` then the input that
   exposed it, then the observed discrepancy with both numbers and where each came from.
3. **The approach.** What the code does now. Describe the rule, not the implementation.
4. **The scale.** How much this changes, in counts.

Leave out anything another section already carries. If the reload, migration, or follow-up is
described under Not included, do not also mention it here. Do not describe test-fixture mechanics.

### Testing

Only testing a reviewer could not assume. Bullets, no sub-headers, no lead-in sentence.

Include comparisons against the external system of record — live calls, captured responses, figures
checked by hand. Give the plan or input, what the reference system returned, and what this branch
produces now against what it produced before.

Leave out unit tests, the CI gate, dry runs, replays through the project's own code, and anything
that was not run. Those either go without saying or belong in Notes.

Format each bullet as: `` `<input>` - <reference system> returns <figure>. <what we produce now, and before>. ``

### Notes

Everything else worth a reviewer's attention. Each note opens with a bold lead-in, then prose.

Both lead-in forms are fine — a bold complete sentence ending in a period, or a bold fragment
followed by a colon. Pick whichever reads plainly for the note.

What belongs here:

- A cause that predates the change, so the reviewer does not read it as newly introduced.
- A result that looks wrong until explained — a number going down when it should intuitively go up.
- A workaround or an extra manual step the change forces on whoever deploys it.
- A separate defect spotted while working on this one.
- Why the tests are shaped the way they are, when that is not obvious.

What does not belong here:

- Anything that cites a document the reviewer cannot open. Ticket working directories and planning
  notes are invisible from the PR — cut the note or restate it so it stands alone.
- Corrections to earlier internal write-ups. Those are bookkeeping, not review material.
- Trailing reassurance: "this is tracked as its own item", "this does not make things worse",
  "not caused by this change". State the fact and stop.

### Not included

Work deliberately left out, and what blocks it. One short paragraph.

## Wording

- **Hyphen, never an em dash.** Write `-` where a dash is needed. This applies inside prose,
  bullets and headings.
- **No hard wrapping.** One line per paragraph and per bullet, however long. Do not wrap at 80, 95
  or any other column — PR bodies reflow on their own.
- **Abbreviations over expansions.** Use the short form the team uses in conversation and in the
  ticket. Check `CLAUDE.md`, the ticket, and recent commit messages for the house term before
  expanding anything.
- **Name external systems the way the team names them.** A system has a data side and a serving
  side and they often have different names; do not use one where the team means the other. Read how
  the surrounding project documents refer to each before writing.
- **Digits, not spelled-out numbers.** `29 rows`, not `Twenty-nine rows`.
- **Backticks** for plan names, identifiers, field names and data values.
- **Plain and boring.** No idioms, no metaphors, no figures of speech. No contrast framing
  ("not X, but Y") — state Y. No first-person narration of effort.
- State uncertainty as fact: "unverified", "not confirmed by running it". Never "I think".

## Before handing it back

- Count the Summary sentences. Eight is the ceiling; six is better.
- Reread every Notes bullet and ask whether a reviewer with only the diff and the PR body can act
  on it. Cut the ones that need a file they cannot see.
- Check no em dash survived.
- Say plainly that no PR was created and give the file path.

## Worked example

This is the target register. Note the four Summary paragraphs, the two-bullet Testing section that
records only the live comparison, and the Notes that each carry one fact.

```markdown
# ECOM-13261 Fix SXIR rate selection so components stop publishing a zero base amount and GL id

## Summary

The pricing extractor chose which rate to read from a product tier based on the deal's type attribute, and treated that choice as the only option. A deal typed `SXIR` looked only for the linked rate, so when its product carried only a plain rate the extractor published zero - a base amount of 0 and a GL id of 0.

Triggering case: `Sponsored - FPO - All Access - 24mo - 181.22 - (Self-Pay)`. QQ returned a MRF of 29.06 while Quote-service gave 25.60, and the difference was one component priced at 18.12 in XML that we had published as 0.

Rate selection is now a preference chain rather than a single answer: an `SXIR` deal still prefers the linked rate but falls back to the plain one when the selected tier has none, and the base and discount sides resolve independently so one side matching does not suppress the other's fallback.

Across the full catalogue this changes 524 component rows on 510 plans: 287 recover a real base amount, 47 recover a discount amount, and 207 recover a GL id.

## Testing

- `Essential Streaming - 12mo` - QQ returns 132.24 with a fee of 11.64. The corrected extractor publishes 132.24 for that component; before the fix it published 0.
- `Sponsored - FPO - All Access - 24mo - 181.22 - (Self-Pay)` - QQ returns a fee of 29.06. Quoted on two separate accounts, one holding an active subscription in an overlapping package and one with no active subscription at all, to rule out anything account-specific. The corrected snapshot now computes 29.06 for this plan; the previous snapshot computed 25.60.

## Notes

**The rule predates this codebase.** The same unconditional linked-rate selection exists in the abandoned Go extractor, so this was inherited in the port rather than introduced by it.

**Savings figures go down on 284 plans, and that is the defect clearing.** Savings are computed as a reference amount minus the plan's own total. With the components zeroed the total was zero, so the entire reference amount was being reported as a discount. One plan was going out as costing 0.00 while claiming a saving of 132.24. After the change it costs 132.24 and claims nothing.

**A separate defect was found**: The extractor treats every `SXIR` deal as linked, but QQ only applies the linked rate when the plan also carries a satellite deal alongside it. 29 standalone streaming plans therefore get the wrong rate and, because the two rates carry different GL ids, the wrong MRF percentage - 19.98% where QQ uses 8.8%.

## Not included

The dev config table reload. It is blocked on the provenance of the base-price input, which came from a test call with no documented way to reproduce it, and it needs a fresh decision on whether to write the whole catalogue or only the affected plans.
```

### What this example cut, and why

The first draft of it was longer. Each removal is a rule above in practice:

- Summary lost an explanation of why a zeroed row was indistinguishable from a genuinely free one, a
  sentence on the new error type, a sentence on regenerating the test fixture, and a closing
  sentence about the config table not being reloaded. The first two are detail the diff carries, the
  third is fixture mechanics, and the fourth is what Not included is for.
- Testing lost its lead-in sentence, its bold sub-headers, a bullet about a full-catalogue dry run,
  a bullet about replaying both outputs through the service's own arithmetic, and a paragraph on the
  Docker-backed suites that were not run.
- Notes lost a bullet about an unrelated stale field in the committed snapshot and a bullet
  correcting an earlier internal write-up. Both referred to documents outside the PR.
- The separate-defect note lost its closing two sentences, which said it was recorded elsewhere and
  that the reload would not worsen it.
