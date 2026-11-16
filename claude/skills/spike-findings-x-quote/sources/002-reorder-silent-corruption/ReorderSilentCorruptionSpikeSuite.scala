package com.siriusxm.commerce.quote.spike

import cats.effect.IO
import cats.effect.Resource
import com.siriusxm.dynamodb.DynamoTableOps
import com.siriusxm.dynamodb.codec.DynamoCodec
import com.siriusxm.dynamodb.model.PartitionKeyAttribute
import com.siriusxm.dynamodb.model.PrimaryKey
import com.siriusxm.dynamodb.model.SortKeyAttribute
import com.siriusxm.dynamodb.syntax.*
import com.siriusxm.dynamodb.test.*
import software.amazon.awssdk.services.dynamodb.model.ScalarAttributeType
import weaver.*

import scala.language.implicitConversions

private final case class TermsArrayRecord(
    PK: String,
    SK: String,
    terms: Option[List[Long]] = None
) derives DynamoCodec

private object ReorderFixtures:
  val tableStructure: TestTableStructure = TestTableStructure(
    KeySchema(
      partitionKey = Attribute(partitionKeyAttr("PK"), ScalarAttributeType.S),
      sortKey = Some(Attribute(sortKeyAttr("SK"), ScalarAttributeType.S))
    )
  )

// Does a real DynamoDB table preserve positional order of a list attribute, and
// what does a reordering writer produce on read?
object ReorderSilentCorruptionSpikeSuite
    extends DynamoSuiteWithSharedTableAndMappedResource[DynamoTableOps[IO]](
      ReorderFixtures.tableStructure,
      table => Resource.pure(table)
    ):

  override def maxParallelism = 1

  private val partitionKey: PartitionKeyAttribute = partitionKeyAttr("PK")
  private val sortKey: SortKeyAttribute           = sortKeyAttr("SK")

  private def key(pk: String): PrimaryKey =
    PrimaryKey(partitionKey = partitionKey -> pk, sortKey = sortKey -> "RESOLVER")

  test("a full-row rewrite in a different element order is accepted with no error"): table =>
    val pk = "PLAN#REORDER_FULL_PUT"
    for
      _       <- table.put(TermsArrayRecord(pk, "RESOLVER", Some(List(12L, 9L, 3L))))
      before  <- table.getAs[TermsArrayRecord](key(pk))
      // A writer that rebuilds the array in a different order. No schema, constraint
      // or codec rejects this — it is an ordinary put.
      _       <- table.put(TermsArrayRecord(pk, "RESOLVER", Some(List(3L, 9L, 12L))))
      after   <- table.getAs[TermsArrayRecord](key(pk))
    yield
      val headBefore = before.flatMap(_.terms).map(_.head)
      val headAfter  = after.flatMap(_.terms).map(_.head)
      expect.same(Some(12L), headBefore) and
        expect.same(Some(3L), headAfter) and
        expect(headBefore != headAfter)

  test("order survives a plain write-and-read cycle unchanged"): table =>
    val pk = "PLAN#REORDER_STABLE"
    for
      _   <- table.put(TermsArrayRecord(pk, "RESOLVER", Some(List(12L, 9L, 3L))))
      r1  <- table.getAs[TermsArrayRecord](key(pk))
      r2  <- table.getAs[TermsArrayRecord](key(pk))
    yield expect.same(Some(List(12L, 9L, 3L)), r1.flatMap(_.terms)) and
      expect.same(Some(List(12L, 9L, 3L)), r2.flatMap(_.terms))

  test("a longer array round-trips positionally, so position is the only precedence signal"): table =>
    val pk    = "PLAN#REORDER_LONG"
    val terms = (1L to 25L).toList.reverse
    for
      _ <- table.put(TermsArrayRecord(pk, "RESOLVER", Some(terms)))
      r <- table.getAs[TermsArrayRecord](key(pk))
    yield expect.same(Some(terms), r.flatMap(_.terms)) and
      expect.same(Some(25L), r.flatMap(_.terms).map(_.head))

  test("an empty array is stored and read back empty, so terms.head is not total"): table =>
    val pk = "PLAN#REORDER_EMPTY"
    for
      _ <- table.put(TermsArrayRecord(pk, "RESOLVER", Some(Nil)))
      r <- table.getAs[TermsArrayRecord](key(pk))
    yield expect.same(Some(Nil), r.flatMap(_.terms))
