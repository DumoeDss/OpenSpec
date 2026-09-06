## Context

`resolveOpenSpecRoot` in `src/core/root-selection.ts` is the CLI's public root-selection surface. Its nearest-root branch (no `--store`, `--project`, or `--target-line`) already opens the shared planning resolver through `resolveOpenSpecRootThroughPlanning`, which returns a complete `ResolvedOpenSpecRoot` carrying the `scope` capability, the `planningScope` description, and scope-owned `projectHome`, `configPath`, and `schemasDir`. The branch keeps that result only for `store-project` and `store-aggregate`. A positive `standalone` (or `legacy-store`) answer falls through to `resolveStandaloneOrLegacyRoot`, the frozen compatibility adapter, whose `makeRoot(nearestRoot, 'nearest')` carries no `planningScope`. `toRootOutput` serializes `scope` only when `planningScope` is present, so every JSON payload that reaches `toRootOutput` through `resolveOpenSpecRoot` (`list`, `status`, `instructions`, `show`, `validate`, `archive`, `doctor`, `context`) omits `root.scope` for an ordinary repo-local project. `rasen new change` is unaffected: it resolves through `resolveChangeCreationForCommand` and `rootFromCreationScope`, which already attach the creation scope's description.

The resolver side is correct: `StorePlanning.open({ intent: 'project-read' })` on the fixture yields `kind: standalone`, `source: nearest-standalone`, and `describePaths` (`src/core/store-planning/internal/resolver.ts`) already returns the exact standalone locations for `planning-checkout`, `project-home`, `project-config`, `project-schemas`, `project-work`, `specs`, `project-design-docs`, `active-changes`, and `archive-line`. The same standalone project already receives that scope when a registered project is selected explicitly with `--project`, because that branch returns the planning result directly. The defect is confined to the nearest-discovery handoff.

Two established behaviors constrain the repair. First, the compatibility adapter owns the standalone notices (`inheriting-store-config`, `unavailable-store-declaration`) and diagnostics (`invalid_store_pointer`, store-declaration availability and identity errors) emitted while classifying the nearest root, and it decides `root.source`. Second, `storeFinalizationDiagnostic` in `src/core/archive.ts` treats an absent `planningScope` as the signal to classify the root's own Store metadata (`classifyStoreRootLayout`) and refuse archiving into a legacy flat Store; the resolver reports `standalone` for an unregistered legacy flat Store checkout (no registry match leaves `store` undefined, so the nearest project root becomes a standalone ref), so attaching a scope to such a root would bypass that refusal.

## Goals / Non-Goals

**Goals:**

- Present the resolver's authoritative standalone scope in `root.scope` for nearest-discovered repo-local projects, with or without an active Change.
- Keep `root.path`, `root.source`, notices, and the standalone/legacy diagnostic taxonomy exactly as the compatibility adapter reports them today.
- Take every typed location from the resolver; synthesize nothing in serializers, commands, or skills.
- Leave Store v2 project and aggregate routing, legacy flat Store reads and refusals, `target_line_required`, frozen session selection, and the explicit selector branches untouched.
- Prove the repair with focused tests on an isolated fixture whose product checkout and planning tree are separate Git repositories, and prove Windows path identity in CI.

**Non-Goals:**

- Exposing a scope for nearest-discovered legacy flat Stores; they stay on the frozen adapter.
- Changing `PlanningScopeDescription`, `describePaths`, `toRootOutput`, `makeRoot`, or any JSON field name.
- Adding a new diagnostic, notice, option, dependency, or storage.
- Repairing or verifying the user's real checkout or any Ghostty planning tree; this Change ships a code fix and fixture-based proof only.
- Making the office-hours design-doc lookup a prerequisite; it is a consumer that starts working once `root.scope.paths["project-design-docs"]` is present.

## Decisions

### 1. Retain the positive standalone result in the nearest-root branch, after the compatibility adapter has run

The nearest-root branch of `resolveOpenSpecRoot` keeps its current order: it opens the planning resolver first, and a `store-project` or `store-aggregate` answer is returned as today. When the answer is `standalone`, the branch now awaits `resolveStandaloneOrLegacyRoot(options)` exactly as it does today, so the adapter still throws its established diagnostics and reports its notices once, and then returns the already-resolved scoped root instead of the adapter's projection. The `legacy-store` answer and every planning-resolver failure keep their current handling, including the `declaresAmbientStoreFact` and `declaresLayoutV2` rules.

Alternatives considered: returning the scoped result without consulting the adapter was rejected because it would drop the `inheriting-store-config` notice and the `invalid_store_pointer` and store-declaration diagnostics the adapter owns. Synthesizing a `planningScope` inside `toRootOutput` or `makeRoot` from `root.path` was rejected because `store-planning-scope-routing` requires compatibility fields to be projections of the selected scope, never the reverse, and a serializer-built scope would be fabricated authority. Teaching the compatibility adapter to call the resolver was rejected because it would resolve the same scope twice and blur the frozen adapter's boundary.

### 2. The scope is adopted only when three independent facts agree

The scoped standalone root is adopted only when all of the following hold; otherwise the compatibility projection is returned unchanged, exactly as today:

1. The planning resolver's `planningScope.kind` is `standalone`.
2. The `readOptionalStoreMetadataState(nearest)` read this branch already performs returned `null`: the nearest root declares no Store metadata file at all. A readable legacy or layout v2 declaration and an unreadable declaration (which throws and is caught) both keep the existing path, so `storeFinalizationDiagnostic` continues to receive a scope-less root and to refuse a legacy flat Store by classification.
3. The compatibility adapter answered with `source: 'nearest'`, no `storeId`, and a root path equal to the scoped root's path (`planning-checkout`) under the existing `samePathForPlatform` comparison. Both values are already canonical root values produced by their resolvers, so no additional `realpath` I/O is performed; the platform-aware comparison is what lets Windows drive-letter case spellings compare equal.

No new detection mechanism is introduced; each fact is an existing value in the same function. The guard never emits a scope that contradicts `root.path`, and a disagreement leaves today's behavior in place rather than inventing a diagnostic. The regression matrix asserts that the fixture set takes the adopting path and that an unregistered legacy flat Store checkout does not.

### 3. Field ownership: compatibility source and notices, resolver locations

The adopted result is the scoped root with `source` taken from the compatibility answer. `root.path` and `root.source` therefore keep their established values (`nearest`), and `root.scope.source` keeps the resolver's evidence (`nearest-standalone`, or `project-binding` when the project config records a `projectId` or a configuration-inheritance `store:` declaration). The two fields describe different levels of selection evidence and are not remapped onto each other; in particular the planning result's own `description.source` to `root.source` mapping (`project-binding` would become `declared`) is not applied to a nearest standalone root.

`scope`, `planningScope`, `projectHome`, `configPath`, `schemasDir`, `changesDir`, and `specsDir` come from the scoped root, as they already do for explicit `--project` standalone selection. `archiveDir` likewise remains the resolver's location. Artifact and action-context paths therefore stay coherent with `root.scope.paths`. Any `executionRoot` already supplied by the resolver is retained; this handoff invents no execution locator. The standalone fallback in `resolvedExecutionProjectRoot` remains the project root.

### 4. Downstream consumers need no change

Consumers that branch on `planningScope` were reviewed: `resolvePlanningActionContext` (`src/commands/workflow/shared.ts`) treats `kind: standalone` as repo-local compatibility and still grants `[specsDir, changesDir]`; `status` forwards `followupSelection`, which the resolver freezes as `{}` for standalone, so `buildNextSteps` renders the same hint as today; `withStoreFlag` only uses a selection carrying both Store and project; `isLegacyFlatStorePlanningRoot` in `work.ts` answers `false` for standalone either way; `archivePlanScope` records `kind: 'standalone'` for a standalone ref, adding the ref's `projectId` only when the project config declares one. `sideEffectProjectRoot` keeps version warnings and registry freshness on the standalone project root.

One observable side effect is accepted: `actionContext.readRoots` lists the scope-owned project home before the checkout root because `planningReadRoot` becomes `root.projectHome`; this is the shape an explicit `--project` standalone selection already produces, `version` stays `1`, and `allowedEditRoots` still minimizes to the checkout root.

### 5. Regression proof is fixture-based and Git-separated

`test/core/root-selection.test.ts` gains resolver-level cases for the nearest-standalone handoff (scope present, `root.source` still `nearest`, `project-binding` inheritance case with its notice, no adoption for an unregistered legacy flat Store checkout or an unreadable Store declaration, including an `ENOTDIR` metadata path). `test/commands/repo-local-typed-scope.test.ts` drives the built CLI on an isolated temporary fixture with its own `HOME`/`XDG` directories and separate `git init` repositories for the product checkout and its `rasen/` planning tree, asserting `root.scope.paths` for `list`, `status`, `instructions`, and `context` with and without an active Change, `changeRoot`/`planningHome.changesDir` containment, and the repo-local `actionContext`. Expected paths are built with `path.join`. The red gate is asymmetric by design: scope-positive cases fail before the repair while the preservation-guard cases already pass and must stay green. `test/fixtures/repo-local-typed-scope-smoke.mjs` proves the complete standalone lifecycle on the same kind of isolated fixture — typed-path comparison, strict validation, intent template, saved immutable preview, exact-token apply and replay, in-fixture canonical spec synchronization, nested planning commit and push to a local bare remote, and unchanged evidence and product `HEAD` — and is never pointed at this repository's own planning tree or any Ghostty checkout. `test/fixtures/repo-local-typed-scope-probe.mjs` is the reproduction aid; it is deleted once the permanent tests land. The regression author owns the test files; project-wide validation runs once at integration.

## Risks / Trade-offs

- [A root that is both a standalone project and an unregistered legacy flat Store gains a scope and bypasses the archive refusal] → Decision 2 adopts the scope only when no Store metadata file exists at the nearest root; the regression matrix includes that checkout.
- [`root.source` silently changes from `nearest` to `declared` for inheritance or `projectId` configurations] → Decision 3 keeps the compatibility `source`; tests assert `root.source === 'nearest'` alongside `root.scope.source === 'project-binding'`.
- [Notices are emitted twice or lost] → The compatibility adapter runs exactly once, in the same position as today; the scoped root is merged after it returns.
- [Compatibility and resolver disagree on the planning checkout path (symlinked or aliased roots)] → Platform-aware comparison of the two already-canonical root values; on disagreement the command keeps today's scope-less answer instead of publishing a contradictory scope.
- [Consumers pin the old `readRoots` shape or the absence of `root.scope` for repo-local output] → Decision 4 names the only accepted shape change; affected assertions are updated to the scope-derived values rather than re-pinned to the defect.
- [Windows path identity is unproven locally] → Evidence to date is from macOS. This Change does not extend the resolver's path-spelling normalization, so it promises only that equivalent Windows spellings resolve to the same standalone scope with native paths identifying the same canonical locations under platform-aware comparison, without byte-identical casing; the Windows CI shards must run the new suites before the Change is considered verified.

## Migration Plan

No data, configuration, or public option changes. Repo-local JSON payloads gain the `root.scope` object that Store-backed payloads already carry; `root.path` and `root.source` are unchanged, so existing consumers keep working and scope-aware skills start receiving typed paths. Rollback is reverting the `resolveOpenSpecRoot` edit and the accompanying comment update in `src/core/archive.ts`; no artifact written by this Change depends on the new field.

## Open Questions

None. The one judgment call — whether to expose a scope for nearest-discovered legacy flat Stores — is answered no for this Change; the frozen adapter remains their sole surface until layout migration.
