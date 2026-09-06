# Verification Report

## Scope and result

Local verification is complete for archive planning, recovery, OS metadata handling, and the affected Store finalization consumers. This is not a project-wide test-suite result, native Windows certification, merge observation, or release claim.

- Host: macOS / arm64; executed Node runtime: v24.18.0.
- Final scope: **23 test files passed; 508 tests passed; 12 skipped**.
- Final TypeScript check and ESLint of all changed TypeScript files passed.
- Native Windows CI remains unchecked in `tasks.md`.

The scope covers both the direct archive engine and its command/Store consumers, source-last ownership and recovery seams, path semantics, accounting, and saved-plan behavior. It includes the existing archive fault matrix rather than only new happy-path cases.

## Commands and outcomes

### Final regression gate

```sh
env -u ZSH pnpm exec vitest run test/core/archive test/core/store/finalization --reporter=dot
```

Result: 23 files passed, 508 tests passed, 12 skipped. Vitest duration: 247.36 seconds. The process deadline for this completed run was 900 seconds. An earlier identical broad selection was stopped by its 240-second process deadline and had no final summary; it is not counted as a successful gate.

### Types and changed-file lint

```sh
pnpm exec tsc --noEmit
pnpm exec eslint src/core/archive-engine.ts src/core/archive-accounting.ts src/core/archive-accounting-v2.ts src/core/archive-os-metadata.ts src/core/store/finalization/module.ts test/core/archive-os-metadata.test.ts test/core/archive-accounting.test.ts test/core/archive.test.ts test/core/archive-fault-matrix.test.ts test/core/store/finalization-plan-token.test.ts
```

Both completed successfully against the final TypeScript changes. Build also succeeded through Vitest's `build:if-stale` gate before the focused post-review regressions; the final broad run reported `dist/` current and skipped rebuilding.

## Red/green evidence

| Defect or gate | Before | After |
|---|---|---|
| Active-change-only dirty same-token recovery | Existing new regression failed: retry returned `recoverable`, `git` / `ESTALE`, rather than `complete` | Four provenance cases plus two outside-owned drift cases passed; also covered by the final gate |
| Regular OS metadata added after planning | Each of `.DS_Store`, `Thumbs.db`, `desktop.ini` caused `source-inventory` / `ESTALE`; no-mutation control completed | All three SDK smoke cases completed |
| Regular OS metadata added after completion | Each name caused `accounting` / `archive_reservation_ownership_unverified` on replay | All three SDK replay cases completed |
| Legacy phase authority abort and Store v2 preflight classification | Three focused regression cases failed against the still-pre-fix compiled modules | The same three cases passed against current sources; no source or ledger byte rewriting was accepted |

Initial R1 command:

```sh
pnpm exec vitest run test/core/archive.test.ts -t 'only the active change is dirty' --reporter=dot
```

R1 focused successful gate:

```sh
pnpm exec vitest run test/core/archive.test.ts -t 'keeps nested planning Git provenance separate|outside-owned planning' --reporter=dot
```

Result: 6 passed, 61 skipped.

Compatibility regression selection:

```sh
env -u ZSH pnpm exec vitest run test/core/archive-os-metadata.test.ts test/core/store/finalization-plan-token.test.ts -t 'abort preserves the policy code and all bytes|APPLY-PLAN reports legacy OS metadata policy incompatibility before source drift' --reporter=dot
```

Result: 3 passed, 52 skipped. For the preceding red run, a temporary Vitest resolver directed production imports to the pre-fix `dist/` and disabled the automatic build. All three selected cases failed. That temporary config was removed before the normal source/build gate; no baseline copy or test-runner shim is shipped.

The first metadata/accounting run also exposed a test-fixture error: an unknown-final test created the archive parent after planning and stopped at the ancestry gate. Creating the parent before planning reached the intended ownership gate. The corrected test passed, and the final broad run includes it.

## Actual program smokes

These exercised the built engine or the actual `bin/rasen.js` command, not source-text assertions.

1. **Integrated Git recovery:** first-copy `EIO`, then the same plan resumed to `complete`.
2. **Later pre-durable interruption:** injected `EIO` at the file-handle write of the `evidence-finalized` journal; injection was observed, the first attempt was recoverable, and the same plan completed on retry.
3. **Nested planning Git through a CLI cwd alias:** product branch and planning branch differed; planning was `planning-main`, clean, and ignored known OS metadata. A token saved before metadata existed was applied after metadata appeared at source root, evidence, and handoff locations. Apply and completed replay both succeeded. Metadata was not copied, `.notes` survived, source was removed, `codeCommit` matched the product fixture HEAD, and `archive.json` bytes did not change on replay.
4. **Git boundary preserved:** a Git-unignored `desktop.ini` added after planning caused actual CLI exit 1 with `recoverable`, operation `git`, code `ESTALE`, message `Git facts changed or became ambiguous after archive planning.` This is intentional; payload exclusion is not Git-status filtering.
5. **Historical fixture compatibility:** real pre-policy planned and completed fixtures containing recorded `evidence/.DS_Store` were retained across the implementation. Both returned `blocked` / `archive_os_metadata_policy_incompatible`; saved plan and completed accounting bytes stayed identical. Standalone historical accounting verified unchanged metadata and rejected changed recorded bytes. The test bytes were then restored and matched the original retained baseline.

A raw SDK fixture using a lexical symlink root was rejected by existing plan-path authorization before fault injection. It was not counted as a recovery failure or as successful alias coverage; the real CLI alias scenario above supplies that evidence.

All retained smoke fixtures and the temporary baseline runner have been removed. No historical user archive was modified to produce these results.

## Tested content identity

- Checkpoint/base commit: `f81cb2d878e021a0992c7470253ab80e2b42d467`.
- `git rev-parse HEAD^{tree}` at the checkpoint: `3ab0525328a940911365e27897c38316bfb5229b`.
- The tests ran with subsequent source changes in the working tree. **The checkpoint tree alone is not the identity of the tested fixes.**
- Final changed-source/test manifest SHA-256: `bba08db9e5d5a4bf917e9080445cbd0e66106b848eca416f694e19caf6221a41`.
- Manifest fingerprint algorithm: SHA-256 of the exact UTF-8 output of `shasum -a 256` for the following sorted paths, including each output newline. Documentation-only edits after this capture do not change this source identity.

```text
7f22b926ffedef15d15977ed1fe25d12d482f353e3cd72096d0efcc057fc77b5  src/core/archive-accounting-v2.ts
dd0a0d98767a6fb4260f5bd9c6b1b5e183897a02e55c8ddf6e4161a80cdf49c3  src/core/archive-accounting.ts
4ba7d647344f6107c01897e436faf26b327810f39d6dbc67ddd0f2e18344f7f7  src/core/archive-engine.ts
aca569f5d710dfaa706b966b03041e73b3444c99f6faba855ad744098c474df4  src/core/archive-os-metadata.ts
b267010ab06f380009c0cb36f28578308fbbb47c42d30a5d3d9b271cc9c10724  src/core/store/finalization/module.ts
f5a2d68601e74a166b542dd9198d9eb503ec2bde7a5f14b27755820998104858  test/core/archive-accounting.test.ts
8b3544218483939cf8a76c40ab970c29f7f64801d469d0fca9697e2d7064807b  test/core/archive-fault-matrix.test.ts
b27710d6f45ea2ed8ba6d02211c30bf5112f8c119aed26c515d822d41c49cc5e  test/core/archive-os-metadata.test.ts
cac0dbc673aa60ea9713baf9c16b0984690fee0bd4f6d8268196dc2e45eddd08  test/core/archive.test.ts
12ff7506be4fee1627a6b034839843fb230e0cd87ca5c769d165c7dc05221a77  test/core/store/finalization-plan-token.test.ts
```

## Remaining verification and known limits

- Native Windows CI has not run. The repository CI includes Windows jobs and `workflow_dispatch`; an ordinary push to this `fix/...` branch does not match its `main` / `dev/**` push trigger. No CI success is inferred from the local gate.
- The metadata tests cover case-insensitive Windows names on this host; tests requiring native symlink privileges do not constitute Windows execution. Existing platform-neutral path tests remain in the broad scope.
- A malformed planning `.git` gitfile pointing to a missing gitdir was independently observed to be classified as non-Git by the pre-existing `src/core/store/git.ts` classifier. That implementation gap is outside this Change; the canonical fail-closed requirement remains in force.
- Git tree state remains binary. Outside-owned dirty-to-dirty changes are not newly detected by that field; active payload integrity still has its independent source fingerprint.
- Historical metadata-bearing plans require their original engine for transaction resolution. This Change does not rewrite or automatically migrate their immutable authorities.
