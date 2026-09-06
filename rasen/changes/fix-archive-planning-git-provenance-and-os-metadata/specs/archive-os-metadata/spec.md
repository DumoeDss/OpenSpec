## Purpose

Finder and Windows Explorer write `.DS_Store`, `Thumbs.db`, and `desktop.ini` into directories they merely display. The archive engine previously treated those files as change payload: one created after planning made an otherwise unchanged active change read as source drift, and one created inside a completed archive made same-token replay refuse ownership of the archive's own target. This capability defines one policy for exactly those three names across archive planning, staging, publication, accounting, recovery, and completed replay. It keeps the regular files out of payload and comparisons, disposes of them only together with payload the transaction already owns, tolerates them inside an archive the transaction already owns, and refuses explicitly when a saved historical authority recorded them as payload. Everything else keeps its existing contract: other hidden files remain payload, Git remains the authority for tree state, canonical spec deletion keeps exact inventories, ephemera keep their cleaner policy, and every ownership check stays fail-closed.

## ADDED Requirements

### Requirement: Known regular OS metadata files are outside the archive payload

The archive SHALL treat exactly three names as OS metadata: `.DS_Store` compared exactly, and `Thumbs.db` and `desktop.ini` compared case-insensitively. Only a regular file bearing one of those names is metadata; the decision SHALL be made from the entry's name and observed type alone, at any depth of the change tree, and independently of the platform path separator used to reach it. Every archive inventory and comparison SHALL apply the same predicate: the active source fingerprint and deletion authority, the handoff inventory, evidence discovery and quality capture, the stage copy, the final reservation copy, the owned reservation inventory, and the completed-archive fingerprint and accounting verification. An excluded file SHALL appear in no archive payload, evidence digest, or handoff inventory, and its creation, modification, or removal between planning and apply SHALL NOT be reported as source drift. Git tree-state drift is judged separately by Git, and a saved authority written under the previous policy is refused rather than reinterpreted. No other name, hidden or not, is excluded by this policy.

#### Scenario: Pre-existing metadata is left out of payload and evidence

- **WHEN** an active change contains a regular `.DS_Store` at its root, a regular `Thumbs.db` below `evidence/`, and a regular `desktop.ini` below `handoff/` when it is planned and archived
- **THEN** the published archive SHALL contain none of the three files
- **AND** the `archive.json` evidence inventory SHALL contain no entry for them
- **AND** the handoff inventory SHALL derive no judgment requirement from them

#### Scenario: Metadata created after planning does not stale the plan

- **WHEN** a plan created under this policy is applied after a regular `.DS_Store`, `Thumbs.db`, or `desktop.ini` was created, rewritten, or removed anywhere inside the active change, the planning Git facts are unchanged because the workspace is non-Git or Git ignores the file, and no unrelated drift occurred
- **THEN** applying that plan SHALL complete the transaction
- **AND** the result SHALL NOT report a `source-inventory` blocker for the metadata file

#### Scenario: Windows names are matched case-insensitively and `.DS_Store` exactly

- **WHEN** a regular file named `THUMBS.DB` or `Desktop.INI` is present in the active change
- **THEN** it SHALL be excluded as OS metadata
- **AND** a regular file named `.ds_store` SHALL remain ordinary payload guarded by the exact source fingerprint

#### Scenario: Exclusion is decided by name, not by path spelling

- **WHEN** the same change tree is archived on Windows with backslash-separated paths and on a POSIX platform with slash-separated paths
- **THEN** the same entries SHALL be excluded on both platforms
- **AND** every reported inventory path SHALL keep the archive's existing platform-independent relative form

### Requirement: Same-name directories, symbolic links, and other hidden entries remain payload

A directory or symbolic link that carries a metadata name SHALL remain ordinary payload with the handling its kind already has in that location, and every other hidden or dot-prefixed file, management entry such as `.openspec.yaml`, and nested user file SHALL remain meaningful payload guarded by the exact source fingerprint. The change tree is never trimmed by pattern; only the three regular-file names are outside the payload.

#### Scenario: Same-name directory is archived as payload

- **WHEN** the active change contains a directory named `.DS_Store` that holds a file
- **THEN** the directory and its content SHALL be copied into the archive and accounted as payload
- **AND** a change to that directory after planning SHALL be reported as source drift

#### Scenario: Same-name symbolic link is not treated as metadata

- **WHEN** on a platform where the operator can create symbolic links, the active change contains a symbolic link named `Thumbs.db`
- **THEN** the archive SHALL handle it exactly as it handles any other symbolic link in that location
- **AND** SHALL NOT drop or delete it as OS metadata

#### Scenario: Unknown hidden file added after planning is still drift

- **WHEN** a regular file with any other dot-prefixed name is created inside the active change after a plan created under this policy was saved, while the planning Git facts remain unchanged and no unrelated drift occurred
- **THEN** apply SHALL refuse with a `source-inventory` blocker coded `ESTALE`
- **AND** the active change SHALL remain unchanged

### Requirement: Metadata classification fails closed on concurrent replacement

Content or timestamp churn of a metadata file SHALL NOT change its classification, but an entry that changes type or object identity while it is being classified or claimed, such as a `.DS_Store` file replaced by a directory or symbolic link, SHALL stop the operation with a stale-object refusal. The refusing operation, whether planning, apply, recovery, or accounting verification, SHALL leave the replaced object and every already-claimed payload in place, SHALL NOT report success, and SHALL NOT unlink any object by its metadata name alone; during apply the transaction is reported as recoverable rather than complete. Atomicity of the operating system's own writes is not assumed; the guarantee is that a race is refused rather than acted upon.

#### Scenario: Replacement during classification is refused

- **WHEN** a regular `.DS_Store` is replaced by a directory or symbolic link while an archive inventory is classifying it
- **THEN** the operation SHALL stop with an `ESTALE` refusal and SHALL NOT report success
- **AND** the replaced object and the surrounding tree SHALL remain unchanged

#### Scenario: Replacement at the disposal boundary keeps claimed payload

- **WHEN** a metadata file is replaced by a directory between its classification and its private claim during disposal
- **THEN** the transaction SHALL refuse to unlink the replacement and SHALL retain it
- **AND** payload already claimed by the transaction SHALL remain intact

### Requirement: Metadata is disposed only with verified, transaction-owned payload

The archive SHALL dispose of excluded metadata only inside a stage or projection the transaction owns and inside claimed active-source directories during the final source removal, which runs after the published archive and its accounting have been verified. Each disposal SHALL confirm the directory's expected identity and the file's regular-file identity through the transaction's private claim before unlinking, and SHALL remove nothing outside those owned directories. An apply that fails or is interrupted before source removal SHALL leave the active change, including its metadata files, unchanged.

#### Scenario: Completed archive removes source metadata with the source

- **WHEN** a transaction completes for an active change that contains regular metadata files at its root and in nested directories
- **THEN** the active change directory SHALL be removed including those files
- **AND** no metadata file outside the active change, the transaction's own stage, and its own projection SHALL be deleted

#### Scenario: Interrupted apply leaves source metadata in place

- **WHEN** apply fails or is interrupted before the source-removal phase
- **THEN** the active change, including its metadata files, SHALL remain byte-identical
- **AND** the transaction SHALL report the recoverable state as it does for any other interruption

#### Scenario: Metadata inside the owned partial stage does not block retry

- **WHEN** a retry finds a regular `Thumbs.db` that Explorer created inside the transaction's own partially copied stage
- **THEN** the retry SHALL complete the same transaction
- **AND** the published archive SHALL contain no metadata copied from the stage

### Requirement: Later metadata in an owned final archive is tolerated but never adopted from an unrelated target

Regular metadata created inside a final archive the transaction already owns SHALL be excluded from ownership and accounting comparisons, so same-token recovery of an owned transaction and replay of a completed transaction proceed without treating it as an unaccounted occupant. Metadata SHALL never drive re-accounting: it is added to no evidence inventory or ledger, and the previously recorded meaningful evidence remains the accounting authority. Recovery of an unfinished transaction continues to record its ordinary journal progress; replay of a completed transaction SHALL leave the ledger, journal, and previously recorded evidence bytes unchanged. The archive SHALL NOT delete that metadata. Excluding metadata from a final root or reservation SHALL require the transaction's own ownership sentinel to be verified first, and a final target the transaction does not own SHALL NOT be adopted because its only content is metadata; an unowned target already present at planning time or one that breaks the reviewed parent ancestry keeps its existing target-conflict, ancestry, or plan blocker.

#### Scenario: Completed replay tolerates metadata added to the owned final

- **WHEN** after a transaction completes, regular `.DS_Store`, `Thumbs.db`, or `desktop.ini` files are created in the final archive root or in a nested evidence directory and the exact token is applied again
- **THEN** the replay SHALL report the transaction complete
- **AND** the ledger, journal, and previously recorded evidence bytes SHALL remain unchanged and the metadata files SHALL remain in place

#### Scenario: Unrelated final containing only metadata is not adopted

- **WHEN** the reviewed archive parent ancestry is still bound and, after planning, an unowned final target containing only regular metadata files appears at the planned address
- **THEN** apply SHALL refuse with `archive_reservation_ownership_unverified`
- **AND** the occupant and the active source SHALL be retained

#### Scenario: Final metadata is not cleaned up automatically

- **WHEN** a transaction observes regular metadata inside its own final archive
- **THEN** it SHALL leave those files in place
- **AND** SHALL NOT report them in `archive.json`

### Requirement: Historical authorities that recorded metadata as payload are refused explicitly

A saved source authority, stage authority, or journal phase authority that recorded a regular `.DS_Store`, `Thumbs.db`, or `desktop.ini` as a file entry was written under the previous policy and cannot be reclassified without rewriting immutable evidence. Every entry point that consumes such an authority SHALL refuse with `archive_os_metadata_policy_incompatible`, naming the authority and the recorded path and directing the operator to resolve the transaction with the original engine before creating a new plan. Exact-token apply of a saved source authority SHALL be blocked at validation before apply mutates anything; a journal phase authority SHALL be refused when it is read, before any mutation that authority would authorize; Store v2 finalization SHALL report the incompatibility rather than plan staleness or drift; and stored abort SHALL report the same code rather than an invalid-journal or unverified-ownership code. The saved plan, ledger, and journal bytes SHALL remain unchanged. A refused historical transaction is not automatically resumed, migrated, or replanned. No serialized plan or journal schema version changes for this policy; incompatibility is determined from the recorded content.

#### Scenario: Legacy exact plan is refused before mutation

- **WHEN** the exact token of a plan whose saved source fingerprint records a metadata file as payload is applied
- **THEN** the result SHALL be blocked with `archive_os_metadata_policy_incompatible` at validation
- **AND** the active change, stage, final target, and stored plan SHALL be unchanged

#### Scenario: Legacy phase authority is refused by abort with the same code

- **WHEN** a stored transaction whose source fingerprint holds no metadata but whose journal phase fingerprints record a regular metadata file in the stage is aborted
- **THEN** abort SHALL report `archive_os_metadata_policy_incompatible`, not `archive_abort_journal_invalid` or `archive_abort_ownership_unverified`
- **AND** the plan and journal bytes SHALL remain unchanged

#### Scenario: Store v2 finalization reports incompatibility rather than drift

- **WHEN** a Store v2 finalization apply consumes a saved source authority that records a metadata file as payload
- **THEN** it SHALL report `archive_os_metadata_policy_incompatible` before any mutation that authority would authorize
- **AND** it SHALL NOT report the transaction as stale or drifted because the current source no longer lists that file

### Requirement: Historical evidence digests remain verified

Accounting verification of a v1 `archive.json` ledger and of an Archive v2 record SHALL hash every evidence path recorded in that ledger or record, including metadata paths recorded under the previous policy, and SHALL compare them to the recorded digests. A recorded metadata file that changed or disappeared SHALL be a verification mismatch. Metadata present in the evidence tree but absent from the record SHALL be ignored. No receipt, ledger, or evidence file SHALL be rewritten to match the current policy.

#### Scenario: Recorded legacy metadata digest verifies while unchanged

- **WHEN** a historical `archive.json` records `evidence/.DS_Store` with its digest and the file is unchanged
- **THEN** accounting verification SHALL succeed
- **AND** the ledger SHALL remain byte-identical

#### Scenario: Changed or missing recorded metadata is a mismatch

- **WHEN** a recorded `evidence/.DS_Store` is modified or removed
- **THEN** accounting verification SHALL fail with an evidence-verification mismatch

#### Scenario: Unrecorded metadata in evidence is ignored

- **WHEN** a regular `Thumbs.db` exists below `evidence/` but is not listed in the ledger or record
- **THEN** accounting verification SHALL succeed without adding it to the evidence inventory

### Requirement: Git facts, canonical specs, ephemera, and control carriers keep their own contracts

The metadata policy governs archive payload only. Git SHALL remain the authority for `planningTreeState` and Git drift: a metadata file that Git does not ignore and that turns the planning repository from clean to dirty or from dirty to clean during pre-durable recovery SHALL still be refused as Git drift, and the archive SHALL NOT edit `.gitignore` or filter Git status. Canonical spec deletion SHALL keep its exact inventory, in which a metadata file is an ordinary entry. Ephemera SHALL keep the cleaner's classification and preservation policy. A transaction control carrier such as a source-claim wrapper or a private-claim root SHALL keep refusing unknown occupants, including metadata files, fail-closed.

#### Scenario: Unignored metadata still counts as Git drift during recovery

- **WHEN** a `Thumbs.db` not ignored by the planning repository appears outside the transaction's stage between an interrupted pre-durable attempt and the retry, turning the tree from clean to dirty
- **THEN** the retry SHALL be refused as Git drift
- **AND** the metadata file SHALL be neither deleted nor ignored by the Git comparison

#### Scenario: Canonical spec deletion keeps its exact inventory

- **WHEN** a metadata file appears inside a canonical spec directory scheduled for deletion after the plan was created
- **THEN** the deletion SHALL be refused because the capability tree changed after planning
- **AND** the canonical spec directory SHALL remain unchanged

#### Scenario: Ephemera metadata follows the cleaner policy

- **WHEN** a metadata file exists below the execution-root ephemera directory
- **THEN** its disposition SHALL be determined solely by the cleaner classification
- **AND** the archive payload policy SHALL neither delete nor exclude it

#### Scenario: Metadata inside a control carrier is an unknown occupant

- **WHEN** a metadata file appears inside a source-claim wrapper or private-claim root owned by the transaction
- **THEN** the transaction SHALL refuse ownership of that carrier and retain it for recovery
- **AND** SHALL NOT delete the occupant
