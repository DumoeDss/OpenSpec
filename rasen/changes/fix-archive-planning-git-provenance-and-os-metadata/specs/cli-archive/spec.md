## ADDED Requirements

### Requirement: Archive planning records the Git provenance of the repository owning the planning workspace

Archive planning SHALL resolve `planningBranch` and `planningTreeState` from the Git repository that owns the planning workspace, the `rasen` directory below the planning root, rather than from whichever repository happens to contain the planning root. When the planning workspace is tracked by the product repository, that product repository is the owner and its branch and repository-wide tree state are recorded. When the planning workspace is its own nested Git repository, the nested repository's branch and tree state are recorded and uncommitted changes in the product repository do not affect them. The recorded tree state SHALL describe the owning repository's whole work tree as Git reports it, so uncommitted changes anywhere in that repository, including inside the active change, record `dirty`; a dirty planning tree SHALL NOT by itself block planning or apply.

`codeCommit` SHALL continue to come from the execution product repository's `HEAD` independently of the planning owner. A planning workspace confirmed to lie outside any work tree SHALL keep the existing `null` branch and `clean` representation, a detached `HEAD` SHALL record a `null` branch while remaining a confirmed Git planning state whose tree state is evaluated normally, and Git confirmation failures SHALL remain governed by the existing Git blocker contract of `archive.json`. Every supported platform spelling of the same authorized, CLI-resolved planning root SHALL resolve the same owning repository and record identical facts.

#### Scenario: Integrated planning workspace records the product repository

- **WHEN** the planning workspace is tracked by the product repository that also contains the planning root
- **THEN** the plan and `archive.json` SHALL record that repository's current branch as `planningBranch`
- **AND** `planningTreeState` SHALL be `dirty` whenever that repository's work tree has uncommitted changes anywhere, including outside `rasen/`
- **AND** `codeCommit` SHALL be that repository's `HEAD` commit

#### Scenario: Independent nested planning repository keeps product changes out of planning facts

- **WHEN** the planning workspace is its own Git repository ignored by the product repository, the product work tree has uncommitted changes, and the planning work tree is clean
- **THEN** the plan and `archive.json` SHALL record the nested repository's branch and `planningTreeState: clean`
- **AND** `codeCommit` SHALL be the product repository's `HEAD` commit, not the nested repository's

#### Scenario: Uncommitted changes inside the active change make the planning tree dirty

- **WHEN** the only uncommitted change in the owning planning repository is a file inside the active change being archived
- **THEN** planning SHALL record `planningTreeState: dirty`
- **AND** apply SHALL proceed and `archive.json` SHALL record `dirty`

#### Scenario: Detached planning HEAD records a null branch

- **WHEN** the owning planning repository has a detached `HEAD`
- **THEN** `planningBranch` SHALL be `null`
- **AND** the planning state SHALL remain a confirmed Git state with its tree state evaluated normally

#### Scenario: Windows spelling does not change the owning repository

- **WHEN** the CLI resolves the same authorized planning root on Windows under supported spellings that differ in drive-letter case or path separators
- **THEN** planning SHALL resolve the same owning repository
- **AND** SHALL record identical `planningBranch`, `planningTreeState`, and `codeCommit`

### Requirement: Interrupted archive recovery compares the planning repository at its original scope

Before a transaction's first durable mutation, applying the exact stored token SHALL re-derive the Git facts and compare them with the plan at the scope planning used: the execution repository's state and commit, the planning owner's state and branch, and the planning owner's repository-wide tree state. The only path excluded from that tree-state comparison SHALL be the transaction's admitted owned stage directory. Transient projections and cleanup claims may have existed before this point, but the transaction's debris guard SHALL have rejected any leftover carrier before the Git comparison runs, so no other archive-written path is excused from it. Uncommitted changes that already existed at planning time, including changes inside the active change, therefore compare equal on retry and SHALL NOT be reported as drift.

A clean-to-dirty or dirty-to-clean transition caused by anything other than the admitted owned stage SHALL be refused as Git drift: the result SHALL be `recoverable` with a `git` blocker coded `ESTALE` and the plan's own `planHash`, and the journal, active change, ephemera, stored plan token, and absent final target SHALL be left exactly as found. Once the original state is restored, the same token SHALL resume and complete, and `archive.json` SHALL record the tree state captured at planning time. After the first durable mutation the planned Git facts SHALL remain the recorded authority, as they do today. Tree state is a two-valued fact: a change that leaves the repository dirty both before and after is not detected by this comparison, and the active change's content remains guarded by the source fingerprint rather than by Git.

#### Scenario: Active-only dirty input resumes after an interrupted payload copy

- **WHEN** a plan was created while the only uncommitted change in the planning owner was inside the active change, the first payload copy fails with `EIO`, and nothing else changes
- **THEN** applying the exact token again SHALL complete the same transaction
- **AND** `archive.json` SHALL record `planningTreeState: dirty` together with the planned branch and `codeCommit`

#### Scenario: Outside-owned tree-state drift is refused without touching either copy

- **WHEN** between an interrupted pre-durable attempt and the retry, a file outside the transaction's stage turns the planning owner's tree from clean to dirty or from dirty to clean
- **THEN** the retry SHALL report `recoverable` with a `git` blocker coded `ESTALE` and the same `planHash`
- **AND** the journal, the active change's tasks, the ephemera, and the stored plan SHALL be byte-identical to their state before the retry
- **AND** the final target SHALL NOT exist

#### Scenario: Restoring the planned state lets the same token complete

- **WHEN** the outside-owned drift is reverted and the exact token is applied again
- **THEN** the transaction SHALL complete with `resumed: true`
- **AND** `archive.json` SHALL record the tree state captured at planning time

#### Scenario: The transaction's own stage is never counted as drift

- **WHEN** the admitted owned stage directory lies inside the planning owner's work tree and holds a partially copied payload from the interrupted attempt
- **THEN** the retry's tree-state comparison SHALL exclude only that stage directory
- **AND** the exclusion SHALL apply under every supported platform spelling of the same authorized, CLI-resolved planning root and stage path, including Windows drive-letter and separator variations

## MODIFIED Requirements

### Requirement: archive.json is written to the archived directory

The archive engine SHALL finalize `archive.json` from confirmed Git facts, the finalized recursive evidence inventory, validated sidecar intent, and actual cleaner outcomes. The planning facts SHALL come from the Git repository that owns the planning workspace, the `rasen` directory below the planning root, and `codeCommit` SHALL come from the execution project's own repository. It SHALL write and verify the file atomically before removing the active change. A confirmed non-Git root may use its defined null/clean representation; Git ambiguity, sidecar failure, evidence read/hash failure, or accounting write failure SHALL block completion and remain recoverable through the transaction journal.

#### Scenario: archive.json is finalized before active-source removal

- **WHEN** archive completes successfully
- **THEN** the published directory SHALL contain a parsed and verified `archive.json`
- **AND** its evidence digests SHALL match the final evidence tree
- **AND** only then may the active change be removed

#### Scenario: Store-selected run records the code project's commit

- **WHEN** a store-selected change is archived with a confirmed Git execution project
- **THEN** `codeCommit` SHALL be that code project's HEAD SHA, not the store's HEAD SHA

#### Scenario: Confirmed non-git planning root records null branch

- **WHEN** Git confirms the planning workspace lies outside any work tree
- **THEN** `planningBranch` SHALL be `null` and `planningTreeState` SHALL be `clean`

#### Scenario: Nested planning repository under a non-Git product root records the nested branch

- **WHEN** the product root is not a work tree but the planning workspace below it is its own Git repository
- **THEN** `planningBranch` SHALL be the nested repository's branch and `planningTreeState` SHALL describe the nested repository's work tree
- **AND** `codeCommit` SHALL continue to follow the execution project's own confirmed Git state

#### Scenario: Ambiguous Git state blocks accounting

- **WHEN** Git is unavailable, metadata is corrupt, or a branch/status/HEAD query fails unexpectedly
- **THEN** the engine SHALL report a Git blocker
- **AND** SHALL NOT guess `null`, `clean`, or a commit value

#### Scenario: Accounting write failure keeps recovery evidence

- **WHEN** atomic `archive.json` write or verification fails after publication
- **THEN** the active change SHALL remain
- **AND** the archive-local journal SHALL identify the failed phase and planned accounting
- **AND** completion SHALL NOT be reported
