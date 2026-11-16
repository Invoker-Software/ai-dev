# Provisioning and regional ownership

The quote source uses `TableV2` in its primary region and `findGlobalTableForReplicatedRegion` elsewhere. The primary definition declares PK/SK string keys, on-demand billing, a DynamoDB-owned key, point-in-time recovery, NEW_AND_OLD_IMAGES streams, and replicas excluding the primary. Each replica explicitly enables recovery. These are observed quote settings, not defaults for every service.

Offer follows the same ownership pattern but adds its own schema/import options, pinned logical ID, and PR-dependent removal policy. Read the target's helper signature and installed dependency version before using it. Do not transplant offer's compatibility exports into a new service.

The regional lookup is a reference to a table already owned by the primary stack. Creating another `TableV2` with the same physical name in a replica stack does not adopt the replica. Check primary creation precedes replica consumption in the deployment strategy. Grant each consumer its required access to its local table reference.

Stateful stack identifiers and exported values can be dependencies outside the edited file. Search consumers of the physical name, exports, table ARN, and stream ARN before changing them. PR removal behavior is not evidence that persistent environments permit deletion.

Verification should check resource type and schema in the primary template, region membership without duplicates, retained stateful resources, regional PITR declarations, and the absence of independent replica-region table creation. Avoid assertions that merely snapshot irrelevant template ordering.
