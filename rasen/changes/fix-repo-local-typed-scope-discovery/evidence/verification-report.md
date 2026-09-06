# Repo-local typed scope verification

Date: 2026-09-06

Result: local implementation and bounded regression verification passed. Native CI verification is outstanding (task 3.4). This is an active Change, not an archive or ship record.

## Classification and root cause

The missing `root.scope` predates the preceding archive provenance fix. The isolated CLI probe failed at both `5d20ccccc0eba650feb3e53a718615baa89f8869` and the pre-archive baseline `2b2b5c3d370877aecf4f41f1fb2ef6228850d9b1`. It also failed with no active Change. Direct `StorePlanning.open({ intent: 'project-read' })` on the same fixture returned a standalone description and authoritative paths.

`resolveOpenSpecRoot` resolved the standalone scope but discarded it in the nearest-root compatibility handoff. The serializer and `StorePlanning.describePaths` already supported the required output. `new change` uses a separate creation path and was not affected.

A separate Change was created before production edits. Work is on `fix/repo-local-typed-scope`, based on `2b2b5c3d370877aecf4f41f1fb2ef6228850d9b1`, not on the preceding archive-fix branch. That branch and PR #188 were not changed. Their implementation and additional regression tests are not included in this branch; combined-branch verification is not claimed.

## Repair and compatibility boundary

- Retain the existing standalone scoped root only when Store metadata was positively absent, compatibility selection is `nearest`, no Store identity is present, and the canonical root paths agree under the existing platform-aware comparison.
- Run the existing compatibility path for its notices and diagnostics. Preserve `root.source`; retain resolver-owned scope metadata and paths without synthesizing locators.
- Keep legacy Store and unreadable-metadata roots scope-less. Otherwise an incorrectly attached standalone scope could bypass archive's legacy Store classifier.
- Change only the obsolete authoring-only scope comment in `src/core/archive.ts`; archive refusal logic, finalization evidence, and `codeCommit` policy are unchanged.
- Replace the old byte-identical JSON assertion in `test/commands/declared-store-fallback.test.ts` with the actual contract: local planning identity and locations remain stable while typed configuration-inheritance metadata differs legitimately.

## Observed verification

| Check | Result |
| --- | --- |
| Final pre-fix focused regression run | 5 failed, 48 passed; all five failures were missing-scope positives; preservation guards passed |
| Post-fix root-selection and new CLI regression suites | 53 passed, 2 files |
| Initial broader integration gate | 352 passed, 1 failed: obsolete whole-JSON byte equality with configuration inheritance |
| Adapted declared-store-fallback suite | 6 passed |
| Final broader integration gate | 353 passed, 16 files; 72.47 s Vitest duration |
| TypeScript and touched-file ESLint | Passed, exit 0 |
| Strict Change validation | 1 valid Change, zero issues |
| Change artifact status | proposal/specs/design/tasks all `done`; this reports artifact completeness, not completion of outstanding CI task 3.4 |
| Original CLI probe after repair | PASS for list/status/context; PASS for list/context without an active Change |
| Real isolated CLI lifecycle | PASS for typed discovery, strict validation, immutable preview, exact-token apply/replay, canonical spec synchronization, and nested planning Git commit/push |

The focused regression command was:

```sh
RASEN_LANG=en env -u ZSH pnpm exec vitest run test/core/root-selection.test.ts test/commands/repo-local-typed-scope.test.ts --reporter=dot
```

The final bounded gate was:

```sh
RASEN_LANG=en env -u ZSH pnpm exec vitest run \
  test/core/root-selection.test.ts \
  test/commands/repo-local-typed-scope.test.ts \
  test/core/store-planning \
  test/commands/store-root-selection.test.ts \
  test/commands/declared-store-fallback.test.ts \
  test/commands/store-v2-planning-scope-journey.test.ts \
  test/commands/store-aggregate-cli.test.ts \
  test/commands/store-target-line-cli.test.ts \
  test/commands/context.test.ts \
  test/commands/context-workspace.test.ts \
  test/commands/artifact-workflow.test.ts \
  test/core/list.test.ts \
  test/core/archive.test.ts \
  test/core/archive-consumer-integration.test.ts \
  --reporter=dot
```

Additional checks:

```sh
pnpm exec tsc --noEmit
pnpm exec eslint src/core/root-selection.ts src/core/archive.ts test/core/root-selection.test.ts test/commands/repo-local-typed-scope.test.ts test/commands/declared-store-fallback.test.ts
RASEN_LANG=en node bin/rasen.js validate fix-repo-local-typed-scope-discovery --type change --strict --json --no-interactive
RASEN_LANG=en node bin/rasen.js status --change fix-repo-local-typed-scope-discovery --json
```

Vitest's build-if-stale gate rebuilt the CLI after the source change. The final run reported that `dist/` matched current sources. Existing archive compatibility tests emitted their expected `archive.destination` deprecation warning; no configuration was changed to suppress it.

## Isolated lifecycle proof

The throwaway fixture used separate product and nested planning Git repositories, isolated HOME/XDG configuration, and no inherited RASEN/GIT environment. Only its local temporary bare remote received its planning push. The built CLI was exercised without `--skip-specs` or `--no-validate`.

Observed sequence:

1. `list`, `status`, and `context` returned identical standalone scope identities and typed planning paths.
2. The fixture read its existing canonical spec through the typed `specs` path and passed strict Change validation.
3. Intent-template creation and saved dry-run preview produced a complete plan with validation passed.
4. Apply used exactly the returned `archive-v1:` token. The canonical spec retained its existing requirement and acquired the declared additional requirement.
5. Applying the same token again completed as a replay. Discovery still returned the same typed paths after the active Change disappeared.
6. Nested planning commit/push left product HEAD unchanged. Archive accounting and evidence bytes remained identical across replay and planning commit/push.

The smoke command returned:

```text
PASS typed discovery -> strict validation -> intent -> saved preview -> exact-token apply/replay -> canonical spec synchronized -> nested planning commit/push; evidence unchanged, product HEAD unchanged.
```

The two throwaway scripts (`test/fixtures/repo-local-typed-scope-probe.mjs` and `test/fixtures/repo-local-typed-scope-smoke.mjs`) and the owned baseline export were removed after successful proof. The permanent regression suites remain; the removed script commands are historical evidence, not commands available in the final tree.

## Scope audit and tested worktree identity

Behavioral production change: `src/core/root-selection.ts`. Comment-only production change: `src/core/archive.ts`. Tests: `test/core/root-selection.test.ts`, `test/commands/repo-local-typed-scope.test.ts`, and `test/commands/declared-store-fallback.test.ts`. Documentation: `CHANGELOG.md` and this Change's artifacts.

Pre-existing user changes in `rasen/config.yaml` were preserved and are excluded from staging. No real Ghostty files, canonical specs, archive/evidence, global install, or package version were modified. No real archive, spec sync, ship, merge, or PR creation was performed.

The implementation remains in the working tree; the proposal boundary commit contains only this Change's artifacts. These SHA-256 fingerprints identify the tested source/test state independently of that documentation commit:

```text
1378418726ddb7bdd6c36c19f95c64969c4718c34f85e9528672275bba4c6b70  src/core/archive.ts
cc012bf9d76d91e6ceebd8c332eda407be1dd2b4c7d72788ec2dc394359b0a3d  src/core/root-selection.ts
95473dc459806048128a94e3b768abf51ef4d96d6f4493ff11ad7ada6d3df1bb  test/commands/repo-local-typed-scope.test.ts
c8c8155730c019ece1150c633985a507b55c326f3d18dbf9b8c31f7cd8a5a208  test/core/root-selection.test.ts
a4bc08f948cb607e8e057a2001c27251c4277e7b4df95fc42219580eb7d02a6f  test/commands/declared-store-fallback.test.ts
```

## Limits

Verification ran locally on macOS arm64. The complete project suite, native Windows CI shards, and POSIX CI jobs were not run for this tested implementation. Task 3.4 remains unchecked; no CI run ID or tested CI head SHA is claimed. No end-user Ghostty synchronization or archive was attempted, and the global CLI was not reinstalled.
