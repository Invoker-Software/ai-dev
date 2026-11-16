---
name: spike-findings-x-quote
description: Implementation blueprint from spike experiments. Requirements, proven patterns, and verified knowledge for building x-quote. Auto-loaded during implementation work.
---

<context>
## Project: x-quote

**candidate-a-positional-terms** — Candidate A of the ECOM-13270 storage-shape re-vote: hold the
plan's terms in a positional JSON array on the `RESOLVER` record, with index 0 carrying the plan's
own term so precedence is expressed by position, read as `terms.head`. Spiked to give the team a
working implementation and a measured failure mode to vote against, rather than a description. The
competing shape, Candidate B, is a term-keyed map on the `PROMO#` row with the plan's own term as
an indexable scalar on `RESOLVER` — half of which already shipped in phase 18.

Spike sessions wrapped: 2026-09-08
</context>

<requirements>
## Requirements

From `candidate-a-positional-terms`:

- The spike stays out of `dev/` — nothing merged, `ECOM-13270/storage-shape-recommendation.md`
  stays marked not approved for implementation, and the team re-vote decides the shape (D-15).
- Both candidates stay live in the recommendation; a spike result is an input to the vote, not a
  substitute for it.
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| Resolver term storage shape | references/resolver-term-storage-shape.md | A positional terms array is buildable, but element order is unenforced — a reordering writer silently changes which term is authoritative, and `terms.head` is not total |

## Source Files

Original spike source files are preserved in `sources/` for complete reference.
</findings_index>

<metadata>
## Processed Spikes

- 001-positional-array-roundtrip
- 002-reorder-silent-corruption
</metadata>
