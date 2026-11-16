# Existing-table migration

A new global-table definition and an existing-table migration are different tasks. Establish for every environment/region/table whether the physical resource is absent, tracked by a stack, orphaned, or owned elsewhere. Record the observation time and source. A stale runbook is not current state.

Capture key/index schema, item-count evidence and its limitations, writers, streams/consumers, replication topology, encryption, PITR/backups, retention policy, stack logical IDs, physical names, and pending deployment dependencies. Describe data recovery and service behavior during any proposed transition. Identify the actual pipeline identity and permissions rather than assuming a developer profile can perform the operation.

Compare available transition options against current AWS documentation and account policy, including import where supported and authorized. Do not assume conversion is in-place or automatically safe. A RETAIN policy can leave a physical table behind after a stack change; deleting a physical table out of band does not update CloudFormation ownership. Both tracked and orphaned resources require explicit reconciliation.

The historical quote ECOM-13137 cutover was dev-specific and encountered both ownership cases, deployment races, and an account-specific import denial. Its resource deletion sequence is not a reusable default. Do not infer that all environments forbid import or that historical backups still exist. Never route around a denied deployment identity or organization policy.

Prepare a local plan with preconditions, resource ownership transitions, writer coordination, approved deployment path, recovery criteria, and post-transition checks. Include regional ACTIVE/replica verification, data comparison, stream-consumer health, and application behavior. These are proposed live checks, not completed results. No table/stack deletion, import, restore, or deploy is authorized by invoking this skill.
