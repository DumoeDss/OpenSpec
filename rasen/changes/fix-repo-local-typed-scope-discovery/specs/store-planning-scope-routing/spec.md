## ADDED Requirements

### Requirement: Repo-local discovery exposes the authoritative standalone scope

When a planning command runs without an explicit selector in an unbound project whose qualifying local planning tree is discovered as the nearest root, its machine-readable root output SHALL include the resolved standalone scope: `kind`, the resolver's evidence `source`, the project `ref`, typed `paths` for the planning checkout, project home, project config, project schemas, project work, specs, project design docs, active Changes, and archive line, plus `evidence`, `notices`, and `followupSelection`. Every typed path SHALL be the shared planning resolver's own absolute, platform-native location for that project; no command or serializer SHALL derive a scope path from the root path, the planning-home fields, or the current directory. The scope SHALL be present whether or not the project has an active Change. The compatibility fields `root.path` and `root.source` SHALL keep their established projection: `root.source` SHALL remain `nearest` for nearest discovery even when the scope's own `source` records stronger evidence such as `project-binding` from a configured project id or an inherited Store configuration declaration, because the two fields describe different levels of selection evidence. Established standalone notices and diagnostics SHALL be reported unchanged, and the serialized scope SHALL remain a locator that confers no mutation authority.

#### Scenario: Nearest repo-local project reports its typed locations

- **WHEN** `rasen list --json`, `rasen status --change <name> --json`, `rasen instructions <artifact> --change <name> --json`, and `rasen context --json` run in an unbound project with a qualifying local `rasen/` tree and no `--store`, `--project`, or `--target-line` selector
- **THEN** each payload SHALL report `root.scope.kind` as `standalone` and `root.scope.paths` naming `active-changes`, `archive-line`, `specs`, `project-home`, and `project-design-docs` inside that project's local planning tree
- **AND** the same typed path SHALL be identical across those commands

#### Scenario: A project with no active Change still exposes its scope

- **WHEN** the same project's active-Changes directory contains no Change and `rasen list --json` or `rasen context --json` runs
- **THEN** the payload SHALL still include the complete standalone `root.scope`
- **AND** the empty Change list SHALL NOT be reported as an absence of planning scope

#### Scenario: Scope and artifact paths describe one planning tree

- **WHEN** `rasen status --change <name> --json` or `rasen instructions <artifact> --change <name> --json` resolves an active Change in a repo-local project
- **THEN** `changeRoot`, `evidenceDir`, `handoffDir`, and `planningHome.changesDir` SHALL be contained by or identical to `root.scope.paths["active-changes"]`
- **AND** `actionContext.planningWriteRoots` SHALL name only `root.scope.paths.specs` and `root.scope.paths["active-changes"]`

#### Scenario: Compatibility projection and inheritance notice are unchanged

- **WHEN** the nearest repo-local project's planning configuration declares a Store only for configuration inheritance or records a project id
- **THEN** `root.source` SHALL remain `nearest`, `root.path` SHALL remain that project root, and the established `inheriting-store-config` notice SHALL be reported exactly as before
- **AND** `root.scope` SHALL be present with `kind` `standalone` and its own evidence `source`, which is permitted to be `project-binding`

#### Scenario: Standalone and legacy diagnostics keep their taxonomy

- **WHEN** the nearest root carries a malformed, unregistered, or otherwise unavailable Store declaration
- **THEN** the command SHALL report the established standalone or legacy diagnostic or notice for that condition, such as `invalid_store_pointer`
- **AND** no standalone scope SHALL be fabricated for a root that the established rules do not accept

#### Scenario: Store-backed and legacy flat Store discovery are unaffected

- **WHEN** nearest discovery resolves a Store v2 project, a Store aggregate, or a legacy flat Store instead of a standalone project
- **THEN** root output, notices, and diagnostics SHALL be those already established for that scope kind, including `target_line_required` for an archive line without a verified target line
- **AND** no standalone scope SHALL be reported for it

#### Scenario: Windows spellings yield one repo-local scope

- **WHEN** the same repo-local project is resolved on Windows from starting paths that differ only by drive-letter case, separator form, or canonical filesystem spelling
- **THEN** every spelling SHALL resolve to the same standalone planning scope, and `root.scope.paths` SHALL be absolute, platform-native paths that identify the same canonical locations under platform-aware comparison
- **AND** no second planning scope or false binding conflict SHALL be reported
