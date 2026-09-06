## Context

This is a retrospective design. Investigation and implementation preceded this document; it records the adopted architecture, retrospective comparisons with approaches not taken, and the distinction between verified work and remaining checks. It is not a record of prior design approval. The scoped review and verification results below do not imply a merge, release, or archive.

Three defects were observed in the archive engine:

1. Archive planning reported planning Git provenance (`planningBranch`, `planningTreeState`) from the product repository instead of from the repository that owns the planning workspace. The Foundation root that anchors archive and spec paths was being conflated with the Git repository that owns `rasen/`.
2. After the planning Git root moved to the owning repository, same-token recovery of an interrupted apply rejected unchanged input. When the only uncommitted files were inside the active Change, planning recorded `treeState: 'dirty'`, but the recovery comparison excluded the active Change and observed `clean`, so an exact-token retry after a transient I/O fault returned `ESTALE` although nothing had changed. Two independent reviews rated this Major; it is referred to as R1 below.
3. Creation of ordinary OS metadata (`.DS_Store`, `Thumbs.db`, `desktop.ini`) inside an otherwise unchanged source or completed archive invalidated exact inventory comparisons, so an unchanged Change could not be archived and a completed archive could fail replay. Source and final were reproduced directly; the corresponding pre-fix failure for metadata created inside the stage was inferred from the same exact-inventory comparison, not reproduced.

The Git provenance work was checkpointed on branch `fix/archive-planning-git-provenance` at commit `f81cb2d878e021a0992c7470253ab80e2b42d467`. That checkpoint intentionally committed the active-only recovery regression row in a known-red state before R1 was fixed, so the failing comparison is recorded rather than inferred.

The operator chose the OS metadata policy explicitly when asked: exclude the three names rather than preserve them as payload. Windows names match case-insensitively; `.DS_Store` matches exactly.

Current state at the time of writing:

- Planning Git provenance and the R1 recovery comparison are implemented. An independent re-review of R1 found no new findings.
- The OS metadata policy is implemented across source fingerprinting, handoff inventory, evidence discovery and quality capture, stage copy, final reservation, owned-stage and claimed-source disposal, completed-archive fingerprinting, legacy-authority refusal, and standalone v1/v2 accounting verification. Focused regressions exist in `test/core/archive-os-metadata.test.ts` and `test/core/archive-accounting.test.ts`; real-Git provenance and recovery tables exist in `test/core/archive.test.ts`.
- The two OS metadata integration findings are fixed and independently confirmed: Store v2 checks compatibility before source-digest drift, and both abort journal paths preserve the policy-incompatible code. Their three regression cases failed against the pre-fix build and passed against the final sources.
- Real smokes on this host: non-Git source-after-plan and completed replay passed for all three names. A nested planning Git run through a symlinked `cwd` applied an earlier saved token after ignored metadata appeared, then replayed successfully; `planning-main`/`clean`, the product `HEAD`, hidden `.notes`, and immutable accounting were preserved, and source removal completed. Git-unignored `desktop.ini` still produced the intended CLI exit `1`, `recoverable`, `git`/`ESTALE` refusal.
- Final archive/finalization verification passed: 23 files, 508 tests passed, 12 skipped. Final `tsc --noEmit` and changed-file ESLint passed. The initial broad run exceeded its 240-second process deadline; the completed rerun took 247.36 seconds. Native Windows execution remains unverified.

This repository follows its upstream fork's convention of tracking `rasen/` inside the product Git repository. The design must work for that layout and for a nested planning repository that the product repository ignores; it does not migrate either layout.

## Goals / Non-Goals

**Goals:**

- Record planning provenance from the Git repository that owns the planning workspace, while `codeCommit` continues to identify the execution product repository's `HEAD`.
- Make pre-durable same-token recovery compare the same Git input scope that planning observed, excluding only what the transaction itself created, and keep refusing outside-owned clean/dirty transitions.
- Exclude a fixed, name-and-type-bound set of regular OS metadata files from archive payload, handoff inventory, evidence, and filesystem integrity comparisons through one shared predicate.
- Dispose of excluded metadata only inside trees the transaction already owns or has claimed, and never widen deletion authority by name.
- Refuse historical plans and journals that recorded now-excluded metadata as payload with one explicit code, without rewriting immutable authorities and without a schema version bump.
- Keep standalone v1/v2 accounting verification strict for every digest a historical receipt recorded.

**Non-Goals:**

- Filtering `git status` output, introducing a Git-status exclusion rule for metadata, or editing `.gitignore` automatically. Repository-wide Git facts and Git drift refusal are unchanged by the metadata policy.
- Extending the metadata policy to the ephemera cleaner, to canonical spec deletion inventories, or to generic control carriers such as claim roots and sentinel roots.
- Preserving OS metadata as archive payload, or treating any other hidden file, directory, or symlink as ignorable.
- Rewriting, migrating, or reclassifying saved plans, journals, `archive.json` ledgers, or Archive v2 records.
- Splitting `rasen/` into a nested Git repository in this repository, or changing the planning convention product-wide.
- Automatic archive or delivery of this Change. Archive and delivery remain separate operator actions.

## Decisions

### 1. Resolve planning Git provenance from the repository that owns the planning workspace

Three roots have distinct roles and must not be conflated:

- The **Foundation root** (`plan.roots.planning`) is the path authority. Archive, spec, stage, and final paths are derived from it. It says nothing about Git.
- The **planning Git root** is the repository that owns the planning workspace. `resolveArchiveGitPlan` probes `path.join(planningRoot, 'rasen')`, and when Git confirms a work tree it resolves the repository root with `git rev-parse --show-toplevel`. `planningBranch` and `planningTreeState` come from that root: `rev-parse --abbrev-ref HEAD` for the branch and a repository-wide `status --porcelain` for the tree state. A confirmed non-Git workspace records `branch: null` and `treeState: 'clean'`; a failing branch, status, or root query is a `git` blocker rather than a guessed value. The pre-existing classifier gap for a corrupted gitfile is recorded under Risks.
- The **execution root** (`plan.roots.execution`) is the product repository. `codeCommit` is its verified full `HEAD` commit and is independent of the planning repository.

In a nested layout where the product repository ignores `rasen/`, the planning Git root is the nested repository. In this repository's same-repo layout, `--show-toplevel` from `rasen/` resolves to the product root, so planning branch and tree state are read from the same repository that supplies `codeCommit`; the two facts are still recorded and revalidated separately.

Alternatives rejected now: reading planning provenance from the execution root (the observed defect); treating the Foundation root as the Git root (wrong whenever the nested repository owns the workspace, and it resolves to the ignoring product repository when `rasen/` is not tracked there); restricting `status --porcelain` to `rasen/` (the recorded fact is repository-wide tree state, and the proposal introduces no Git-status filtering rule).

### 2. Compare pre-durable recovery against the original Git input scope minus the owned stage

`revalidateArchiveGitPlan` runs only while `archiveJournalHasDurableMutation` is false, that is, before any spec, cleaner, association, or source progress, before any ephemera disposal, and before a final reservation exists. Transient transaction carriers such as a bound projection or a private-cleanup claim can exist outside the stage before a durable mutation, but `assertNoArchiveTransactionDebris` rejects leftover debris before Git revalidation runs, so the owned stage is the only surviving archive-owned write admitted at this gate; the active Change, canonical specs, and ephemera still hold the original inputs. Recovery therefore re-runs the repository-wide `status --porcelain` and excludes exactly one path family: `plan.paths.stage` and everything under it, expressed as `:(exclude)<relative>` and `:(exclude)<relative>/**` pathspecs. The stage path is re-anchored through the Foundation root's real path, kept only when it is contained in the planning Git root, and normalized to a repository-relative path before it becomes a pathspec.

The resulting `treeState` is compared with the planned value alongside branch, planning state, and the full execution facts; any difference is `ESTALE`. Pre-existing dirt inside the active Change is part of both observations, so an unchanged active-only dirty input resumes, while a file created or removed outside the transaction between planning and retry still flips the comparison and is refused. Once the journal records a durable mutation, the planned Git facts are consumed as frozen provenance and are not revalidated.

Alternatives rejected now: excluding the active Change from the recovery comparison (the R1 defect; it hides pre-existing dirt and manufactures a false `clean`); skipping Git revalidation for plans recorded as `dirty` (loses refusal of outside-owned drift); persisting a second recovery-scoped tree state in the plan (schema growth for a value derivable from the plan and stage paths).

### 3. Recognize metadata through one narrow, type-bound predicate

`src/core/archive-os-metadata.ts` owns the policy. `isArchiveOsMetadataName` matches `.DS_Store` exactly and `Thumbs.db` / `desktop.ini` case-insensitively; nothing else is ever metadata. `isExcludedArchiveOsMetadata` accepts an entry only when the `Dirent` reports a regular non-symlink file and two consecutive `lstat` observations agree on regular-file type, `dev`, `ino`, and `mode`. A vanished entry (`ENOENT`) is excluded without needing authority; a type change or object replacement during classification throws `ESTALE`. Content and timestamp churn does not affect classification.

Consequences that follow from the predicate rather than from call-site special cases: a directory or symlink named `.DS_Store` is payload and is compared and preserved like any other entry; meaningful hidden files, management YAML, and every other name remain payload; the policy never inspects Git status, so an unignored metadata file that turns a planning tree from clean to dirty is still refused as Git drift under Decision 2.

Alternatives rejected now: a generic hidden-file or glob rule (deletes or hides meaningful payload); a Git-ignore-driven definition (couples payload identity to repository configuration the engine does not own); preservation as payload (rejected by the operator; it keeps every archive inventory hostage to Finder and Explorer side effects).

### 4. Apply the predicate at every payload seam, and opt out only for exact deletion inventories

`fingerprintArchiveTree` excludes metadata by default, so source fingerprinting, deletion authority for the claimed source, completed-archive fingerprinting, and every other payload inventory share one view. The same predicate is applied in handoff inventory, evidence discovery, quality capture, stage copy, reservation copy, reserved payload listing, and owned reservation occupant listing. `hashArchiveEvidence` applies it to new evidence inventories.

Canonical spec deletion is the deliberate exception. The three `fingerprintArchiveTree` calls that compute or verify the capability tree for a spec `REMOVED` action pass `{ excludeOsMetadata: false }` and do not pass a metadata transaction id, so canonical spec deletion keeps its exact inventory contract and never gains metadata disposal authority. The ephemera cleaner classification and the Git facts are untouched.

Alternative rejected now: changing the fingerprint default for all callers unconditionally. Deletion authority for canonical specs would silently lose entries, and the proposal preserves canonical-spec deletion rules.

### 5. Dispose of metadata only inside owned or claimed trees; final metadata is tolerated, not deleted; metadata never grants ownership

Excluded metadata is removed only inside trees the transaction owns or has claimed: the owned stage's handoff directories while handoff files are absorbed, the transaction-bound projection directory the engine itself created under the archive parent, and the claimed source after `archive.json` has been finalized and verified and the source has been moved into its private claim. `removeArchiveOsMetadataFiles` rebinds the real directory chain from the owned root, requires the directory to match its expected identity, re-classifies each entry with the shared predicate, verifies regular-file type immediately before claiming, moves the file through the existing no-follow private-claim protocol with the transaction id, verifies the claimed object's exact post-rename identity, and only then unlinks. A metadata name that has become a directory or symlink is retained, and a directory identity change aborts the cleanup as stale. Guarded tree deletion accepts the transaction id as an opt-in parameter; only the source-last removal and the projection removal pass it, so every other caller keeps exact, non-recursive removal.

The final archive is treated differently. Regular metadata created later in an already-owned final directory is excluded from comparison and reservation accounting but is never deleted. An unknown occupant of the final path does not become owned because it is only metadata: reservation recovery lists occupants without exclusion first, applies exclusion only after `verifyArchiveFinalOwner` confirms the transaction's owner sentinel, and an empty or owner-only reservation is the only adopted state. Generic control carriers such as source claim roots and private-claim roots keep their fail-closed occupant checks; the policy is not extended to them.

Alternatives rejected now: deleting metadata wherever the predicate matches (unbounded deletion authority by name); deleting later metadata from the final archive (the final directory is a published or reserved destination, and deleting inside it on the basis of a name is not ownership); adopting a final directory that contains only metadata (an unrelated destination could be claimed by a Finder visit).

### 6. Refuse immutable legacy authorities explicitly; keep historical accounting strict

A saved source authority or phase fingerprint that recorded one of the three names as a `file` entry was produced under the previous policy. The engine cannot reclassify it without rewriting immutable evidence, so it refuses with the single code `archive_os_metadata_policy_incompatible`:

- `inspectArchiveApplyPlan` checks `plan.sourceFingerprint` before any mutation. Store v2's fresh-source preflight invokes the same narrow compatibility assertion before computing the current source digest, without rerunning the engine's entire inspection or changing its other preflight gates. Stored-plan abort checks the saved source authority and any tombstone stage authority as well.
- `parseArchiveJournalV2` checks `before`, `expectedAfter`, and `observedAfter` of every phase fingerprint. Apply preserves the policy-incompatible code through `applyFailure`; both stage and published abort journal catches preserve it while retaining their existing classifications for other errors.
- `applyFailure` maps the code to `status: 'blocked'` with a manual-recovery action that instructs the operator to preserve the saved plan, archive, and journal unchanged and to resolve the transaction with the engine that created it. No exact-token replay command and no abort command is offered for this code.

No plan or journal bytes are rewritten and no schema version is bumped: the wire shape is unchanged, and the incompatibility is a property of recorded content, not of the format.

Standalone accounting keeps the historical contract. `verifyArchiveAccounting` and `verifyArchiveV2Accounting` pass the recorded evidence entries into `hashArchiveEvidence`, which hashes any path a receipt recorded even when the name is metadata. A recorded metadata file that changed or disappeared is therefore still a verification failure; only unrecorded metadata is ignored.

Alternatives rejected now: silently dropping recorded metadata from legacy authorities (breaks the plan hash and rewrites evidence the operator reviewed); an automatic migration of saved plans (mutation of immutable authorities outside any transaction); a serialized schema version bump (nothing in the format changed, and older readers would gain nothing from it).

### 7. Handle names and paths portably; treat native Windows as unverified

Name matching is string-based and does not consult the filesystem's case sensitivity, so `THUMBS.DB` on a case-sensitive filesystem is treated as metadata just as it would be on Windows, and `.ds_store` is not. Filesystem paths are built with `path.join` / `path.resolve`; recorded authority paths are `/`-separated and are inspected with `path.posix.basename`; Git pathspecs are produced from normalized repository-relative paths. Regression cases that create symlinks skip on Windows following the existing suite convention.

No native Windows execution of the recovery pathspec conversion, of path aliasing under junctions or worktrees, or of the metadata lifecycle has been performed. That is a limitation of this Change, not a verified property.

### 8. Restart and refusal semantics for saved plans

A saved plan is immutable, and the engine offers exactly two safe continuations for a stopped transaction:

- Before any durable mutation, `rasen archive --abort-plan <token> --yes` retires the token and the owned stage and journal under the existing ownership checks, after which the operator creates a new plan. A plan saved before the provenance fix that now disagrees with the observed planning branch or tree state stops with `ESTALE` before durable mutation and takes this path if the disagreement is permanent.
- After a durable mutation, only exact-token replay (`rasen archive --apply-plan <token> --yes`) may continue the transaction. The frozen Git facts are consumed as provenance, and the durable stage and source authorities decide whether progressed state may advance.

Hand-editing a journal, ledger, `archive.json`, or saved plan is never a recovery path: every authority is identity- and digest-bound, and edited carriers fail ownership or integrity checks. Creating a new plan while a transaction's stage, final, or journal still exists is not a recovery path either; the engine reports both paths and deletes neither. A policy-incompatible legacy transaction is resolved with the engine version that created it, as its refusal message states.

### 9. Same-repository planning is a repository-specific exception

This repository intentionally tracks `rasen/` in the product Git repository, following its upstream fork. Decision 1 accommodates that layout without configuration because the owning repository is discovered from the planning workspace rather than assumed. Nothing in this Change initializes a nested repository, migrates planning history, or changes the product-wide planning convention, and `local_docs` is untouched.

## Risks / Trade-offs

- [Risk] In a same-repository layout, unrelated product-file edits make `planningTreeState` `dirty`. → The recorded fact is truthful repository-wide state; Decision 2 keeps planning and recovery comparisons on the same scope, so this does not produce false `ESTALE`.
- [Risk] An unignored metadata file in a tracked planning tree flips Git state between planning and retry. → Refused as Git drift by design; the payload policy does not filter Git facts. The real CLI smoke with a Git-unignored `desktop.ini` exited `1` with a `recoverable` `git`/`ESTALE` result. Operators who want that tolerance ignore the names in Git.
- [Risk] A `rasen/.git` gitfile that points at a missing gitdir is classified as non-Git by the existing classifier in `src/core/store/git.ts`, and planning then records `null` / `clean` without a blocker. → Observed during review of this Change; the classifier predates it and is not changed here. A corrupted planning gitfile is a residual acceptance gap, not a property this design guarantees.
- [Risk] An unborn planning `HEAD` cannot answer branch and status queries. → Observed as Git exit `128` and a failed CLI dry-run; archiving before the first planning commit is not supported. Whether that failure surfaces as a typed `git` blocker at runtime has not been evidenced.
- [Risk] A metadata file is replaced by a directory or symlink, or its directory changes identity, while it is being classified or disposed. → `ESTALE` or ownership refusal; the object is retained and nothing is unlinked by name.
- [Risk] Deletion authority could creep from the three disposal sites to other callers. → Disposal is opt-in through the transaction id parameter; canonical spec deletion and generic carriers keep exact inventories.
- [Risk] A legacy transaction with recorded metadata cannot be finished by the new engine. → Explicit `blocked` status with preservation guidance; the original engine remains the resolution path, and no evidence is rewritten.
- [Risk] A wrapper's independent preflight or error translation could hide policy incompatibility as ordinary drift or corruption. → Store v2 shares the assertion before its digest comparison, abort preserves the code at both catches, and three red/green regression cases plus independent re-review cover these integration boundaries.
- [Risk] Native Windows behavior has not been executed. → Keep the Windows CI task unchecked; macOS name-case tests and platform-neutral path coverage are not substitutes for native filesystem evidence.

## Migration Plan

No data migration exists. Saved plans, journals, ledgers, and Archive v2 records keep their format and bytes; new plans simply record metadata-free payload authorities and repository-owned planning provenance.

Local implementation and scoped review are complete. Native Windows CI, landing or release, and archive of this Change remain separate steps; the current verification and remaining work are recorded in `tasks.md` and `evidence/verification-report.md`.

Rollback is code-only. [INFERENCE] Because an older engine compares exact inventories, a plan created under the new policy while metadata exists on disk is expected not to match under that engine; this is a compatibility risk derived from the pre-change comparison contract, not an executed observation. Open transactions must be finished or aborted with the engine that created them, in either direction.

## Open Questions

No metadata-policy choice remains open. The two review findings were resolved during the third review round; their history is retained in `evidence/review-cycle-report.md`.

- Native Windows CI, including junction/worktree path handling and platform filesystem behavior, remains unverified. The macOS CLI alias smoke does not replace that evidence.
- The pre-existing malformed planning gitfile classifier gap remains outside this Change. The canonical fail-closed Git requirement still applies; this is a known implementation gap, not a newly accepted non-Git representation.
