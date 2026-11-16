# Regional replication

Redemption creates versioned regional buckets and configures all-to-other-region replication from a primary-region replication stack. It imports bucket references, creates per-source replication roles, and invokes a custom-resource Lambda to apply replication rules after buckets exist. Use the configured region set; do not assume all services want this topology.

Read `s3-replication-stage.ts`, `s3-replication-stack.ts`, `replication-roles.ts`, and the handler together. The inspected IAM role distinguishes source replication-configuration/list/version reads from destination replication writes. The configuration Lambda additionally needs scoped PutReplicationConfiguration and PassRole permissions plus the platform custom-resource boundary.

The source handler replaces the bucket's replication configuration on Create/Update and removes it on Delete. Inspect existing rules before proposing adoption; this helper is not an append-only operation. Its physical ID is derived from bucket membership, so a topology edit can affect replacement/Delete behavior. Review updates, replacement, rollback, and deletion explicitly so an old custom-resource deletion cannot silently remove desired rules.

The source enables delete-marker replication, metrics, and replication-time settings. Treat these as requirements to confirm, not free defaults. Verify current AWS behavior/costs using public documentation where needed. Source/destination versioning, filters, role grants, and data validation belong in the plan. Configuring replication does not demonstrate that pre-existing objects have been copied; plan any backfill separately.

For cross-account destinations, additionally establish destination bucket ownership, destination resource policy, encryption/key access, object ownership requirements, and authorized identities. The regional source alone does not supply that contract.

Prepare tests for exact destinations and filters, correct source/destination ARN scopes, PassRole scope, and custom-resource Create/Update/Delete behavior. No replication API calls, object writes, or deployment are part of local preparation.
