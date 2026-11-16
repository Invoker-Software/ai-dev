package com.siriusxm.commerce.quote.spike

import com.siriusxm.dynamodb.codec.DynamoCodec
import weaver.*

import scala.jdk.CollectionConverters.*

// Candidate A shape: the plan's own term at index 0 of a positional array on the
// RESOLVER record, read as terms.head.
private final case class CandidateAResolverRecord(
    PK: String,
    SK: String,
    planCode: Option[String],
    terms: Option[List[Long]] = None
) derives DynamoCodec

object PositionalArrayRoundtripSpikeSuite extends SimpleIOSuite:

  private val planKey = "PLAN#Sponsored - OEM Trial - All Access - 12mo - 114.16"

  pureTest("a positional terms array encodes to attribute type L, in written order"):
    val record  = CandidateAResolverRecord(planKey, "RESOLVER", Some("x"), Some(List(12L, 9L, 12L)))
    val encoded = DynamoCodec[CandidateAResolverRecord].encode(record)
    val termsAv = encoded.m().asScala("terms")
    val values  = termsAv.l().asScala.toList.map(_.n())
    expect(termsAv.l() != null) and
      expect.same(List("12", "9", "12"), values)

  pureTest("round-trip preserves element order, so terms.head is the plan's own term"):
    val record  = CandidateAResolverRecord(planKey, "RESOLVER", Some("x"), Some(List(12L, 9L, 12L)))
    val encoded = DynamoCodec[CandidateAResolverRecord].encode(record)
    val decoded = DynamoCodec[CandidateAResolverRecord].decode(encoded)
    expect(decoded.isRight) and
      expect.same(Some(List(12L, 9L, 12L)), decoded.toOption.flatMap(_.terms)) and
      expect.same(Some(12L), decoded.toOption.flatMap(_.terms).map(_.head))

  pureTest("an absent terms array decodes to None, so terms.head has no total reading"):
    val record  = CandidateAResolverRecord(planKey, "RESOLVER", Some("x"), None)
    val decoded = DynamoCodec[CandidateAResolverRecord].decode(DynamoCodec[CandidateAResolverRecord].encode(record))
    expect.same(Some(None), decoded.toOption.map(_.terms))

  pureTest("an empty terms array round-trips as empty, so terms.head would throw"):
    val record  = CandidateAResolverRecord(planKey, "RESOLVER", Some("x"), Some(Nil))
    val decoded = DynamoCodec[CandidateAResolverRecord].decode(DynamoCodec[CandidateAResolverRecord].encode(record))
    expect.same(Some(Nil), decoded.toOption.flatMap(_.terms))
