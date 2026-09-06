# CI triage, round 1: run 34026299987

Date: 2026-09-06. PR #189, branch `fix/repo-local-typed-scope`, base `2b2b5c3d370877aecf4f41f1fb2ef6228850d9b1`, tested head `8ab98e1d9ab242efdd68dac49a4b08a4cea91d06`. This record classifies the first native CI run of the Change; it does not close any finding and does not mark CI green. No build, test, lint, formatter, CI re-run, or Git mutation was performed for it. Facts come from the saved job list (`.rasen/changes/fix-repo-local-typed-scope-discovery/ephemera/ci-first-head-jobs.json`), the saved logs (`ci-windows-shard3.log`, `ci-linux-node24.log` in the same directory), and direct source reads.

## Tested state versus working tree

The run tested commit `8ab98e1d` only. The working tree at triage time carried, uncommitted and therefore untested by CI: the CAP-01 read-capability negotiation in `src/core/root-selection.ts`, the comment correction in `src/commands/doctor.ts`, the doctor consumer regression in `test/commands/doctor.test.ts`, the SG-001 environment boundary and SG-002 alias case table in `test/commands/repo-local-typed-scope.test.ts` and `test/core/root-selection.test.ts`, and the `CHANGELOG.md`, `design.md`, and `tasks.md` updates. While this record was being written, the WIN-01 repair landed in `src/core/store/foundation.ts` and `test/core/store/foundation.test.ts`, also uncommitted and untested. At `8ab98e1d`, `test/core/root-selection.test.ts` had 49 cases and no alias table.

## Job results

| Job | Conclusion | Note |
| --- | --- | --- |
| Detect changes, Lint & Type Check, UI Package Build | success | |
| Layout migration compatibility (linux, macos, windows) | success | |
| File placement recovery (linux, macos, windows node floor) | success | |
| Test (linux-bash), Test (macos-bash) | success | Logs not saved; per-test execution not recorded here |
| Test (windows-pwsh-shard-1), Test (windows-pwsh-shard-2) | success | Logs not saved |
| Test (windows-pwsh-shard-3), id 101467753264 | failure | WIN-01, below |
| Test (linux-bash-node24), id 101467753230 | failure | agent-dispatch marker, below |
| Test, id 101470339443 (step `Verify matrix tests passed`); All checks passed, id 101470339467 (step `Verify all checks passed`) | failure | Derived from the two failures above |
| Nix Flake Validation; All checks passed, id 101470340206 | skipped | |

## WIN-01: unreadable Store metadata adopts a scope on Windows

This failure belongs to this PR.

- Job: `Test (windows-pwsh-shard-3)`, image `windows-2025-vs2026`, node `v20.19.0`, `VITEST_FILE_PARTITION: 3/3`. Shard totals: Test Files 1 failed | 142 passed (143); Tests 1 failed | 2649 passed | 17 skipped (2667); 781.71 s.
- Failing case: `test/commands/repo-local-typed-scope.test.ts > repo-local typed scope discovery > does not adopt a standalone scope when Store metadata cannot be read`. Assertion: `expected { changes: [], root: { …(3) } } to not have property "root.scope"`. The received `root.scope` was a complete standalone scope (`kind: standalone`, `intent: project-read`, `source: project-binding`, `ref.projectId: repo-local-app`, all typed `paths` under `C:\Users\runneradmin\AppData\Local\Temp\rasen-repo-local-scope-BZgl2I\app`). Log lines 3500-3575.
- Same shard, passed: the other three cases of that suite, `test/core/root-selection.test.ts` (49 tests), `test/core/store/foundation.test.ts` (22 tests), `test/commands/declared-store-fallback.test.ts` (6 tests).
- Same case on `Test (linux-bash-node24)`: passed (`ci-linux-node24.log` line 5129). The defect is platform-specific.

Mechanism, traced in source and not executed here. `src/core/store/foundation.ts` and `src/core/file-state.ts` line numbers are those of head `8ab98e1d` (both files were unmodified in the working tree when read; the WIN-01 fixer changes `foundation.ts` afterwards). `src/core/root-selection.ts` line numbers are those of the working tree with CAP-01 applied; the same branch sat at `:1044-1096` at the tested head. The fixture writes a regular file at `<repo>/.rasen-store` (`test/commands/repo-local-typed-scope.test.ts:182` at the tested head, `:194` in the working tree). `readOptionalStoreMetadataState` (`src/core/store/foundation.ts:866-878`) returns `null` only when the read fails with `ENOENT`. `readStoreMetadataState` (`:823-829`) reads the path chosen by `resolveReadableStoreMetadataPath` (`:214-222`): modern file if it is a file, else legacy file if it is a file, else the canonical modern path. With a regular file at `.rasen-store`, neither `pathIsFile` check (`src/core/file-state.ts:77-83`) succeeds and the canonical `.rasen-store/store.yaml` is read. On POSIX that read fails with `ENOTDIR`, the error is rethrown, `standaloneMetadataAbsent` stays `false` in the nearest branch of `resolveOpenSpecRoot` (`src/core/root-selection.ts:1046-1056`), and the scope is not adopted. On Windows the received output proves the adoption branch ran (`:1081-1092`), which requires `standaloneMetadataAbsent === true`, so the optional read answered `null` for the same fixture. [INFERENCE] The Windows error code itself was not captured in the log; a path that traverses a regular file reporting as not found is the only route in this code to a `null` answer.

Requirement violated: `specs/store-planning-scope-routing/spec.md`, scenario "Standalone and legacy diagnostics keep their taxonomy" ("no standalone scope SHALL be fabricated for a root that the established rules do not accept"), and `design.md` Decision 2, fact 2, which assumes an unreadable declaration keeps the existing scope-less path.

Classification and ownership: the nearest-root adoption guard trusts the metadata seam's `null` as "no Store metadata at all", and that meaning did not hold on Windows. The repair belongs at the metadata seam in `src/core/store/foundation.ts`, not in command-specific spelling checks, weakened assertions, or a skipped Windows case. Owner: the Windows fixer (`src/core/store/foundation.ts`, `test/core/store/foundation.test.ts`, `evidence/fix-report-win-r1.md`). Status at the time of writing: source applied in the working tree and read directly (`readOptionalStoreMetadataState` confirms an `ENOENT` by requiring both `.rasen-store` and `.openspec-store` to be missing or directories, and rejects with an `ENOTDIR`-coded error when either is occupied by a non-directory entry; `foundation.test.ts` adds the occupied-namespace case table and a namespace-directory-without-file `null` boundary). One deliberate POSIX consequence is recorded in that report and in `design.md`: a regular file occupying `.openspec-store` with no modern metadata now rejects instead of reading as absent. No local run and no CI run of the repaired code exist; the finding is not closed.

## Linux Node 24: agent-dispatch marker parse

This failure is not in this PR's code.

- Job: `Test (linux-bash-node24)`, image `ubuntu-24.04`, node `v24.20.0`. Totals: Test Files 1 failed | 430 passed (431); Tests 1 failed | 7577 passed | 40 skipped (7618); 696.02 s.
- Failing case: `test/cli-e2e/agent-dispatch.test.ts > rasen agent dispatch --runtime claude > keeps the exact session busy when only the bridge parent dies and its worker survives`. `SyntaxError: Unexpected end of JSON input` at `test/cli-e2e/agent-dispatch.test.ts:284:14`, the `JSON.parse(fs.readFileSync(markerFile, 'utf8'))` that follows `await waitForFile(markerFile)`.
- `git diff --stat 2b2b5c3d370877aecf4f41f1fb2ef6228850d9b1...HEAD -- test/cli-e2e/agent-dispatch.test.ts test/fixtures/claude/fake-claude.mjs` is empty: this PR changes neither file.
- Inferred cause, from source only: `waitForFile` (`:94-102`) polls `fs.existsSync` and returns on existence; the fixture publishes the marker with one `fs.writeFileSync` of a JSON line (`test/fixtures/claude/fake-claude.mjs:20-27`). Existence can be observed before the content is written, so the parse sees an empty file. This is an inference about a pre-existing publication race in unchanged fixture code. It was not reproduced on any runtime, it is not shown to be Node 24 specific, and the same case's execution on the other passing POSIX jobs is not recorded because their logs were not saved.
- Disposition: not fixed in this Change. LEAD decides whether to re-run the job or track the fixture separately.

## Local verification reported before WIN-01 remediation

LEAD reported the following results from the working tree (CAP-01 and SG-001/SG-002 applied, WIN-01 not yet repaired), on macOS. They were not re-run for this record and have no first-party evidence file; this is a second-hand record.

- Bounded gate: 391 passed across 18 files, including the doctor and Store migration suites.
- `tsc` and `eslint`: pass.
- Doctor CLI smoke: standalone scope present.
- Poisoned-sentinel recipe from `evidence/fix-report-sg-r1.md`: 54 passed across 2 files; sentinel HEAD, index, tree, and foreign session bytes unchanged; environment restored after each test.

None of these exercises the Windows metadata path. They are pre-WIN-01 verification of CAP-01 and SG-001/SG-002 on one platform, not proof of WIN-01 and not a substitute for native CI.

## Finding and task status

- CAP-01: source applied in the working tree; LEAD bounded validation reported above; independent delta re-review pending (`tasks.md` 5.4). Not closed.
- SG-001, SG-002: test-only source applied in the working tree; LEAD sentinel and suite validation reported above; independent delta re-review pending; the alias case table has not run on Windows because the CI head predates it. Not closed.
- WIN-01: source applied in the working tree (`evidence/fix-report-win-r1.md`); no run evidence on any platform; native Windows re-run and independent delta re-review pending. Not closed.
- Task 3.4: unchecked. Run `34026299987` executed the Change's suites on the Windows shards, but on the pre-SG-002 head and with a failing case; it does not satisfy the task, and no run id or head SHA is recorded as its completion.

## Documentation mismatches found

1. `design.md` Decision 5 and `tasks.md` 1.3 and 1.5 place an unreadable-metadata case "including an `ENOTDIR` metadata path" in `test/core/root-selection.test.ts`. At the tested head and in the working tree that suite has no unreadable-metadata case (0 matches for `ENOTDIR`, `unreadable`, `cannot be read`); the `ENOTDIR` case exists only in `test/commands/repo-local-typed-scope.test.ts` (`does not adopt a standalone scope when Store metadata cannot be read`). The earlier text was left as written; LEAD decides whether to add the resolver-level case or amend the record.
2. The 391/18, `tsc`/`eslint`, doctor smoke, and 54/2 results named by `tasks.md` 5.3 exist only as LEAD's report and this second-hand record; no evidence file lists the exact commands.
3. Evidence tracking: `git ls-files` shows only `evidence/investigation-2026-09-06.md` and `evidence/verification-report.md` tracked under this Change. Every round-1 report (`review-report.md`, `review-round-1/*`, `store-guards/*`, `fix-report-cap-r1.md`, `fix-report-sg-r1.md`, `fix-report-win-r1.md`, and this file) is untracked, and `git check-ignore -v` attributes the ignore to `~/.gitignore_global:8` (`/rasen/`). Committing them requires a deliberate force-add by the Change owner; no Git write was performed here.

## Limitations

Author did not run any command other than read-only `git rev-parse`, `git branch --show-current`, `git diff --stat`, `git status --porcelain`, `git show`, `git ls-files`, and `git check-ignore` for the facts above. The codebase graph excludes `.rasen/`, `rasen/`, and the test files cited; every cited line was read directly. Only the shard-3 and Node 24 logs were saved, so passing jobs are recorded by conclusion, not by per-test output.
