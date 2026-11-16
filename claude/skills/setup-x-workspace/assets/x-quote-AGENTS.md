# quote-service

Scala 3 HTTP service replacing `instant-quote-service`. Cats Effect for the runtime, http4s for the server.

## Directory structure

```
/               # local workspace — AI agent config, memory, tooling; own local-only git repo
dev/            # → ../quote-service     — Scala project root; git is initialized here
brm-sms/        # → ../sms/sms_src       — BRM (C opcodes) — the system of record
legacy/         # → ../instant-quote-service — abandoned Go port of BRM
ECOM-xxxx/      # per-ticket working directory — artifacts that don't belong in the quote-service repo
```

`dev/` is the active build target. `brm-sms/` is the behaviour oracle — BRM is the system of record, and `dev/` exists to match it. `legacy/` is an abandoned Go port of BRM. It is not running in production and was never finished, so it does not settle behaviour questions; read it as one prior attempt at interpreting BRM, useful where it agrees with BRM and evidence of nothing where it does not.

Each Jira ticket gets its own `ECOM-xxxx/` directory. Any artifact created for that task that should **not** be committed to quote-service goes here — notes, specs, scratch files, research, intermediate outputs, etc. Nothing in `ECOM-xxxx/` belongs in the quote-service git history.

The parent directory (`/`) has its own local-only git repo, separate from `dev/`'s quote-service repo, used to track workspace progress (`.planning/`, this file, `.claude/`, `ECOM-xxxx/`). `dev/`, `brm-sms/`, and `legacy/` are gitignored here since each is already tracked in its own upstream repo. This workspace repo is local-only — never push it anywhere.

## Implementation reference

The goal of `dev/` is to be behaviour-identical to BRM. Three sources, in precedence order:

| Source | Role |
|---|---|
| `brm-sms/` | BRM — the system of record. Authoritative on business logic, field semantics, and expected values. |
| `legacy/` | instant-quote-service (Go) — abandoned, unfinished port of BRM. Carries the wire contract and a second reading of BRM. Not authoritative on behaviour. |
| `dev/` | quote-service (Scala 3) — the build target. |

When implementing a feature, read BRM first, then check what `legacy/` did with it. Where `legacy/` and BRM disagree, BRM wins and the difference is a legacy defect worth recording rather than replicating. Where `legacy/` implements something BRM does not, do not port it without finding its BRM basis first. Where `dev/` and BRM disagree, `dev/` is wrong unless a code comment states the divergence is deliberate.

Useful BRM entry points:

| Path | Contents |
|---|---|
| `brm-sms/sys/fm_sir_srvc/fm_sir_srvc_get_quote.c` | the quote opcode — savings, MSRP/MRDP, impact categories |
| `brm-sms/sys/fm_sir_srvc/fm_sir_srvc_get_offer_catalog.c` | field descriptions, including MRD naming |
| `brm-sms/sys/fm_sir_srvc/docs/*.xml` | opcode field dictionaries |
| `../sms/sms_test/apps/bunit/scenarios/fm_sir_srvc/SIR_OP_SRVC_GET_QUOTE_*.xml` | expected-value scenarios — the closest thing to BRM unit tests |

Known divergences between the three are catalogued in `QUOTE-DISCREPANCIES.md`; read it before treating a mismatch as a bug. `QUOTE-KB.md` is the index for both that and the domain model.

`grep -rn` across `brm-sms/` (and `../sms/sms_test/`) is fast and often settles a question that neither Scala repo answers. Do not pass `--include=*.c` in zsh without quoting; it expands as a glob and fails.

**Always check which branch you are reading.** `dev/` carries several stale local branches at varying distances from `origin/main`, and `service/` + `integration/` differ substantially between them. Read source with `git show <ref>:<path>` and state the ref, rather than trusting whatever the working tree happens to be on. Merged branches can be pruned; list them with `git -C dev branch --merged origin/main`.

## Live BRM quick quote

A live BRM quick quote is reachable and is the strongest available evidence for a pricing question. Request shapes: `geo-service/docs/GEO.postman_collection.json`. Needs the corporate VPN and a current `okta-aws-cli --profile cmrc-svcs-dev` session — both fail closed, so check them before reading a failure as a result.

- the token response field is `access_token`; the header name to send it under comes from `token_name` (`SXM_M_A`)
- `/rest/v8/account/info/all` takes `{"account":"<n>"}`
- `/device/v2_0/getdeviceinfo` maps a device id to its owning account, which is how to find an account with a given service type

Live BRM is production. Ask before each run. Account-info responses carry contact and billing fields and must not be committed; quick-quote responses do not. Test accounts and what they can and cannot show are in `QUOTE-KB.md`.

## Command log

Every command run for a ticket goes into `commands.md` in that ticket's working directory (aws-cli, gh, curl, sbt, git, filesystem operations, and any other command).

- One entry per command: a one-line purpose, then the command in a fenced `bash` block.
- User-specific data is extracted to a shell variable defined at the top of the entry or file, and the command uses the variable. This covers account ids, ARNs, hostnames, resource and table names, ticket and PR numbers, radio ids, account numbers, emails, and paths that contain a username.
- Secret values (API keys, tokens, passwords) are never written. The variable is set from its source, for example `API_KEY=$(aws secretsmanager get-secret-value ... )`.
- The log is replayable by setting the variables.
- Append the entry when the command runs. Do not rebuild the log at the end of the ticket.

## Git branches

Branch names follow `ECOM-xxxx-short-description` — the ticket number first, then a kebab-case slug derived from the ticket name or the task being done.

Always propose the branch name and wait for explicit confirmation before running `git checkout -b` or any branch-creation command.

## AI agent rules

Leave no trace of AI involvement in any committed or tracked work.

- No `Co-Authored-By: Claude` or any AI co-author lines in git commit messages.
- No mentions of AI, Claude, or agents in commit messages, code comments, PR descriptions, or any file that enters version control.
- Write commit messages in the same voice as a human author on the team.
- Always show the full proposed commit message for review and wait for explicit approval before running `git commit`.
- Never run `git push` unless explicitly asked to.

## Commands

### quote-service (dev/)

Run from `dev/`:

```
sbt compile          # compile all modules
sbt test             # run unit tests
sbt integration/test # run integration tests
sbt format           # scalafmt + scalafmtSbt
sbt checkFormat      # format check (CI)
sbt lint             # scalafix
sbt checkLint        # scalafix --check (CI)
sbt check            # checkFormat + checkLint
make check           # verify-structure + verify-no-iqs-logic + sbt check;test
make verify-structure    # check required scaffold files exist
make verify-no-iqs-logic # check no IQS business logic leaked into service/src/
```

No Makefile exists in `dev/`; the `make` lines above do not run. Use the sbt commands.

#### Docker-free gate

Docker-backed suites are out of scope. `sbt validate`, `sbt integration/test` and `sbt script/test` all need a daemon.

**`sbt test` is not Docker-free either.** `ConfigTableRepoSuite` (package `infrastructure.persistence`) sits in the *service* module and is testcontainers-backed via `com.siriusxm.dynamodb.test.DynamoContainer`. Neither the suite name nor the module reveals it — only the import does. Without Docker it errors, and sbt's non-zero exit aborts every later command in the same `-batch` invocation.

From `dev/`:

```
sbt -batch "compileAll" \
  "service/testOnly * -com.siriusxm.commerce.quote.infrastructure.persistence.ConfigTableRepoSuite" \
  "apiModel/test" "check"
```

`compileAll` = `compile` + `Test/compile` + `integration/Test/compile` + `script/Test/compile`, so the integration module still type-checks. `check` = `checkFormat` + `checkLint`. Exclusion patterns go directly after the `*` filter, not after `--` — after `--` they are passed to weaver and silently ignored.

Root aggregates only `service` (which aggregates `apiModel`); `integration` and `script` are not aggregated. The parity suite does run on CI (`.github/workflows/build.yml:136`), so a green PR build is the available evidence for Docker-backed scenarios.

Two log-reading notes. `[error] fatal: No names found, cannot describe anything.` is the build's `git describe` finding no tags on a fresh branch, not a failure. And wrapping sbt as `(sbt …; echo "EXIT=$?" >> log)` makes the harness report the subshell's status, so read `EXIT=` from the log rather than trusting the reported exit code.

### instant-quote-service (legacy/)

Run from `legacy/`:

```
make build    # go build ./...
make test     # go test -race -count=1 ./...
make vet      # go vet ./...
make lint     # golangci-lint run
make vuln     # govulncheck
make fmt      # gofmt -w
make cover    # per-package coverage (90% minimum)
make check    # build + vet + lint + test + vuln
make ci       # full CI mirror: check + cover + cdk-synth
```

## Module layout

`dev/` (quote-service):

```
service/        # main service (main entrypoint, routing, config, domain logic)
integration/    # integration tests
```

Key files under `dev/service/src/main/scala/com/siriusxm/commerce/quote/`:

```
Main.scala                           # IOApp entry point
service/QuoteServer.scala            # HTTP server setup
api/QuoteRoutes.scala                # route handlers
config/QuoteServiceConfig.scala      # pureconfig-loaded config
healthcheck/HealthCheckRoutes.scala  # /health endpoint
application/package.scala            # business logic
infrastructure/package.scala         # external integrations
integration/package.scala            # integration adapters
model/package.scala                  # domain types
tracing/package.scala                # tracing setup
```

## Functional programming

This codebase uses functional programming throughout. Follow these rules strictly.

### Effects

- All side effects live in `IO` (cats.effect.IO). Never return raw `Future`, `Try`, or throw exceptions.
- Use `IO.raiseError` to signal failures, not `throw`.
- Model expected failures with `EitherT[IO, E, A]` or `IO[Either[E, A]]`; reserve `IO.raiseError` for truly unrecoverable errors.
- Acquire and release resources with `Resource[IO, A]`. Never open a connection or file without pairing it with a finalizer.

```scala
// correct
def load(path: Path): Resource[IO, Source] =
  Resource.make(IO(Source.fromFile(path.toFile)))(s => IO(s.close()))

// wrong — leaks on error
def load(path: Path): IO[Source] =
  IO(Source.fromFile(path.toFile))
```

### Immutability

- No `var`. No mutable collections (`ArrayBuffer`, `mutable.Map`, etc.).
- Shared mutable state must use `cats.effect.Ref`. Nothing else.
- `val` everywhere; `lazy val` only when evaluation must be deferred.

```scala
// correct
def counter: IO[Ref[IO, Int]] = Ref.of[IO](0)

// wrong
var count = 0
```

### Pure functions

- Functions with no effects must be pure: same inputs → same output, no observable side effects.
- Separate pure computation from `IO`. A function that builds a config object is `pure`; a function that reads from the environment is `IO`.
- Avoid `Option.get`, `.head` on lists, partial functions applied to incomplete matches.

### Data modelling

- Use opaque types for domain primitives instead of raw `String`/`Int`.
- Prefer sealed hierarchies + pattern match over inheritance + overriding.
- No nulls. Ever.

```scala
opaque type SubscriptionId = String
object SubscriptionId:
  def apply(s: String): SubscriptionId = s
  extension (id: SubscriptionId) def value: String = id
```

### Type classes

- Use `given`/`using` (Scala 3 syntax). Never write `implicit`.
- Derive type class instances with `derives` where possible (e.g. `derives Codec.AsObject`).
- Scope `given` instances as narrowly as possible — companion object first, then dedicated `Instances` object.

## Scala 3 syntax

The compiler enforces `-new-syntax`. Use it everywhere.

```scala
// control flow — use then/do, not braces
if x > 0 then positive else negative
for x <- xs if x > 0 do process(x)

// match — always use dot-match, not standalone match expression
x.match
  case 1 => "one"
  case _ => "other"

// enums
enum Color:
  case Red, Green, Blue

// extension methods
extension (s: String)
  def trimmed: String = s.trim
```

- End markers: required by scalafmt when a definition exceeds 30 lines.
- Optional braces: scalafmt removes them automatically. Write code in the indentation style.
- No procedure syntax (`def foo { }` → `def foo: Unit = `).

## Error handling

- Domain errors: model as a sealed trait, surface via `EitherT` or `IO[Either[E, A]]`.
- Unexpected errors: let them propagate as `IO` failures; handle at the boundary (e.g. in the HTTP layer).
- Never `.get` on an `Option` or `Either`; use `fold`, `getOrElse`, or `liftTo[IO]`.
- Never `asInstanceOf`. The scalafix `DisableSyntax` rule will reject it.

```scala
sealed trait QuoteError
case class NotFound(id: String)      extends QuoteError
case class InvalidInput(msg: String) extends QuoteError

def findQuote(id: SubscriptionId): IO[Either[QuoteError, Quote]] = ...
```

## Cats Effect patterns

### Concurrency

- `IO.both` / `IO.race` for concurrent work; avoid `IO.start` unless you need explicit `Fiber` control.
- `IO.parTraverseN(n)(list)(f)` for bounded parallelism over collections.
- `Deferred[IO, A]` for one-shot async hand-off between fibers.
- `Queue.bounded[IO, A]` for producer–consumer pipelines.

### Streaming

- `fs2.Stream[IO, A]` for any sequence that could be large or infinite.
- Connect streams at the boundary; don't load an entire stream into memory unless necessary.

### Logging

Use `log4cats` via the `com.siriusxm.logging` wrappers. Always pass the logger as a constructor argument (not a global).

```scala
final class MyService[F[_]: Logger](dep: Dep[F]):
  def run: F[Unit] = Logger[F].info("running")
```

## Testing

Tests use [weaver-cats](https://disneystreaming.github.io/weaver-test/).

- Extend `SimpleIOSuite` for tests with no shared setup.
- Extend `MutableIOSuite` when tests share a `Resource`-managed fixture.
- All assertions are `IO`-based; never use `Thread.sleep`.
- Test file names must end in `Suite` or `Spec` (check weaver discovery config).

```scala
import weaver.*

object QuoteRoutesSuite extends SimpleIOSuite:
  test("description") {
    for
      result <- myService.compute(input)
    yield expect(result == expected)
  }
```

- No mocking frameworks. Use simple in-memory implementations of traits.
- `weaverTest` is scoped to `Test` — never add it to `Compile` scope.

## Smithy / API model

- All API shapes live in `api-model/src/main/smithy/`. No Scala in that module except generated code.
- The smithy4s codegen plugin generates Scala from smithy on every compile. Never edit generated files.
- Service implementations belong in `src/` (root module), not in `api-model`.
- The Go smithy model in `legacy/smithy/` is the reference for the wire contract — shape names, field names, and request/response structure. Mirror it faithfully when defining shapes in smithy4s. It does not govern field *semantics* or computed values; those come from BRM.

## Scalafix rules (enforced)

These rules run in CI. Violations fail the build.

| Rule | What it rejects |
|---|---|
| `DisableSyntax` | `null`, `var`, `return`, `while`, `isInstanceOf`, `asInstanceOf`, XML literals |
| `ExplicitResultTypes` | Public members without explicit return types |
| `OrganizeImports` | Unorganized imports |
| `RemoveUnused` | Unused symbols (imports excluded — handled by compiler) |
| `NoValInForComprehension` | `val` inside `for` comprehensions |

Run `sbt lint` to auto-fix what can be fixed. Run `sbt checkLint` to verify.

## What to avoid

- `var`, mutable collections, `ArrayBuffer`, `ListBuffer`
- `null` — use `Option`
- `throw` — use `IO.raiseError` or `Either`
- `Future` — use `IO`
- `implicit` keyword — use `given`/`using`
- `@annotation.tailrec` workarounds for non-tail-recursive code — redesign with `fs2` or trampolining
- Partial functions on known-incomplete matches
- `.asInstanceOf` casts
- Side effects in constructors or `lazy val` bodies — wrap in `IO`
- Global mutable state of any kind

<!-- GSD:project-start source:PROJECT.md -->
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

- **Spike findings for x-quote** (implementation patterns, constraints, gotchas) → `Skill("spike-findings-x-quote")`
