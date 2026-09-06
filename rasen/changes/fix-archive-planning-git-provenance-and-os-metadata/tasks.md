## 1. Reproduction and policy

- [x] 1.1 Confirm nested planning provenance is distinct from product `codeCommit`, and checkpoint the initial implementation with the known-red active-only recovery regression.
- [x] 1.2 Reproduce interrupted active-only dirty recovery and verify that unchanged same-token input must resume while outside-owned clean/dirty drift remains refused.
- [x] 1.3 Reproduce metadata-only source staleness and completed-archive ownership failures for `.DS_Store`, `Thumbs.db`, and `desktop.ini`; record the operator's exclusion choice.

## 2. Implementation

- [x] 2.1 Resolve planning Git facts from the repository owning the planning workspace while preserving Foundation path authority and execution-project provenance.
- [x] 2.2 Restrict pre-durable recovery's Git exclusion to the admitted owned stage without changing saved-plan schema or original accounting facts.
- [x] 2.3 Apply the regular-file-only metadata policy consistently to source, handoff, evidence, quality capture, staging, reservation, accounting, and completed replay.
- [x] 2.4 Dispose of excluded metadata only through verified owned or claimed payload trees, preserving same-name directories, symlinks, meaningful hidden files, and unrelated destinations.
- [x] 2.5 Keep canonical-spec inventories exact and leave ephemera and Git policies unchanged.
- [x] 2.6 Refuse historical metadata authorities explicitly without rewriting immutable bytes, while retaining verification of every historical v1/v2 recorded evidence digest.

## 3. Independent review and integration fixes

- [x] 3.1 Obtain non-author confirmation of the active-only dirty recovery fix and its outside-owned drift safeguards.
- [x] 3.2 Fix Store v2's legacy-source compatibility check before its source-digest comparison, and obtain independent confirmation of the Major finding's resolution.
- [x] 3.3 Preserve the policy-incompatible code through both abort journal catches, and obtain independent confirmation of the Minor finding's resolution.
- [x] 3.4 Confirm all three compatibility regressions fail against the pre-fix build and pass against current sources; finish the scoped review cycle with no open findings.

## 4. Verification

- [x] 4.1 Run the archive and Store finalization regression scope after the final fixes: 23 files passed, 508 tests passed, 12 skipped.
- [x] 4.2 Run final TypeScript checking and ESLint for every changed TypeScript file.
- [x] 4.3 Exercise real nested-Git CLI apply and replay through a symlinked working directory, verifying metadata exclusion, hidden payload preservation, source removal, planning provenance, and unchanged accounting bytes.
- [x] 4.4 Exercise non-Git metadata creation/replay, integrated-repository interrupted recovery, and evidence-journal interruption; confirm unignored metadata still obeys Git drift checks.
- [x] 4.5 Verify pre-policy planned and completed fixtures are explicitly refused without rewriting their saved bytes, while historical accounting verifies unchanged metadata and rejects changed recorded metadata.
- [ ] 4.6 Run and record native Windows CI for the recovery and metadata paths, including drive/separator handling and filesystem semantics. macOS runs, name-case cases, and platform-neutral path tests do not satisfy this item; the existing CI workflow supports manual dispatch or a qualifying pull request.

## 5. Retrospective artifacts

- [x] 5.1 Record the proposal, adopted design, and two delta specs without modifying canonical specs or unrelated Changes; preserve the operator-confirmed same-repository planning convention.
- [x] 5.2 Finalize the review-cycle and verification reports with exact scope, outcomes, tested-source identity, remaining Windows verification, and the separately identified pre-existing Git-classifier limitation.
- [x] 5.3 Validate the complete Change strictly and confirm its artifact status without treating pending native Windows verification as completed implementation evidence.
