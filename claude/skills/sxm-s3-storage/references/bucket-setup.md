# Bucket setup

Geo creates its ingestion bucket in the designated primary region and imports it elsewhere by ARN. It uses a customer-managed KMS key, blocks public access, defines lifecycle behavior, and chooses RETAIN for persistent environments versus DESTROY for PR resources. Its bucket explicitly has versioning disabled. Inspect its complete policy and notification role before extending it.

Redemption's regional bucket pattern enables versioning and uses S3-managed encryption. These examples serve different purposes. Do not disable versioning on a replicated bucket to match geo, or silently introduce lifecycle deletion because another service does so.

For a new bucket, determine who owns the name, key, and object lifecycle; whether PR instances need distinct names; and which stacks consume it. Follow existing naming helpers rather than inventing a cross-service naming format. Preserve current resource identity for existing data.

KMS access can involve the application role, bucket key policy, notification helpers, and cross-account principals. A bucket grant alone is not proof that encrypted objects can be read. Do not widen principals or KMS actions simply to imitate a broad historical policy.

Notifications on imported buckets may create helper functions/custom resources. Inspect their IAM boundaries, region, dependency order, and update behavior. Preserve existing notifications and exact object suffix/prefix filters. A deployment that changes notifications is an external mutation under the publishing boundary.
