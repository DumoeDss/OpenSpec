## Why

A repo-local (standalone) project that is discovered as the nearest planning root reports `root.path` and `root.source` but no `root.scope`, so `rasen list --json`, `rasen status --change <name> --json`, `rasen instructions ... --json`, and `rasen context --json` expose no authoritative typed planning locations. Skills that are required to read `root.scope.paths` — spec sync (`specs`), design-doc placement (`project-design-docs`), and the Store spec-sync hard gate on `root.scope.kind` — cannot classify or address an ordinary repo-local project, even though the same standalone scope is already reported when a registered project is selected explicitly with `--project`.

The defect predates the previous archive Change: the fixture probe `test/fixtures/repo-local-typed-scope-probe.mjs` fails for `list`, `status`, and `context` at the branch base `2b2b5c3d370877aecf4f41f1fb2ef6228850d9b1` and at `5d20cccc`, and it fails identically with `--empty` (no active Change). The shared resolver already answers correctly: opening `StorePlanning` directly on the same fixture yields `kind: standalone`, `source: nearest-standalone`, and complete `active-changes`, `archive-line`, and `specs` paths. The loss happens in the CLI root-selection compatibility handoff, which discards that positive answer.

## What Changes

- Nearest-root discovery of a repo-local project keeps the authoritative `standalone` scope returned by the shared planning resolver, so machine-readable `root.scope` (kind, source, ref, typed `paths`, evidence, notices, follow-up selection) is present for `list`, `status`, `instructions`, `show`, `validate`, `archive`, `doctor`, and `context` JSON, including a project with no active Change. `rasen new change` already resolves through the authoring creation scope and reports its scope today; that path is not changed.
- The compatibility fields keep their established meaning: `root.path` and `root.source` (`nearest`) remain the legacy root-selection projection, `inheriting-store-config` and `unavailable-store-declaration` notices are still emitted, and standalone/legacy diagnostics (`invalid_store_pointer`, store-declaration availability and identity errors) keep their taxonomy. `root.scope.source` may legitimately differ from `root.source` (for example `project-binding` beside `nearest`) because the two fields describe different levels of selection evidence.
- Every typed path in `root.scope.paths` is the resolver's own location; no command, serializer, or skill synthesizes a repo-local path from `root.path`, `planningHome`, or the current directory.
- Legacy flat Store reads, Store aggregate and Store project routing, the `target_line_required` archive-line policy, frozen session selection, and the `--store`/`--project`/`--target-line` branches are unchanged.
- Regression coverage: a CLI journey on an isolated fixture whose product checkout and `rasen/` planning tree are separate Git repositories, plus resolver-level cases for the nearest-standalone handoff.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `store-planning-scope-routing`: Adds the requirement that a repo-local project discovered as the nearest planning root exposes its authoritative standalone scope in machine-readable root output while the compatibility projection, notices, and legacy diagnostics remain unchanged.

## Impact

- Affects `resolveOpenSpecRoot` in `src/core/root-selection.ts` (the nearest-root branch that hands a positive `standalone` planning result to the frozen compatibility adapter) and one explanatory comment in `src/core/archive.ts` whose behavior is unchanged. `StorePlanning.describePaths`, `toRootOutput`, and the JSON consumers listed above are not changed.
- Unblocks the `rasen-sync-specs` typed `specs` lookup, the `rasen-office-hours` and design-workflow `project-design-docs` lookup, and any agent that gates on `root.scope.kind` for repo-local projects. The office-hours lookup is a consumer of this repair, not a prerequisite for it.
- Requires focused regression tests under `test/core/` and `test/commands/` plus an isolated lifecycle smoke fixture under `test/fixtures/`; the reproduction probe is deleted once the permanent tests land. This Change's own artifacts are not archived, shipped, or spec-synchronized by its tasks, and no Ghostty planning tree is touched.
- No new dependency, storage, error code, or public option. Existing Store v2, legacy flat Store, and explicit-selector behavior is preserved.
- Evidence so far was gathered on macOS. The resolver's path-spelling normalization is not extended, so on Windows the Change promises only that equivalent spellings resolve to the same standalone scope with native paths identifying the same canonical locations; that behavior remains to be proven by the Windows CI shards before this Change is considered verified.
