import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeStoreMetadataState } from '../../src/core/store/foundation.js';
import { snapshotDirectory } from '../helpers/fs-snapshot.js';
import { createOpenSpecRoot } from '../helpers/rasen-fixtures.js';
import { runCLI, type RunCLIResult } from '../helpers/run-cli.js';
import { isolatedGitEnv } from '../helpers/store-git.js';
import { cleanupTempPath } from '../helpers/temp-cleanup.js';

const PROJECT_ID = 'repo-local-app';
const CHANGE_ID = 'discover-local-scope';

function parseJson(result: RunCLIResult, expectedExitCode = 0): unknown {
  expect(
    result.exitCode,
    `${result.command}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  ).toBe(expectedExitCode);
  return JSON.parse(result.stdout);
}

describe('repo-local typed scope discovery', () => {
  let tempDir: string;
  let repoRoot: string;
  let planningRoot: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (/^(GIT_|RASEN_)/i.test(key)) {
        // Reuse one stub name for Windows case aliases and explicit fixture settings.
        vi.stubEnv(process.platform === 'win32' ? key.toUpperCase() : key, undefined);
      }
    }
    tempDir = fs.realpathSync.native(
      fs.mkdtempSync(path.join(os.tmpdir(), 'rasen-repo-local-scope-'))
    );
    const homeDir = path.join(tempDir, 'home');
    fs.mkdirSync(homeDir);
    env = {
      ...isolatedGitEnv(tempDir),
      HOME: homeDir,
      USERPROFILE: homeDir,
      RASEN_HOME: path.join(tempDir, 'machine'),
      XDG_DATA_HOME: path.join(tempDir, 'data'),
      XDG_CONFIG_HOME: path.join(tempDir, 'config'),
      RASEN_LANG: 'en',
      RASEN_TELEMETRY: '0',
      OPEN_SPEC_INTERACTIVE: '0',
    };
    repoRoot = path.join(tempDir, 'app');
    planningRoot = path.join(repoRoot, 'rasen');
    createOpenSpecRoot(repoRoot);
    fs.writeFileSync(
      path.join(planningRoot, 'config.yaml'),
      `schema: spec-driven\nprojectId: ${PROJECT_ID}\n`
    );

    // Planning has its own Git identity, but remains the product's rasen/ tree.
    for (const checkout of [repoRoot, planningRoot]) {
      const options = {
        cwd: checkout,
        env: { ...process.env, ...env },
        stdio: 'pipe' as const,
        windowsHide: true,
      };
      execFileSync('git', ['init', '--initial-branch=main'], options);
      const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
        ...options,
        encoding: 'utf8',
      }).trim();
      expect(fs.realpathSync.native(gitRoot)).toBe(fs.realpathSync.native(checkout));
      execFileSync(
        'git',
        ['commit', '--allow-empty', '-m', 'Seed standalone scope fixture'],
        options
      );
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    cleanupTempPath(tempDir);
  });

  function expectStandaloneRoot(output: unknown): void {
    expect(output).toEqual(expect.objectContaining({
      root: expect.objectContaining({
        path: repoRoot,
        source: 'nearest',
        scope: expect.objectContaining({
          kind: 'standalone',
          ref: {
            mode: 'standalone',
            projectId: PROJECT_ID,
            projectRoot: repoRoot,
          },
          paths: expect.objectContaining({
            'planning-checkout': repoRoot,
            'active-changes': path.join(planningRoot, 'changes'),
            'archive-line': path.join(planningRoot, 'changes', 'archive'),
            specs: path.join(planningRoot, 'specs'),
            'project-design-docs': path.join(planningRoot, 'design-docs'),
          }),
        }),
      }),
    }));
    expect(output).not.toHaveProperty('root.store_id');
  }

  it('keeps list, status, context, and absolute artifacts on the same standalone scope', async () => {
    const changeRoot = path.join(planningRoot, 'changes', CHANGE_ID);
    const proposalPath = path.join(changeRoot, 'proposal.md');
    const specPath = path.join(changeRoot, 'specs', 'discovery', 'spec.md');
    fs.mkdirSync(path.dirname(specPath), { recursive: true });
    fs.writeFileSync(
      proposalPath,
      '## Why\nLocal planning must remain discoverable.\n\n## What Changes\n- Expose the selected scope.\n'
    );
    fs.writeFileSync(
      specPath,
      '## ADDED Requirements\n\n### Requirement: Local planning SHALL be discoverable\nThe system SHALL report the local scope.\n\n#### Scenario: Inspect local planning\n- **WHEN** planning is inspected\n- **THEN** its local paths are reported\n'
    );

    const list = parseJson(await runCLI(['list', '--json'], { cwd: repoRoot, env }));
    const status = parseJson(await runCLI(
      ['status', '--change', CHANGE_ID, '--json'],
      { cwd: planningRoot, env }
    ));
    const context = parseJson(await runCLI(
      ['context', '--json'],
      { cwd: path.join(planningRoot, 'specs'), env }
    ));
    const instructions = parseJson(await runCLI(
      ['instructions', 'proposal', '--change', CHANGE_ID, '--json'],
      { cwd: repoRoot, env }
    ));

    for (const output of [list, status, context, instructions]) {
      expectStandaloneRoot(output);
    }
    for (const output of [status, instructions]) {
      expect(output).toMatchObject({
        changeRoot,
        planningHome: { changesDir: path.join(planningRoot, 'changes') },
        actionContext: {
          planningWriteRoots: [
            path.join(planningRoot, 'specs'),
            path.join(planningRoot, 'changes'),
          ],
        },
      });
    }
    expect(list).toMatchObject({ changes: [{ name: CHANGE_ID }] });
    expect(status).toMatchObject({
      changeRoot,
      evidenceDir: path.join(changeRoot, 'evidence'),
      handoffDir: path.join(changeRoot, 'handoff'),
      artifactPaths: {
        proposal: {
          resolvedOutputPath: proposalPath,
          existingOutputPaths: [proposalPath],
        },
        specs: {
          resolvedOutputPath: path.join(changeRoot, 'specs', '**', '*.md'),
          existingOutputPaths: [specPath],
        },
        design: {
          resolvedOutputPath: path.join(changeRoot, 'design.md'),
          existingOutputPaths: [],
        },
        tasks: {
          resolvedOutputPath: path.join(changeRoot, 'tasks.md'),
          existingOutputPaths: [],
        },
      },
    });
  }, 30_000);

  it('exposes the same list and context locators before any active Change exists', async () => {
    const list = parseJson(await runCLI(['list', '--json'], { cwd: planningRoot, env }));
    const context = parseJson(await runCLI(['context', '--json'], { cwd: repoRoot, env }));

    expectStandaloneRoot(list);
    expectStandaloneRoot(context);
    expect(list).toMatchObject({ changes: [] });
  }, 30_000);

  it('does not adopt a standalone scope when Store metadata cannot be read', async () => {
    fs.writeFileSync(path.join(repoRoot, '.rasen-store'), 'not a directory\n');
    const before = snapshotDirectory(planningRoot);
    const list = parseJson(await runCLI(['list', '--json'], { cwd: repoRoot, env }));
    expect(list).toMatchObject({ root: { path: repoRoot, source: 'nearest' } });
    expect(list).not.toHaveProperty('root.scope');
    expect(snapshotDirectory(planningRoot)).toEqual(before);
  }, 30_000);

  it('keeps an unregistered legacy Store scope-less and refuses archive without writes', async () => {
    await writeStoreMetadataState(repoRoot, { version: 1, id: 'unregistered-context' });
    const changeRoot = path.join(planningRoot, 'changes', CHANGE_ID);
    fs.mkdirSync(changeRoot);
    fs.writeFileSync(
      path.join(changeRoot, 'proposal.md'),
      '## Why\nLegacy planning must not bypass migration.\n\n## What Changes\n- Preserve the Store boundary.\n'
    );
    const before = snapshotDirectory(planningRoot);

    const list = parseJson(await runCLI(['list', '--json'], { cwd: repoRoot, env }));
    expect(list).toMatchObject({
      root: { path: repoRoot, source: 'nearest' },
      changes: [{ name: CHANGE_ID }],
    });
    expect(list).not.toHaveProperty('root.scope');

    const archive = parseJson(await runCLI(
      ['archive', CHANGE_ID, '--json', '--yes'],
      { cwd: repoRoot, env }
    ), 1);
    expect(archive).toMatchObject({
      root: { path: repoRoot, source: 'nearest' },
      archive: null,
      status: [{ severity: 'error', code: 'legacy_flat_store_requires_migration' }],
    });
    expect(archive).not.toHaveProperty('root.scope');
    expect(snapshotDirectory(planningRoot)).toEqual(before);
  }, 30_000);
});
