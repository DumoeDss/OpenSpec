# Review remediation verification — LEAD observations

## Reviewed inputs

- Repair head `564d7ab5be1dd767f91d46ff50063d19178f9714`, tree `e90086ca5150787f629ecbec818bf2c90cc4b3ea`.
- Integrated head `1f9ee439eeeb4eff6596a77f8f0f614bfcabf30b`, tree `966b3fa306654d222b592c5e23213677d52be84f`; upstream `3258a8cb6a0e51267e0be2c794a67ec934e0cde2` was merged without rewriting history after PR #188 landed.
- The only manual merge resolution combined the independent CHANGELOG entries. Independent reviewers checked their repair-owned source/test paths unchanged between these heads.
- This report records commands and output observed directly by Main. It does not reinterpret the older pre-WIN-01 evidence as a post-repair run.

## Shared metadata and discovery gate

Executed against repair head `564d7ab5be1dd767f91d46ff50063d19178f9714`:

```sh
env -u ZSH RASEN_LANG=en pnpm exec vitest run test/core/root-selection.test.ts test/commands/repo-local-typed-scope.test.ts test/core/store-planning test/commands/store-root-selection.test.ts test/commands/declared-store-fallback.test.ts test/commands/store-v2-planning-scope-journey.test.ts test/commands/store-aggregate-cli.test.ts test/commands/store-target-line-cli.test.ts test/commands/context.test.ts test/commands/context-workspace.test.ts test/commands/artifact-workflow.test.ts test/core/list.test.ts test/core/archive.test.ts test/core/archive-consumer-integration.test.ts test/commands/doctor.test.ts test/commands/store-migration-cli.test.ts test/core/store/ --reporter=dot
```

The Vitest setup ran `node build.js --if-stale`, rebuilt `dist/` successfully, then executed the suites.

```text
Test Files  93 passed (93)
     Tests  1718 passed | 2 skipped (1720)
  Duration  267.40s
```

The additional `test/core/store/` scope exercises the shared optional-metadata read's Store bootstrap, registration, inspection and migration consumers. This is a bounded local gate, not a claim that the complete local project suite ran.

## Type and lint gate

```sh
pnpm exec tsc --noEmit
pnpm exec eslint src/core/root-selection.ts src/core/archive.ts src/commands/doctor.ts src/core/store/foundation.ts test/core/root-selection.test.ts test/commands/repo-local-typed-scope.test.ts test/commands/declared-store-fallback.test.ts test/commands/doctor.test.ts test/core/store/foundation.test.ts
```

Both exited0 on repair head. Native integrated CI's `Lint & Type Check` job also passed.

## Upstream integration gate

Executed against `1f9ee439eeeb4eff6596a77f8f0f614bfcabf30b`:

```sh
env -u ZSH RASEN_LANG=en pnpm exec vitest run test/core/root-selection.test.ts test/commands/repo-local-typed-scope.test.ts test/core/store-planning test/commands/store-root-selection.test.ts test/commands/declared-store-fallback.test.ts test/commands/store-v2-planning-scope-journey.test.ts test/commands/store-aggregate-cli.test.ts test/commands/store-target-line-cli.test.ts test/commands/context.test.ts test/commands/context-workspace.test.ts test/commands/artifact-workflow.test.ts test/core/list.test.ts test/core/archive.test.ts test/core/archive-consumer-integration.test.ts test/commands/doctor.test.ts test/commands/store-migration-cli.test.ts test/core/archive-accounting.test.ts test/core/archive-fault-matrix.test.ts test/core/archive-os-metadata.test.ts test/core/store/finalization-plan-token.test.ts --reporter=dot
```

This includes the original consumer/Store-planning gate and every test file changed by the upstream merge. Vitest rebuilt the integrated CLI; a later `--if-stale` check reported that `dist/` matched current sources.

```text
Test Files  22 passed (22)
     Tests  517 passed (517)
  Duration  188.20s
```

## Actual integrated CLI surface

```sh
RASEN_LANG=en node bin/rasen.js validate fix-repo-local-typed-scope-discovery --type change --strict --json --no-interactive
RASEN_LANG=en node bin/rasen.js doctor --json
```

Both exited0. Strict validation returned `valid: true`, `issues: []`, and totals1 passed/0 failed. Doctor returned `root.healthy: true`, `root.source: nearest`, `root.scope.kind: standalone`, and `root.scope.intent: project-read`, with the resolver-owned planning paths under this repository's `rasen/` tree. No real archive operation was run.

## Fixture isolation proof and cleanup

Before WIN-01, Main ran the poisoned-sentinel recipe from `fix-report-sg-r1.md`:54 tests across2 files passed, with sentinel HEAD/index/tree/session bytes unchanged and environment restored. That is specifically the pre-WIN-01 isolation run; the fixture-isolation source remained unchanged in later repair/integration commits. Native Windows and POSIX execution is recorded separately in `native-ci-r2.md`.

The owned one-use `check-sg-isolation.mjs` was removed after successful verification, followed by its now-empty temporary directory. No throwaway script was retained in product source. Original lifecycle/probe scripts had already been removed in the implementation phase.

## Native evidence and unresolved-at-capture boundary

See `native-ci-r2.md` for verbatim job excerpts at integrated head. The changed Windows cases passed, including the originally failing unreadable-metadata CLI case,52 root-selection tests,24 foundation tests and32 doctor tests. Linux passed432 files/7618 tests with40 skipped. At capture time, a separate Windows archive timeout was undergoing a code-unchanged failed-job rerun; this report does not claim an all-CI pass. The final disposition and run attempt belong in `review-cycle-report.md`.

## Preserved boundaries

- `rasen/config.yaml` remained user-owned, unstaged and uncommitted.
- No Ghostty data, real canonical-spec synchronization, global installation, real Change archive, ship, PR merge, approval or auto-merge.
- PR #189 existed before review, and the topic branch was pushed to origin for the upstream PR.
