# Investigation: repo-local typed scope missing from root output

Date: 2026-09-06. Platform: macOS (darwin 25.6.0, arm64). Branch `fix/repo-local-typed-scope` based at `2b2b5c3d370877aecf4f41f1fb2ef6228850d9b1`. No production edit had been made when this record was written.

## Reproduction

Probe: `test/fixtures/repo-local-typed-scope-probe.mjs`. It builds a temporary product checkout with a `rasen/` planning tree (`config.yaml`, `specs/`, `changes/`), runs `git init` separately for the product checkout and for `rasen/`, isolates `HOME`, `USERPROFILE`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, sets `RASEN_LANG=en`, strips inherited `RASEN_*` variables, and asserts `root.scope.paths` for `active-changes`, `archive-line`, and `specs`.

`node test/fixtures/repo-local-typed-scope-probe.mjs bin/rasen.js` (this session, unmodified working tree), exit code 1:

```
FAIL list authoritative repo-local scope: {"root":{"path":"<tmp>/product","source":"nearest"},"expected":{...}}
FAIL status authoritative repo-local scope: {"root":{"path":"<tmp>/product","source":"nearest"},"expected":{...}}
FAIL context authoritative repo-local scope: {"root":{"path":"<tmp>/product","source":"nearest","role":"openspec_root","workspaceIdentity":"product--d2d0bd8c"},"expected":{...}}
```

`node test/fixtures/repo-local-typed-scope-probe.mjs bin/rasen.js --empty` (no active Change), exit code 1: `FAIL list ...` and `FAIL context ...` with the same `root` shape. `<tmp>` abbreviates the `realpath` of the `mkdtemp` directory; `expected` was `<tmp>/product/rasen/changes`, `<tmp>/product/rasen/changes/archive`, `<tmp>/product/rasen/specs`.

The same shape appears on this repository itself: `RASEN_LANG=en node bin/rasen.js status --change fix-repo-local-typed-scope-discovery --json` returned `"root": {"path": "/Users/pashifika/Work/pashifika.github/rasen", "source": "nearest"}` with no `scope`, while `planningHome.changesDir` and `actionContext.planningWriteRoots` named the expected `rasen/specs` and `rasen/changes` directories.

Results reported by the coordinating session for the same probe: `FAIL` for `list`, `status`, and `context` at both `2b2b5c3d370877aecf4f41f1fb2ef6228850d9b1` and `5d20cccc`, and `FAIL` with `--empty`; `node test/fixtures/repo-local-typed-scope-probe.mjs bin/rasen.js --resolver --empty` (opening `StorePlanning` directly from `dist/core/store-planning/index.js` with `intent: 'project-read'`) `PASS` with `kind: standalone`, `source: nearest-standalone`, and complete paths. The coordinating session also confirmed that the previous archive Change touched none of the files named below. The defect therefore predates that Change and is not a resolver or serializer gap.

## Root cause

- `src/core/root-selection.ts`, `resolveOpenSpecRoot`, nearest-root branch: after `resolveOpenSpecRootThroughPlanning(options)` returns, only `store-project` and `store-aggregate` results are kept; a positive `standalone` result falls through to `resolveStandaloneOrLegacyRoot(options)`.
- `resolveNearestOrDeclaredRoot` returns `makeRoot(nearestRoot, 'nearest')`, which carries no `planningScope`.
- `toRootOutput` serializes `scope` only when `planningScope` is set, so every JSON consumer that reaches it through `resolveOpenSpecRoot` (`list`, `status`, `instructions`, `show`, `validate`, `archive`, `doctor`, `context`) omits `root.scope` for a nearest-discovered repo-local project. `rasen new change` is not affected: it resolves through `resolveChangeCreationForCommand` and `rootFromCreationScope`, which attach the creation scope's description.
- `StorePlanning` (`src/core/store-planning/internal/resolver.ts`, `describePaths`) already returns the exact standalone locations; explicit `--project` selection of a registered standalone project already carries `planningScope.kind === 'standalone'`.

## Constraints discovered for the repair

- `src/core/archive.ts`, `storeFinalizationDiagnostic`: an absent `planningScope` is the trigger for `classifyStoreRootLayout(root.path)`, which refuses archiving into a legacy flat Store. The resolver reports `standalone` for an unregistered legacy flat Store checkout, so the scope may be adopted only when the nearest root has no Store metadata file at all.
- `resolveOpenSpecRootThroughPlanning` maps `description.source` to `root.source` as `explicit` to `store`, `nearest-standalone` to `nearest`, anything else to `declared`; a standalone project with a `projectId` or an inheritance `store:` declaration reports `project-binding`, so `root.source` must keep the compatibility value rather than that mapping.

## Limitations

- All evidence in this record comes from macOS. Windows drive-letter case and separator behavior for the repo-local scope has not been observed locally and is assigned to the Windows CI shards in `tasks.md`.
- The user's real checkout and Ghostty planning tree were not modified or verified; the fixture is the only proof surface.
