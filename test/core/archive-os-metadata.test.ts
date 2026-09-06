import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  abortArchivePlan,
  applyArchive,
  createArchiveIntentTemplate,
  createArchivePlan,
  defaultArchiveEngineAdapters,
  fingerprintArchiveTree,
  hashArchivePlan,
  persistArchivePlan,
  resolveArchiveSidecar,
  stableArchiveJson,
  withStoredArchivePlanOperation,
  type ArchiveEngineAdapters,
  type ArchiveJournal,
  type ArchivePlan,
} from '../../src/core/archive-engine.js';
import { cleanupTempPathAsync } from '../helpers/temp-cleanup.js';
import { hashTree } from '../helpers/store-finalization-fixture.js';

const metadataCases = [
  { scenario: 'Finder .DS_Store', name: '.DS_Store' },
  { scenario: 'Windows Thumbs.db', name: 'Thumbs.db' },
  { scenario: 'Windows desktop.ini', name: 'desktop.ini' },
  { scenario: 'mixed-case Windows thumbnail metadata', name: 'tHuMbS.Db' },
  { scenario: 'uppercase Windows desktop metadata', name: 'DESKTOP.INI' },
];

interface PayloadMutationCase {
  readonly scenario: string;
  readonly mutate: (directory: string) => Promise<unknown>;
}

const payloadMutations: PayloadMutationCase[] = [
  {
    scenario: 'a same-name metadata directory',
    mutate: directory => fs.mkdir(path.join(directory, 'Thumbs.db')),
  },
  {
    scenario: 'a genuine payload edit',
    mutate: directory => fs.writeFile(path.join(directory, 'proposal.md'), '# Changed\n'),
  },
  {
    scenario: 'an unknown hidden payload file',
    mutate: directory => fs.writeFile(path.join(directory, '.user-data'), 'preserve\n'),
  },
];

describe('archive OS metadata policy', () => {
  let root: string;
  let active: string;
  let archiveParent: string;
  let ephemera: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'rasen-archive-os-metadata-'));
    active = path.join(root, 'rasen', 'changes', 'sample');
    archiveParent = path.join(root, 'rasen', 'changes', 'archive');
    ephemera = path.join(root, '.rasen', 'changes', 'sample', 'ephemera');
    await fs.mkdir(path.join(active, 'evidence', 'nested'), { recursive: true });
    await fs.mkdir(path.join(active, 'handoff', 'nested'), { recursive: true });
    await fs.mkdir(ephemera, { recursive: true });
    await fs.writeFile(path.join(active, 'proposal.md'), '# Sample\n');
    await fs.writeFile(path.join(active, 'evidence', 'nested', 'report.md'), '# Evidence\n');
  });

  afterEach(async () => {
    await cleanupTempPathAsync(root);
  });

  async function plan() {
    return createArchivePlan({
      change: 'sample',
      planningRoot: root,
      executionRoot: root,
      activePath: active,
      archiveParent,
      ephemeraPath: ephemera,
      date: '2026-09-06',
      keepEphemera: false,
      validation: 'passed',
      tasks: { total: 1, completed: 1, override: false },
      timing: { mode: 'on-merge', deliveryMode: 'local', override: false },
      specActions: [],
      sidecar: await resolveArchiveSidecar(active, root, 'sample'),
      transactionId: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-09-06T00:00:00.000Z',
    });
  }

  it.each(metadataCases)('omits preexisting $scenario without losing hidden payload or handoff judgments', async ({ name }) => {
    const ignored = [name, `evidence/nested/${name}`, `handoff/nested/${name}`];
    for (const relative of ignored) {
      await fs.writeFile(path.join(active, ...relative.split('/')), 'OS metadata\n');
    }
    await fs.writeFile(path.join(active, '.private'), 'meaningful hidden payload\n');
    await fs.writeFile(path.join(active, 'evidence', '.notes'), 'hidden evidence\n');
    await fs.writeFile(path.join(active, 'handoff', 'nested', '.memo'), 'handoff judgment\n');
    await fs.writeFile(path.join(active, '.openspec.yaml'), 'schema: spec-driven\n');
    await fs.writeFile(path.join(ephemera, name), 'independent ephemera policy\n');
    const intent = await createArchiveIntentTemplate(active, 'sample');
    expect(intent.handoff.decisions).toEqual([
      { path: 'handoff/nested/.memo', outcome: 'preserved' },
    ]);
    intent.handoff.complete = true;
    await fs.writeFile(path.join(active, '.rasen-archive-input.json'), JSON.stringify(intent));

    const archivePlan = await plan();
    expect(archivePlan.complete, JSON.stringify(archivePlan.blockers)).toBe(true);
    expect(archivePlan.evidenceInputs).toEqual([
      'evidence/.notes',
      'evidence/handoff/nested/.memo',
      'evidence/nested/report.md',
      'evidence/ship-log.md',
    ]);
    for (const relative of ignored) {
      expect(archivePlan.sourceFingerprint?.entries.map(entry => entry.path)).not.toContain(relative);
      expect(archivePlan.sourceFingerprint?.authorityEntries.map(entry => entry.path)).not.toContain(relative);
    }

    const result = await applyArchive(archivePlan);
    expect(result.status, JSON.stringify(result)).toBe('complete');
    for (const relative of ignored) {
      await expect(fs.lstat(path.join(archivePlan.paths.final, ...relative.split('/')))).rejects.toMatchObject({ code: 'ENOENT' });
    }
    await expect(fs.readFile(path.join(archivePlan.paths.final, '.private'), 'utf8')).resolves.toBe('meaningful hidden payload\n');
    await expect(fs.readFile(path.join(archivePlan.paths.final, 'evidence', '.notes'), 'utf8')).resolves.toBe('hidden evidence\n');
    await expect(fs.readFile(path.join(archivePlan.paths.final, 'evidence', 'handoff', 'nested', '.memo'), 'utf8')).resolves.toBe('handoff judgment\n');
    expect(await fs.readFile(path.join(archivePlan.paths.final, '.openspec.yaml'), 'utf8')).toContain('schema: spec-driven');
    await expect(fs.readFile(path.join(ephemera, name), 'utf8')).resolves.toBe('independent ephemera policy\n');
    const accounting = JSON.parse(await fs.readFile(path.join(archivePlan.paths.final, 'archive.json'), 'utf8'));
    expect(accounting.evidence.map((entry: { path: string }) => entry.path)).toEqual(archivePlan.evidenceInputs);
    expect(accounting.handoffAbsorbed).toEqual([{ file: 'handoff/nested/.memo', outcome: 'preserved' }]);
    await expect(fs.lstat(active)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(metadataCases)('tolerates $scenario creation, update, removal and completed replay', async ({ name }) => {
    const evidenceMetadata = path.join(active, 'evidence', 'nested', name);
    const handoffMetadata = path.join(active, 'handoff', 'nested', name);
    await fs.writeFile(evidenceMetadata, 'old metadata\n');
    await fs.writeFile(handoffMetadata, 'remove after planning\n');
    const archivePlan = await plan();
    await fs.writeFile(path.join(active, name), 'created after planning\n');
    await fs.writeFile(evidenceMetadata, 'updated after planning\n');
    await fs.unlink(handoffMetadata);

    const result = await applyArchive(archivePlan);
    expect(result.status, JSON.stringify(result)).toBe('complete');
    await expect(fs.lstat(active)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.lstat(archivePlan.paths.stage)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.lstat(path.join(archivePlan.paths.final, name))).rejects.toMatchObject({ code: 'ENOENT' });
    const ledgerPath = path.join(archivePlan.paths.final, 'archive.json');
    const ledgerBefore = await fs.readFile(ledgerPath);
    const journalBefore = await fs.readFile(archivePlan.paths.publishedJournal);
    const finalMetadata = path.join(archivePlan.paths.final, name);
    await fs.writeFile(finalMetadata, 'unowned final OS metadata\n');
    await fs.writeFile(path.join(archivePlan.paths.final, 'evidence', 'nested', name), 'later evidence metadata\n');

    const replay = await applyArchive(archivePlan);
    expect(replay.status, JSON.stringify(replay)).toBe('complete');
    expect(replay.resumed).toBe(true);
    expect(await fs.readFile(ledgerPath)).toEqual(ledgerBefore);
    expect(await fs.readFile(archivePlan.paths.publishedJournal)).toEqual(journalBefore);
    await expect(fs.readFile(finalMetadata, 'utf8')).resolves.toBe('unowned final OS metadata\n');
  });

  it('retries an owned partial stage with metadata and cleans metadata introduced during handoff staging', async () => {
    await fs.writeFile(path.join(active, 'handoff', 'nested', 'note.md'), 'retain handoff\n');
    const intent = await createArchiveIntentTemplate(active, 'sample');
    intent.handoff.complete = true;
    await fs.writeFile(path.join(active, '.rasen-archive-input.json'), JSON.stringify(intent));
    const archivePlan = await plan();
    let failCopy = true;
    const adapters: ArchiveEngineAdapters = {
      ...defaultArchiveEngineAdapters,
      fs: {
        ...defaultArchiveEngineAdapters.fs,
        copyFile: async (source, target, flags) => {
          if (source === path.join(active, 'evidence', 'nested', 'report.md') && failCopy) {
            failCopy = false;
            throw Object.assign(new Error('injected payload copy failure'), { code: 'EIO' });
          }
          await defaultArchiveEngineAdapters.fs.copyFile(source, target, flags);
          if (source === path.join(active, 'handoff', 'nested', 'note.md')) {
            await fs.writeFile(path.join(path.dirname(target), 'desktop.ini'), 'staged OS metadata\n');
          }
        },
      },
    };
    expect((await applyArchive(archivePlan, { adapters })).status).toBe('recoverable');
    await fs.writeFile(path.join(archivePlan.paths.stage, '.DS_Store'), 'partial-stage metadata\n');
    const retry = await applyArchive(archivePlan, { adapters });
    expect(retry.status, JSON.stringify(retry)).toBe('complete');
    await expect(fs.readFile(path.join(archivePlan.paths.final, 'evidence', 'handoff', 'nested', 'note.md'), 'utf8')).resolves.toBe('retain handoff\n');
    await expect(fs.lstat(archivePlan.paths.stage)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.lstat(active)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(payloadMutations)('refuses source drift from $scenario', async ({ mutate }) => {
    const archivePlan = await plan();
    await mutate(active);
    const result = await applyArchive(archivePlan);
    expect(result).toMatchObject({
      status: 'recoverable',
      blockers: [expect.objectContaining({ operation: 'source-inventory', code: 'ESTALE' })],
    });
    expect((await fs.lstat(active)).isDirectory()).toBe(true);
    await expect(fs.lstat(archivePlan.paths.final)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(payloadMutations)('keeps completed verification fail-closed for $scenario', async ({ mutate }) => {
    const archivePlan = await plan();
    expect((await applyArchive(archivePlan)).status).toBe('complete');
    await mutate(archivePlan.paths.final);
    const replay = await applyArchive(archivePlan);
    expect(replay.status).toBe('recoverable');
    expect(replay.manualRecoveryAction?.kind).toBe('manual-recovery-required');
  });

  it('archives a same-name directory as ordinary payload', async () => {
    await fs.mkdir(path.join(active, 'evidence', 'Thumbs.db'));
    await fs.writeFile(path.join(active, 'evidence', 'Thumbs.db', 'meaningful.txt'), 'not OS metadata\n');
    const archivePlan = await plan();
    expect(archivePlan.evidenceInputs).toContain('evidence/Thumbs.db/meaningful.txt');
    const result = await applyArchive(archivePlan);
    expect(result.status, JSON.stringify(result)).toBe('complete');
    await expect(fs.readFile(path.join(archivePlan.paths.final, 'evidence', 'Thumbs.db', 'meaningful.txt'), 'utf8')).resolves.toBe('not OS metadata\n');
  });

  it('tolerates metadata in fresh owned reservation directories without deleting final metadata', async () => {
    const archivePlan = await plan();
    const finalEvidence = path.join(archivePlan.paths.final, 'evidence');
    const adapters: ArchiveEngineAdapters = {
      ...defaultArchiveEngineAdapters,
      fs: {
        ...defaultArchiveEngineAdapters.fs,
        mkdir: async (target, options) => {
          const created = await defaultArchiveEngineAdapters.fs.mkdir(target, options);
          if (target === archivePlan.paths.final || target === finalEvidence) {
            await fs.writeFile(path.join(target, '.DS_Store'), 'final OS metadata\n');
          }
          return created;
        },
      },
    };
    const result = await applyArchive(archivePlan, { adapters });
    expect(result.status, JSON.stringify(result)).toBe('complete');
    await expect(fs.readFile(path.join(archivePlan.paths.final, '.DS_Store'), 'utf8')).resolves.toBe('final OS metadata\n');
    await expect(fs.readFile(path.join(finalEvidence, '.DS_Store'), 'utf8')).resolves.toBe('final OS metadata\n');
    await expect(fs.lstat(active)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps lookalike Finder names as meaningful hidden payload', async () => {
    await fs.writeFile(path.join(active, '.ds_store'), 'not the exact Finder name\n');
    await fs.writeFile(path.join(active, '.DS_Store.backup'), 'user backup\n');
    const archivePlan = await plan();
    const result = await applyArchive(archivePlan);
    expect(result.status, JSON.stringify(result)).toBe('complete');
    await expect(fs.readFile(path.join(archivePlan.paths.final, '.ds_store'), 'utf8')).resolves.toBe('not the exact Finder name\n');
    await expect(fs.readFile(path.join(archivePlan.paths.final, '.DS_Store.backup'), 'utf8')).resolves.toBe('user backup\n');
  });

  it.skipIf(process.platform === 'win32')('never treats a same-name symlink as ignorable metadata', async () => {
    const outside = path.join(root, 'outside.txt');
    await fs.writeFile(outside, 'must survive\n');
    await fs.symlink(outside, path.join(active, 'evidence', '.DS_Store'));
    const archivePlan = await plan();
    expect(archivePlan.complete).toBe(false);
    expect(archivePlan.sourceFingerprint?.entries).toContainEqual({ path: 'evidence/.DS_Store', kind: 'symlink', linkTarget: outside });
    expect((await applyArchive(archivePlan)).status).toBe('blocked');
    await expect(fs.readFile(outside, 'utf8')).resolves.toBe('must survive\n');
  });

  it.skipIf(process.platform === 'win32')('rejects a same-name symlink added to a completed archive', async () => {
    const archivePlan = await plan();
    expect((await applyArchive(archivePlan)).status).toBe('complete');
    const outside = path.join(root, 'outside.txt');
    await fs.writeFile(outside, 'must survive replay\n');
    const link = path.join(archivePlan.paths.final, 'desktop.ini');
    await fs.symlink(outside, link);
    const replay = await applyArchive(archivePlan);
    expect(replay.status).toBe('recoverable');
    expect(replay.manualRecoveryAction?.kind).toBe('manual-recovery-required');
    expect((await fs.lstat(link)).isSymbolicLink()).toBe(true);
    await expect(fs.readFile(outside, 'utf8')).resolves.toBe('must survive replay\n');
  });

  it('does not adopt an unknown final directory merely because it contains metadata', async () => {
    await fs.mkdir(archiveParent, { recursive: true });
    const archivePlan = await plan();
    await fs.mkdir(archivePlan.paths.final, { recursive: true });
    const occupant = path.join(archivePlan.paths.final, '.DS_Store');
    await fs.writeFile(occupant, 'not transaction owned\n');
    const result = await applyArchive(archivePlan);
    expect(result.status).not.toBe('complete');
    expect(result.blockers).toContainEqual(expect.objectContaining({
      code: 'archive_reservation_ownership_unverified',
    }));
    await expect(fs.readFile(occupant, 'utf8')).resolves.toBe('not transaction owned\n');
    await expect(fs.readFile(path.join(active, 'proposal.md'), 'utf8')).resolves.toBe('# Sample\n');
  });

  it('retains a metadata file retyped as a directory at the cleanup claim boundary', async () => {
    await fs.writeFile(path.join(active, '.DS_Store'), 'metadata\n');
    const archivePlan = await plan();
    let retainedDirectory: string | undefined;
    const adapters: ArchiveEngineAdapters = {
      ...defaultArchiveEngineAdapters,
      fs: {
        ...defaultArchiveEngineAdapters.fs,
        rename: async (source, target) => {
          if (path.basename(source) === '.DS_Store') {
            await fs.rename(source, `${source}.displaced`);
            await fs.mkdir(source);
            await fs.writeFile(path.join(source, 'meaningful.txt'), 'must survive cleanup\n');
            retainedDirectory = target;
          }
          await defaultArchiveEngineAdapters.fs.rename(source, target);
        },
      },
    };
    const result = await applyArchive(archivePlan, { adapters });
    expect(result.status).toBe('recoverable');
    expect(result.manualRecoveryAction?.kind).toBe('manual-recovery-required');
    expect(retainedDirectory).toBeDefined();
    await expect(fs.readFile(path.join(retainedDirectory!, 'meaningful.txt'), 'utf8')).resolves.toBe('must survive cleanup\n');
    await expect(fs.readFile(path.join(archivePlan.paths.final, 'proposal.md'), 'utf8')).resolves.toBe('# Sample\n');
  });

  it('rejects an old exact plan that recorded metadata without rewriting its authority', async () => {
    await fs.writeFile(path.join(active, '.DS_Store'), 'historical payload\n');
    const archivePlan = await plan();
    archivePlan.sourceFingerprint = await fingerprintArchiveTree(active, defaultArchiveEngineAdapters, { excludeOsMetadata: false });
    const { planHash: _planHash, ...withoutHash } = archivePlan;
    archivePlan.planHash = hashArchivePlan(withoutHash);
    const before = JSON.stringify(archivePlan);
    const result = await applyArchive(archivePlan);
    expect(result).toMatchObject({
      status: 'blocked',
      blockers: [expect.objectContaining({ code: 'archive_os_metadata_policy_incompatible' })],
    });
    expect(JSON.stringify(archivePlan)).toBe(before);
    await expect(fs.readFile(path.join(active, '.DS_Store'), 'utf8')).resolves.toBe('historical payload\n');
    await expect(fs.lstat(archivePlan.paths.stage)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  interface LegacyPhaseJournalCase {
    readonly scenario: string;
    readonly payload: 'stage' | 'final';
    readonly journal: 'journal' | 'publishedJournal';
    readonly phase: 'payload-copied' | 'accounting-finalized';
    readonly authorities: readonly ('before' | 'expectedAfter' | 'observedAfter')[];
    readonly stop: (operation: 'copy' | 'rename', source: string, archivePlan: ArchivePlan) => boolean;
  }

  const legacyPhaseJournals: LegacyPhaseJournalCase[] = [
    {
      scenario: 'stage-only legacy metadata authority',
      payload: 'stage',
      journal: 'journal',
      phase: 'payload-copied',
      authorities: ['before'],
      stop: operation => operation === 'copy',
    },
    {
      scenario: 'published legacy metadata authority',
      payload: 'final',
      journal: 'publishedJournal',
      phase: 'accounting-finalized',
      authorities: ['before', 'expectedAfter', 'observedAfter'],
      stop: (operation, source, archivePlan) =>
        operation === 'rename' && source === archivePlan.paths.active,
    },
  ];

  it.each(legacyPhaseJournals)('abort preserves the policy code and all bytes for $scenario', async ({ payload, journal: journalKey, phase, authorities, stop }) => {
    const archivePlan = await plan();
    const globalDataDir = path.join(root, 'global-data');
    await persistArchivePlan(archivePlan, globalDataDir);
    const adapters: ArchiveEngineAdapters = {
      ...defaultArchiveEngineAdapters,
      fs: {
        ...defaultArchiveEngineAdapters.fs,
        copyFile: async (source, target, flags) => {
          if (stop('copy', source, archivePlan)) {
            throw Object.assign(new Error('injected partial archive copy'), { code: 'EIO' });
          }
          await defaultArchiveEngineAdapters.fs.copyFile(source, target, flags);
        },
        rename: async (source, target) => {
          if (stop('rename', source, archivePlan)) {
            throw Object.assign(new Error('injected source-last claim failure'), { code: 'EIO' });
          }
          await defaultArchiveEngineAdapters.fs.rename(source, target);
        },
      },
    };
    expect((await applyArchive(archivePlan, { adapters })).status).toBe('recoverable');
    const payloadRoot = archivePlan.paths[payload];
    const journalPath = archivePlan.paths[journalKey];
    await fs.writeFile(path.join(payloadRoot, '.DS_Store'), 'historically recorded stage/final metadata\n');
    const legacy = await fingerprintArchiveTree(
      payloadRoot, defaultArchiveEngineAdapters, { excludeOsMetadata: false }
    );
    const metadataEntry = legacy.entries.find(entry => entry.path === '.DS_Store')!;
    const metadataAuthority = legacy.authorityEntries.find(entry => entry.path === '.DS_Store')!;
    const journal = JSON.parse(await fs.readFile(journalPath, 'utf8')) as ArchiveJournal;
    // Reconstruct the old policy's valid, self-hashed phase authorities from
    // real filesystem identities without adding metadata to the saved source.
    for (const name of authorities) {
      const fingerprint = journal.phaseFingerprints[phase][name]!;
      fingerprint.entries.push(metadataEntry);
      fingerprint.authorityEntries.push(metadataAuthority);
      fingerprint.digest = defaultArchiveEngineAdapters.sha256(stableArchiveJson(fingerprint.entries));
      fingerprint.authorityDigest = defaultArchiveEngineAdapters.sha256(
        stableArchiveJson({ rootIdentity: fingerprint.rootIdentity, entries: fingerprint.authorityEntries })
      );
    }
    await fs.writeFile(journalPath, JSON.stringify(journal));
    const beforeAbort = hashTree(root);

    const result = await withStoredArchivePlanOperation(
      archivePlan,
      globalDataDir,
      'abort',
      () => abortArchivePlan(archivePlan, globalDataDir)
    );
    expect(result).toMatchObject({
      status: 'blocked',
      blockers: [expect.objectContaining({ code: 'archive_os_metadata_policy_incompatible' })],
    });
    expect(result.recoveryCommand).toBeUndefined();
    // Includes source, saved plan, phase journal, and the published ledger.
    expect(hashTree(root)).toEqual(beforeAbort);
  });
});
