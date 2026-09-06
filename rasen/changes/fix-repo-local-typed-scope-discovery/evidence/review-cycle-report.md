# Review Cycle: fix-repo-local-typed-scope-discovery

**Rounds: 2/2 · Tier: B · Status: CLEAN**

PR: [DumoeDss/rasen#189](https://github.com/DumoeDss/rasen/pull/189), base `dev/0.1.8`, head `pashifika:fix/repo-local-typed-scope`.

## Result and round limit

The PR was created before review as requested. Four findings were repaired and independently closed. Round2 reviewed only the remediation delta and its integration preservation, with zero new findings on both Standards and Spec axes. No third code-review round was needed. Native CI then completed successfully on the same reviewed source, after one code-unchanged failed-job rerun.

| Round | New Blocker | New Major | New Minor | New Trivial | Disposition |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 2 | 1 | 1 | 0 | CAP-01, SG-001, SG-002 and the CI-discovered WIN-01 repaired |
| 2 | 0 | 0 | 0 | 0 | All four prior findings independently closed; no residual product finding |

WIN-01 was discovered during round1 CI/remediation, not counted as a third review or as a new round2 finding. The round2 Store review's narrow native-evidence completion did not change or re-review product code.

## Finding ledger — author is not verifier

| ID | Severity / origin | Repair | Non-author closure |
| --- | --- | --- | --- |
| CAP-01 | Blocker / Spec | `ScopeDoctorFix`: retain doctor Store-first routing; negotiate project-read only after exact aggregate-intent refusal and positive metadata absence; preserve the existing adoption guard and original diagnostic | `CapabilityDeltaReview`, round2; source plus named native doctor regression pass |
| SG-001 | Major / Standards | `ScopeFixtureFix`: remove ambient Git/Rasen locators before fixture subprocesses, verify actual Git roots before writes, restore environment before cleanup | `StoreDeltaReview`, round2; source/lifecycle inspection and native suites |
| SG-002 | Minor / Spec | `ScopeFixtureFix`: exercise symlink/junction and Windows drive-case/separator spellings through actual locate/openChange capabilities | `StoreDeltaReview`, round2; source and Windows52/POSIX50 suite evidence |
| WIN-01 | Blocker / native platform contract | `ScopeWindowsMetadataFix`: distinguish Windows ENOENT ambiguity from true absence in the shared optional metadata reader; reject occupied modern/legacy namespaces without changing successful-read precedence | `StoreDeltaReview`, round2; source plus the exact native failing case now passing |

No source finding was rejected or merely accepted as known. CI observations below remain explicitly separate from this finding ledger.

## Dispatch and retained state

- User-required OMP subagents were used. Review slices ran concurrently with disjoint ownership; fixers ran concurrently only on disjoint source/test boundaries.
- Actual review route: OMP `adversarial-review` agent definitions; fix routes: `astra-coder` and `fable-coder`, with `fable-docs` for bounded contract/evidence wording. No external AI review, CLI dispatch, nested agents, or reviewer-authored fixes.
- Execution discovery reported host `omp`; the package pipeline view retained `claude` / `legacy-default` / `legacy-fallback`. The user-requested OMP transport was recorded as an explicit override, not represented as a successful Claude-native dispatch.
- TierB used report-seeded cross-role workers and ONE_SHOT horizons, not the Claude-native park/keepalive protocol. One OMP message follow-up completed native evidence in the same round2 Store review. No third-round counter increment or fresh full-diff review was hidden in that update.
- LEAD alone wrote run-state at `.rasen/changes/fix-repo-local-typed-scope-discovery/ephemera/auto-run.json`. No degraded-recall handoff was required.

## Immutable reviewed input fingerprints

| State | Commit | Tree |
| --- | --- | --- |
| Initial implementation reviewed in round1 | `8ab98e1d9ab242efdd68dac49a4b08a4cea91d06` | `d62aab920a7d5813c207773bb17f6276f7a3cbbe` |
| Round1 remediation, reviewed as the round2 delta | `564d7ab5be1dd767f91d46ff50063d19178f9714` | `e90086ca5150787f629ecbec818bf2c90cc4b3ea` |
| Integrated source and final clean CI input | `1f9ee439eeeb4eff6596a77f8f0f614bfcabf30b` | `966b3fa306654d222b592c5e23213677d52be84f` |

Upstream merged PR#188 at `3258a8cb6a0e51267e0be2c794a67ec934e0cde2` while review was running. That made PR#189 conflict and prevented its new CI from starting. A normal merge integrated upstream without rewriting history; only CHANGELOG needed manual resolution, preserving both independent additions. Both non-author reviewers checked their repair-owned source/test paths unchanged from remediation to integration. They did not claim to re-review the unrelated upstream branch wholesale.

These are **input** fingerprints, not a self-referential hash of this output report. Final evidence/task commits do not change the reviewed product source or tests. The round2 snapshots retain their point-in-time CI-pending notes; this final CI section supersedes that gate only, not their independent source verdicts.

## Verification

Exact local commands and first-party observations: [review-verification-r2.md](review-verification-r2.md).

| Gate | Observed result |
| --- | --- |
| Repair-integrated discovery/consumers and all Store core suites | 93 files passed;1,718 tests passed,2 skipped; Vitest rebuilt `dist/` before execution |
| Upstream-integration consumer/Store-planning and changed archive suites | 22 files passed;517 tests passed; integrated CLI rebuilt |
| Type and targeted ESLint | Passed on repair input; integrated native lint/type job also passed |
| Strict Change validation | Exit0, valid true, zero issues |
| Actual `doctor --json` | Exit0; healthy nearest root; standalone/project-read scope and resolver-owned paths |
| Poisoned-sentinel fixture isolation | Earlier pre-WIN-01 macOS run:54 tests/2 files passed; sentinel HEAD/index/tree/session bytes unchanged and environment restored |
| Windows changed cases | Exact unreadable-metadata CLI case passed; root-selection52, foundation24 and doctor32 tests passed |
| Linux full suite | 432 files passed;7,618 tests passed,40 skipped |
| Final native CI | Run34029988895, attempt2, integrated head; conclusion success |

The local gates are bounded, not a claim that Main ran the complete local project suite. Native evidence distinguishes named CLI case logs from suite-level proof for fast alias/foundation table rows. Windows poisoned-sentinel fault injection or individual ACL/errno injection was not performed.

## Final native CI and timeout disposition

[Run34029988895](https://github.com/DumoeDss/rasen/actions/runs/34029988895), head `1f9ee439eeeb4eff6596a77f8f0f614bfcabf30b`, **attempt2: success**. Windows shards1–3, Linux Node20.19.0, Linux Node24, macOS, lint/type, UI package build, layout migration and placement-recovery jobs passed. Nix and the alternate aggregate-check branch were skipped by workflow conditions; they are not represented as executed tests.

Attempt1's changed Windows regressions already passed; see [native-ci-r2.md](native-ci-r2.md) for saved exact job/line excerpts. The one remaining failure was `test/commands/store-root-selection.test.ts:719`, `keeps stdout pure when REMOVED deltas target a new spec`, timing out at30000ms, then cleanup reporting EBUSY. Its test/helper files are unchanged from upstream, but that alone was not used to declare it unrelated.

LEAD reran only the failed Windows job using `gh api --method POST repos/DumoeDss/rasen/actions/jobs/101477630660/rerun`; GitHub also reran its dependent aggregate checks. No source, timeout, test retry policy or expectation was changed. Replacement [job101480535490](https://github.com/DumoeDss/rasen/actions/runs/34029988895/job/101480535490) passed. Exact downloaded-log excerpts:

```text
2026-09-06T11:52:04.9269977Z    [33m[2m✓[22m[39m store root selection for normal commands[2m > [22marchive --json is non-interactive[2m > [22mkeeps stdout pure when REMOVED deltas target a new spec [33m 5039[2mms[22m[39m
2026-09-06T12:00:39.3922675Z [2m Test Files [22m [1m[32m144 passed[39m[22m[90m (144)[39m
2026-09-06T12:00:39.3935720Z [2m      Tests [22m [1m[32m2391 passed[39m[22m[2m | [22m[33m13 skipped[39m[90m (2404)[39m
2026-09-06T12:00:39.3936961Z [2m   Start at [22m 11:44:50
2026-09-06T12:00:39.3947821Z [2m   Duration [22m 949.21s[2m (transform 7.69s, setup 1.79s, collect 76.64s, tests 1767.21s, environment 51ms, prepare 22.10s)[22m
```

**Retained observation:** the initial timeout cause is unestablished; it did not recur in the same-SHA rerun. This is not claimed as a code fix. The older run34026299987 also had an empty-marker JSON parse failure in the unchanged Linux Node24 agent-dispatch fixture; the integrated Node24 job passed without changing that fixture. Neither observation was suppressed or converted into a false all-CI pass.

## Evidence map

- Round1: [capabilities](review-round-1/capabilities.md), [store guards](review-round-1/store-guards.md), [CI triage](ci-triage-r1.md).
- Fix reports: [CAP](fix-report-cap-r1.md), [SG](fix-report-sg-r1.md), [WIN](fix-report-win-r1.md).
- Round2 immutable snapshots: [capabilities](review-round-2/capabilities.md), [store guards](review-round-2/store-guards.md).
- Current canonical source reviews: [capabilities](review-report.md), [store guards](store-guards/review-report.md), with LEAD-only final CI notes.
- Direct verification: [local/integration](review-verification-r2.md), [native attempt1 case evidence](native-ci-r2.md); attempt2 excerpts are above.

## Delivery and safety

- Topic branch pushed to origin; upstream PR#189 updated. No PR merge, approval, auto-merge, archive, spec sync or ship was performed.
- Product source stayed unchanged after integrated review. The final publication records review evidence and completed tasks only.
- `rasen/config.yaml` remained user-owned, unstaged and uncommitted. Normal commits were path-limited. Git forbids `--only` for a merge; that merge used the exact verified merge-owned index, which was clean before integration and never contained the user config.
- No Ghostty data, real Store data, global installation or `local_docs/` was modified. The owned one-use sentinel script and its empty temporary directory were removed after verification.
- This active Change remains available to the upstream owner; archive timing is their decision.
