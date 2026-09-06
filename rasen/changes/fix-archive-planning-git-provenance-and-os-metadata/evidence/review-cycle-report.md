# Review Cycle: archive planning provenance and OS metadata

## Result

- Rounds: **3 / 3**.
- Scoped result: **CLEAN — no open Blocker, Major, Minor, or Trivial findings** in the reviewed implementation delta.
- Dispatch: native OMP `task` / `hub` workers (Tier A capability). No Codex CLI bridge or inferred bridge session was used.
- Author and verifier were separate for every implementation resolution. Main integrated the work and ran verification.
- This report does not claim native Windows CI, a merge, a release, or archive completion. Those are separate from a clean scoped review.

## Round history

| Round | Findings (Blocker / Major / Minor / Trivial) | Triage | Fixed by | Confirmed by non-author | Disposition |
|---|---|---|---|---|---|
| 1 | 0 / 1 / 0 / 0 | Non-trivial recovery comparison defect | `ArchiveRecoveryFixer` | `ArchiveRecoveryReReview` | R1 resolved; unchanged active-only dirty recovery succeeds, outside-owned clean/dirty drift still refuses |
| 2 | 0 / 1 / 1 / 0 | Non-trivial OS-policy integration defects | `ArchiveMetadataFixer` | `ArchiveMetadataAccountingReview` and `ArchiveMetadataSafetyReview`, on delta re-review | R2 and R3 resolved |
| 3 | 0 / 0 / 0 / 0 | Independent delta confirmation and final runtime gate | No further production edit | The two metadata reviewers; Main's regression and smoke gates | Clean within scope |

The original planning-repository provenance fix was checkpointed before R1's repair at `f81cb2d878e021a0992c7470253ab80e2b42d467`. The operator requested that checkpoint, then the review/fix cycle, and later requested this retrospective Change. The artifacts are not evidence of a design approval that preceded implementation.

## Findings and resolutions

### R1 — Major: active-only dirty input becomes false clean on retry

Planning captured the owning repository's full tree state, but recovery excluded active/spec/final/ephemera paths when comparing it. If the active Change contained all original dirt, the retry compared planned `dirty` with observed `clean` and returned `git` / `ESTALE` after a recoverable copy failure.

The repair excludes only the admitted owned stage at the pre-durable Git gate. The source, specs, and ephemera remain in the original comparison scope; leftover transient carriers are rejected by the preceding debris guard. Saved facts and schemas are unchanged. Four provenance cases and two real-Git outside-owned drift cases passed. The non-author review also checked the durable-mutation gate, path-root conversion, and existing saved-plan/accounting consumers.

### R2 — Major: Store v2 preflight hides legacy policy incompatibility as source drift

Store finalization recomputed the source fingerprint before the engine's compatibility inspection. An unchanged historical source authority containing metadata consequently produced `finalization_plan_stale` and re-plan guidance instead of `archive_os_metadata_policy_incompatible`.

The existing narrow compatibility assertion is now shared and called before that digest comparison. The change does not run the entire archive inspection again or reorder unrelated Git, catalog, or canonical-spec checks. A real Store saved-plan regression verifies the explicit policy code, no stage creation, and unchanged source, saved-plan, and archive bytes. `ArchiveMetadataAccountingReview` independently confirmed the repair.

### R3 — Minor: abort wrappers replace the phase-only compatibility code

A legacy journal can record metadata in phase authority even when its saved source authority contains none. Stage and published abort wrappers replaced the parser's policy-incompatible code with invalid-journal or unverified-ownership classifications. Bytes remained safe, but the machine-readable diagnosis was wrong.

Both catches now preserve this specific code and retain their previous classifications for other errors. Two phase-only legacy cases use real partial transactions and self-hashed historical authority derived from real filesystem identities. They assert the policy code, no misleading recovery command, and unchanged fixture file bytes. `ArchiveMetadataSafetyReview` independently confirmed both catches and the regressions.

## OS policy safety review

The operator chose to omit known regular OS metadata rather than preserve it. The reviewed implementation limits the policy to exact `.DS_Store` and case-insensitive `Thumbs.db` / `desktop.ini` regular files. The reviewers examined:

- Consistent inventory, handoff, evidence, quality, copy, reservation, and completed-accounting behavior.
- No adoption of a foreign final destination because it contains only metadata.
- Directory/type/object checks and private-claim-bound deletion; ordinary hidden files and same-name directories/symlinks remain meaningful.
- No automatic deletion of later final-archive metadata.
- Exact canonical-spec deletion and independent ephemera/Git policies.
- Explicit historical-authority refusal without rewriting saved bytes, alongside strict historical v1/v2 recorded evidence hashes.

No deletion-safety or evidence-integrity finding remained in that review scope.

## Verification evidence

The final scope and exact commands are in [verification-report.md](verification-report.md):

- Archive and Store finalization scope: **23 files passed, 508 tests passed, 12 skipped**.
- Final TypeScript and changed-file ESLint: passed.
- Three compatibility cases: failed against the pre-fix compiled modules, then passed against current sources.
- Real built-engine and CLI smokes: ordinary metadata tolerance, same-token interrupted recovery, nested planning Git through a cwd alias, historical receipt preservation, and intentional Git-unignored metadata refusal.

Tested base commit: `f81cb2d878e021a0992c7470253ab80e2b42d467`.
Checkpoint `HEAD^{tree}`: `3ab0525328a940911365e27897c38316bfb5229b`.
Final changed-source/test manifest SHA-256: `bba08db9e5d5a4bf917e9080445cbd0e66106b848eca416f694e19caf6221a41`.
The checkpoint tree does not by itself identify the subsequently tested working-tree fixes; the verification report records the complete manifest and its algorithm.

## Remaining limits and delivery boundary

- Native Windows CI remains pending in `tasks.md`. The local result must not be presented as native Windows coverage.
- The pre-existing malformed planning gitfile classifier gap is documented in the design and verification report. It was not silently accepted as valid behavior or fixed outside this Change's scope.
- There are no accepted-known Minor/Trivial findings inside this review delta; the separate classifier issue is an explicitly identified pre-existing limitation.
- This repository intentionally keeps planning artifacts in the product Git repository. Per the operator's repository-specific rules, archive is the upstream owner's decision; ship creates `ship-log.md` without waiting for or observing merge; PR delivery pushes to `origin` before opening a PR against `upstream`. This review and retrospective proposal do not themselves authorize a PR, merge, or archive.
