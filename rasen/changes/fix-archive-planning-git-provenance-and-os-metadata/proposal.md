## Why

Archive planning could report Git provenance from the product repository instead of the repository owning the planning workspace. Reproductions also showed unchanged active-only dirty input being rejected on interrupted recovery, and ordinary OS metadata creation invalidating an otherwise unchanged source or completed archive.

This is a retrospective Change: investigation and implementation preceded artifact creation. Completed work and remaining verification are distinguished in `tasks.md` and the evidence reports; this proposal does not claim a prior design approval or a completed delivery.

## What Changes

- Resolve planning branch and repository-wide tree state from the Git repository owning the planning workspace, while keeping `codeCommit` tied to the execution product repository.
- Make pre-durable same-token recovery compare the original Git input scope while excluding its own surviving stage. Preserve refusal of outside-owned clean/dirty transitions.
- Exclude regular `.DS_Store`, `Thumbs.db`, and `desktop.ini` files from archive payload, evidence, handoff inventory, and filesystem integrity comparisons. The operator explicitly selected exclusion rather than preservation. Windows names are case-insensitive; `.DS_Store` is exact.
- Dispose of excluded metadata with successfully archived source and owned staging payload. Tolerate later regular metadata in an already-owned final archive without deleting it or adopting an unrelated destination.
- Preserve meaningful hidden files, same-name directories and symlinks, transaction ownership checks, canonical-spec deletion rules, and the independent ephemera policy. Repository-wide Git facts and Git drift checks remain unchanged by the metadata policy.
- **BREAKING**: explicitly reject saved source or phase authorities that recorded now-excluded metadata as payload with `archive_os_metadata_policy_incompatible`. Do not rewrite their immutable plans or ledgers. Standalone v1/v2 accounting verification continues to require historical recorded metadata digests.

## Capabilities

### New Capabilities

- `archive-os-metadata`: Consistent, ownership-safe exclusion of known regular OS metadata across archive creation, recovery, accounting, and completed replay, including explicit historical-plan handling.

### Modified Capabilities

- `cli-archive`: Clarify planning-workspace Git provenance and the stable Git comparison scope for interrupted archive recovery.

## Impact

- Production code: `src/core/archive-engine.ts`, `src/core/archive-accounting.ts`, `src/core/archive-accounting-v2.ts`, and `src/core/archive-os-metadata.ts`.
- Regression coverage: archive command, fault-matrix, OS metadata lifecycle, and accounting tests, plus broader archive/finalization verification and real CLI smoke scenarios.
- No new dependency, CLI flag, Git-status filtering rule, automatic `.gitignore` edit, or serialized plan/journal schema version is introduced.
- This product repository follows its upstream fork's same-repository planning convention, as clarified by the operator. This Change does not split `rasen/` into a nested Git repository or migrate existing planning history.
- Existing canonical specs and unrelated active Changes are not synchronized or rewritten during this retrospective proposal. Delivery and archive remain separate actions.
