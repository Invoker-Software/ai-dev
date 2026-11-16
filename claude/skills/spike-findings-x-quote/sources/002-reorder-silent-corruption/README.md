---
spike: 002
idea: candidate-a-positional-terms
name: reorder-silent-corruption
type: standard
validates: "Given a stored terms array on a real DynamoDB table, when a writer rewrites it with elements in a different order, then the read returns a different term with no error surfaced"
verdict: VALIDATED
related: [001]
tags: [dynamodb, storage-shape, candidate-a, failure-mode, testcontainers]
---

# Spike 002: Reorder silent corruption

## What This Validates

Given a stored `terms` array on a real DynamoDB table, when a writer rewrites it with elements in a
different order, then the read returns a different term with no error surfaced.

## Research

`ECOM-13270/part-b-probes.md` Question 1 compared 686 multi-element list attributes between a real
table scan and a write-side dry run: all 686 preserved order, 0 differed. That probe stated its own
limit — it is observational evidence from one write-and-read cycle, and it says nothing about a
writer that produces a different order. This spike exercises exactly that.

## How to Run

Requires Docker (testcontainers). Start Rancher Desktop first. Copy
`ReorderSilentCorruptionSpikeSuite.scala` into
`dev/service/src/test/scala/com/siriusxm/commerce/quote/spike/`, then from `dev/`:

```
sbt -batch "service/testOnly com.siriusxm.commerce.quote.spike.ReorderSilentCorruptionSpikeSuite"
```

## What to Expect

Four passing assertions against a real DynamoDB container.

## Investigation Trail

1. `primaryKey(pk, sk)` is not library syntax — it is a project-local private helper in
   `ConfigTableRecords.scala:71`. Inlined the `PrimaryKey(partitionKey -> …, sortKey -> …)`
   construction instead.
2. Ran against a real container. All four assertions passed on the first clean compile.
3. Probed the empty case as well as the reorder case, since 001 had shown `terms.head` is partial.

## Results

**VALIDATED — and the finding is negative for Candidate A.**

The reordering write is accepted with no error of any kind. Writing `[12, 9, 3]` then `[3, 9, 12]`
to the same key moves `terms.head` from `12` to `3`. No schema constraint, no codec error, no
conditional check, nothing rejects it. Under Candidate A that is a changed savings reference term,
reported as a normal value.

Corroborating results, both consistent with Question 1's probe:

- Order survives a plain write-and-read cycle unchanged.
- A 25-element array round-trips positionally, so position is the only precedence signal available.
- An empty array is stored and read back empty, confirming `terms.head` is not total.

**What this means for the storage-shape decision.** The failure mode is not hypothetical and not
detectable at write time. Candidate A stores precedence in element order, and element order is the
one property nothing in the stack enforces — not DynamoDB, not the codec, not the record type. A
term-keyed map (Candidate B) makes the same mistake impossible to express: a term is addressed by
its own value, so a writer that emits entries in a different order produces an identical map.

This does not decide the vote. It quantifies one axis the vote should weigh.
