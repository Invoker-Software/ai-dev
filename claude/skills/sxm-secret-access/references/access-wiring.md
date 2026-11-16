# Regional and cross-account access

Quote's secret stack creates owned secrets only in the primary region and supplies replica regions. It filters descriptors by enabled stage and applies different read/write resource policies for engineering and elevated roles in prod versus non-prod. Inspect the current target policy rather than normalizing these distinctions.

Quote's service stack separately references cross-account API-key secrets and constrains KMS actions with ResourceAliases. For ECS-injected values it also uses execution-role permissions, including a ViaService condition for Secrets Manager. These are different paths: task role is not a substitute for execution role, and a secret resource grant is not a substitute for key access.

Commerce-e2e's GitHub support stack creates an integration-test role and adds regional secret/KMS access. Chained role assumption means the identity initially authenticated to CI may differ from the final reader. Map both trust and data-access policies.

Prepare a matrix containing environment, region, secret owner/reference, key owner/reference, requesting principal, trust relationship, secret actions, key actions/conditions, and the code consuming the reference. Use symbolic configuration values instead of embedding real account IDs or payloads.

Existing broad key ARN patterns can be constrained by alias/service conditions. Preserve the conditions and verify the target's actual key policy. Do not claim cross-account access works from an identity policy alone. Static review can establish intended grants; successful live retrieval remains unverified, and retrieving a payload is outside this skill's setup task.
