# Resolver term storage shape

How the plan's own nominal term is stored on the `RESOLVER` row of the quote-service config
table, and what the two competing shapes cost.

## Requirements

From the `candidate-a-positional-terms` idea:

- The spike stays out of `dev/` — nothing merged, `ECOM-13270/storage-shape-recommendation.md`
  stays marked not approved for implementation, and the team re-vote decides the shape (D-15).
- Both candidates stay live in the recommendation; a spike result is an input to the vote, not a
  substitute for it.

## How to Build It

### The shape that shipped (Candidate B's half)

Two scalar fields on `PlanResolverRecord`, populated by `PricingExtractor` from the plan's tplans
XML and read with no fallback:

```scala
final case class PlanResolverRecord(
    // …
    planTermLength: Option[Long] = None,
    planTermType: Option[String] = None
) derives DynamoCodec
```

Absent-case defaults land in the domain type as `planTermLength = 0` and
`planTermType = TermType.Default` (which is `Month`). The read side is one rule in one place:

```scala
def planTermLength: Int = resolver.planTermLength
def termLength: Int     = planTermLength
def isMonthly: Boolean  = resolver.isPlanMonthly
```

### Candidate A, if the vote picks it

A positional array on the same record works mechanically with no custom codec:

```scala
final case class CandidateAResolverRecord(
    PK: String,
    SK: String,
    terms: Option[List[Long]] = None
) derives DynamoCodec
```

`DynamoCodec$listCodec.encode` calls `AttributeValue.fromL`, so this stores attribute type `L`.
Order is preserved across a write-and-read cycle, verified against a real DynamoDB container and
independently across 686 real multi-element list attributes.

**It needs a writer-side ordering invariant that nothing in the stack provides.** See below.

### Running a storage spike

Write the suite into `dev/service/src/test/scala/com/siriusxm/commerce/quote/spike/`, run it,
then remove it — `dev/` must stay clean.

```
sbt -batch "service/testOnly com.siriusxm.commerce.quote.spike.<SuiteName>"
```

For a real table, extend `DynamoSuiteWithSharedTableAndMappedResource` from
`com.siriusxm.dynamodb.test` (requires Docker). Build the key directly:

```scala
private val partitionKey: PartitionKeyAttribute = partitionKeyAttr("PK")
private val sortKey: SortKeyAttribute           = sortKeyAttr("SK")

private def key(pk: String): PrimaryKey =
  PrimaryKey(partitionKey = partitionKey -> pk, sortKey = sortKey -> "RESOLVER")
```

## What to Avoid

- **Do not read a positional array with `terms.head`.** An empty array stores and reads back
  empty, so `.head` is partial. CLAUDE.md forbids `.head` on a list where emptiness is reachable.
  Candidate A cannot be implemented literally as specified; it needs `headOption` plus a default,
  which reintroduces the same absent-value ambiguity the scalar shape already has.
- **Do not assume element order is enforced.** Writing `[12, 9, 3]` then `[3, 9, 12]` to the same
  key is accepted with no error and moves `terms.head` from `12` to `3`. Nothing rejects it — not
  DynamoDB, not the codec, not the record type. Under a positional shape that is a changed savings
  reference term reported as a normal value.
- **Do not use `primaryKey(pk, sk)` in a spike.** It is a project-local private helper in
  `ConfigTableRecords.scala:71`, not library syntax.
- **Do not name a val `plan` in a weaver suite.** `import weaver.*` brings in
  `weaver.junit.WeaverRunnerPlan` and the collision produces a misleading type error.
- **Do not add a field to a persisted record and assume construction sites pick it up.** A field
  with a default is silently dropped by every construction site that does not name it, and the
  compiler cannot flag it. After adding one, grep every construction site of the *record* type,
  not just the domain type.

## Constraints

- `com.siriusxm.dynamodb` `dynamodb-core` 3.1.0 is the pinned version (`Versions.scala`).
  `derives DynamoCodec` handles `Option[List[Long]]` with no custom codec.
- A `List` codec produces attribute type `L`; a `Map` codec produces `M`.
  `forMapWithWithEncodedKeys[K, V](encodeKey, decodeKey)` exists for a non-`String` key; the
  automatic `given_DynamoCodec_Map` covers `String` keys only. No `Isomorphism` type ships with
  this library.
- No element of a DynamoDB list can be a partition, sort, or GSI key. A term held in a positional
  array is therefore not indexable.
- BRM keys `SIR_FLD_TERM_LIST` (`sir_flds.h:551`) by term value, not by position, accessed at
  `get_quote.c:2812` with a fallback to element id `1` at `:2815`. BRM's own keying contradicts a
  positional convention.
- Order preservation is observational, not a service guarantee. It held across 686 real rows and
  across the spike's container runs. An `UpdateExpression` replacing a single element in place was
  not exercised.

## Origin

Synthesized from spikes: 001, 002
Source files available in: sources/001-positional-array-roundtrip/, sources/002-reorder-silent-corruption/
