# Smithy source, validation, and adoption

Api-registry already contains smithy-docs-navigator and smithy-selectors. The former locates published documentation through https://smithy.io/2.0/llms.txt and reads canonical RST/Markdown source rather than relying on a summarized rendering. Use the index-provided source URL instead of guessing extensions. For a trait, resolve its documented shape ID and full definition. Public specifications do not settle internal registry conventions.

The selectors reference uses shape types, trait predicates, and graph reachability to narrow the affected shapes. If readSmithyShapeIndex is available and appropriate, use it for targeted queries; otherwise inspect source/model indexes locally. Do not assume that tool is installed. Resolve exact selector syntax from the canonical specification when needed rather than reproducing unsupported examples.

The api-registry instructions specify mill-wrapper.sh rather than raw mill because it provides Artifactory environment setup. The local validation sequence for an implementation change is smithy.formatCheck, smithy.integratedModel, and show smithy.checkCompatibility. Confirm the wrapper and task names on the target ref. smithy.debugCompatibility is documented as local-friendly but is not automatically equivalent to the CI check. Generated smithy-build.json is user-specific and ignored; regenerate only when required, without committing credentials.

Changes in table-registry actions may require CI dry-run evidence that is not fully available locally. Mark it pending, not passed. Read registry ownership restrictions before touching shared metadata. Do not copy the publication steps from main.yml into a local task.

For service codegen, update the source model or published contract dependency as appropriate. Compile against generated types, adapt mappings/routes/errors, and add tests for actual request/response behavior. Preserve wire names and serialization, including optional/required and error/status behavior. A locally edited registry model does not make a new published version available to a separate service.
