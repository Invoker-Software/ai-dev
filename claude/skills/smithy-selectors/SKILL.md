---
name: smithy-selectors
description: Reference for Smithy selector syntax used with the readSmithyShapeIndex tool to filter shapes by kind, trait, ID, namespace, or graph relationship.
---

# Smithy Selectors

Use selectors with `readSmithyShapeIndex` to filter shapes instead of fetching all shapes and filtering manually.

## Shape type selectors

```
structure          all structure shapes
union              all union shapes
operation          all operations
service            all services
resource           all resources
list               all list shapes
map                all map shapes
string             all string shapes
enum               all enum shapes
intEnum            all intEnum shapes
```

## Trait presence selectors

```
[trait|smithy.api#http]              shapes with @http
[trait|smithy.api#documentation]     shapes with @documentation
[trait|smithy.api#required]          shapes with @required
[trait|smithy.api#deprecated]        deprecated shapes
[trait|smithy.api#error]             error structures
[trait|smithy.api#readonly]          read-only operations
[trait|smithy.api#paginated]         paginated operations
```

Trait shape IDs use the `namespace#TraitName` format. Traits in `smithy.api` are documented at https://smithy.io/2.0/spec/documentation-traits.html.

## ID / namespace substring selectors

```
[id|name *=? 'User']          shapes whose local name contains "User" (case-insensitive)
[id|name *= 'User']           same but case-sensitive
[id|namespace *=? 'payments'] shapes in any namespace containing "payments"
[id|name ^= 'Get']            shapes whose name starts with "Get"
[id|name $= 'Input']          shapes whose name ends with "Input"
```

Operators: `*=` (contains), `*=?` (contains, case-insensitive), `^=` (starts-with), `$=` (ends-with), `=` (exact), `!=` (not-equal).

## Relationship / graph selectors

```
service ~> operation                 all operations reachable from any service
service ~> structure                 all structures reachable from any service
[trait|smithy.api#http] ~> structure structures reachable from @http operations
```

`~>` follows all relationships recursively (transitive). `->` follows a single hop.

## Combining selectors

```
operation [trait|smithy.api#http]                     HTTP operations only
structure [id|name *=? 'Request']                     structures whose name contains "Request"
service ~> operation [trait|smithy.api#readonly]      read-only operations under any service
```

Multiple selectors on the same line are ANDed (both must match).

## Common patterns

| Goal | Selector |
|---|---|
| All HTTP operations | `operation [trait|smithy.api#http]` |
| All error types | `structure [trait|smithy.api#error]` |
| Shapes named like "User*" | `[id|name ^=? 'user']` |
| All operations under a service | `service ~> operation` |
| Deprecated shapes | `[trait|smithy.api#deprecated]` |
| Paginated operations | `operation [trait|smithy.api#paginated]` |
| All inputs/outputs | `structure [id|name $=? 'input'], structure [id|name $=? 'output']` |

Full selector specification: https://smithy.io/2.0/spec/selectors.html
