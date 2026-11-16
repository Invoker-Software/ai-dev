---
spike: 001
idea: candidate-a-positional-terms
name: positional-array-roundtrip
type: standard
validates: "Given a RESOLVER record carrying terms: List[Int], when encoded and decoded by the pinned DynamoCodec 3.1.0, then the array survives as attribute type L and terms.head yields the plan's own term"
verdict: VALIDATED
related: [002]
tags: [dynamodb, codec, storage-shape, candidate-a]
---

# Spike 001: Positional array round-trip

## What This Validates

Given a `RESOLVER` record carrying `terms: List[Long]`, when encoded and decoded by the pinned
`DynamoCodec` 3.1.0, then the array survives as attribute type `L` and `terms.head` yields the
plan's own term.

## Research

Not re-run. `ECOM-13270/part-b-probes.md` Question 2 already established from the decompiled
`dynamodb-core_3-3.1.0.jar` that `DynamoCodec$listCodec.encode` calls `AttributeValue.fromL`, so a
`List` codec produces attribute type `L`. This spike confirms that end to end on a record shaped
like Candidate A, rather than re-deriving it.

## How to Run

Copy `PositionalArrayRoundtripSpikeSuite.scala` into
`dev/service/src/test/scala/com/siriusxm/commerce/quote/spike/`, then from `dev/`:

```
sbt -batch "service/testOnly com.siriusxm.commerce.quote.spike.PositionalArrayRoundtripSpikeSuite"
```

No Docker required — this is a pure codec test.

## What to Expect

Four passing assertions: `L` attribute type with elements in written order, order-preserving
round-trip with `terms.head` returning `12`, an absent array decoding to `None`, and an empty
array round-tripping as empty.

## Investigation Trail

1. First compile failed: `private val plan` collided with `weaver.junit.WeaverRunnerPlan`, pulled
   in by the wildcard `import weaver.*`. Renamed to `planKey`. Worth knowing for any future spike
   suite in this project — `plan` is not a usable identifier under that import.
2. Re-ran clean. 4/4 passing.

## Results

**VALIDATED.** Candidate A's shape is mechanically feasible with the pinned dependency. No custom
codec, no `forMapWithWithEncodedKeys`, no key-encoding functions — a plain `Option[List[Long]]`
field on a `derives DynamoCodec` case class works.

Two findings that matter beyond feasibility:

- **The empty array round-trips as empty.** `terms.head` on it throws. Candidate A's prescribed
  read is `terms.head`, and CLAUDE.md forbids `.head` on a list where emptiness is reachable
  (scalafix `DisableSyntax`, and the project's own "avoid `Option.get`, `.head` on lists" rule).
  Candidate A as specified cannot be implemented literally without violating that rule; it needs
  `headOption` plus a default, which reintroduces the same absent-value ambiguity the scalar shape
  has.
- **An absent array decodes to `None`**, indistinguishable from a written-but-empty array only if
  the writer omits the attribute. Both cases must be handled by the read side.
