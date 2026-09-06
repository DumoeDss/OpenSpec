# SG round-1 fix report

## 状態と変更範囲

**DONE（担当差分の実装完了。SG-001／SG-002 の独立判定は未実施）**

変更したファイルは次の3つのみ。

- `test/commands/repo-local-typed-scope.test.ts`
- `test/core/root-selection.test.ts`
- `rasen/changes/fix-repo-local-typed-scope-discovery/evidence/fix-report-sg-r1.md`

production、共有 helper、doctor production/tests、Change design/tasks、過去の review/verification evidence、`rasen/config.yaml` は変更していない。追加の所有範囲は不要だった。build、test、lint、formatter、Git 操作、CLI 実行、commit/push、run-state 書込みは実行していない。以下の検証手順も**未実行**で、実行と独立 delta re-review は LEAD が担当する。

## SG-001: fixture 起動境界

- 両 suite の最初の `beforeEach` 処理で、ambient `GIT_*`／`RASEN_*` を大文字小文字を区別せず検出し、`vi.stubEnv(name, undefined)` で親の `process.env` から除去する。fixture の最初の Git subprocess より前に行うため、`runCLI()` による `process.env` の再マージからも再侵入しない。
- Windows では stub 名を大文字に統一する。大文字小文字を区別しない `process.env` に対して、元の `rasen_home` と明示的な `RASEN_HOME` を別々の復元エントリーにしてしまう問題を避ける。リポジトリの Vitest は `pool: 'forks'` を使用している。
- `isolatedGitEnv()` と明示的な fixture HOME/XDG/locale 設定は維持した。root-selection suite の手動 `XDG_DATA_HOME` 保存・復元も既存の `vi.stubEnv`／`vi.unstubAllEnvs` に統一した。
- `afterEach` はディレクトリ削除より先に `vi.unstubAllEnvs()` を呼ぶ。削除が失敗しても、環境復元を飛ばさない。
- CLI fixture の product/planning 両 Git root と、core suite の実 Git/worktree fixture に `git rev-parse --show-toplevel` の canonical identity assertion を追加した。`git init` の直後、`git add`／`git commit` より前に、Git が当該一時 checkout を選んでいることを確認する。これは Git repository locator の実挙動に対する境界 assertion であり、env object の形や helper の配線を検査するものではない。

## SG-002: nearest handoff の alias regression

`resolveOpenSpecRoot` に同じ実在 planning tree の native start path と symlink/junction alias を入力する named object case table を追加した。

- 全 platform: directory symlink。Windows では権限昇格不要の junction を使う。
- Windows: alias の drive-letter case を反転するケースと、backslash を forward slash に変えるケースを個別に追加する。drive-letter ケースは drive-qualified temp path を要求し、UNC path で変換が空振りしても成功扱いにしない。
- native/alias の両結果について、nearest source、standalone description、standalone ref を持つ project-read capability を検査する。
- `scope.locate()` が返す active Changes、archive line、specs、design-docs を既知の実在 fixture directory と `fs.realpathSync.native()` で比較する。absolute/native-normalized path であることと、公開 description の locator が capability と一致することも確認する。
- 両 capability で実在する同じ Change を `openChange()` し、同一 canonical directory を指すことを確認する。

scope の description だけが残り、本物の `root.scope` が失われる回帰、compatibility-path 不一致で alias 側だけ scope-less になる回帰、別の planning tree を指す回帰を区別できる。任意の drive-letter 大文字小文字や alias の入力文字列そのものを期待値に固定していない。CLI suite の既存 list/status/instructions/context parity は維持し、同じ alias matrix を CLI に重複追加していない。

## LEAD 用: 安全な sentinel repository poisoning 検証

**この手順は未実行。統合後の LEAD 検証としてのみ実行する。** 実 checkout や実ユーザー repository を `GIT_DIR`／`GIT_WORK_TREE` に指定しない。次の script は新規 OS temp sandbox 内にだけ sentinel repository、staged payload、別 project の有効な v2 session-context fixture を作る。テスト自身の temp directories も sandbox 内に置く。

`check-sg-isolation.mjs` を product repository 外の一時ディレクトリへ保存し、例えばこの checkout では次を実行する。

```sh
node /private/tmp/check-sg-isolation.mjs /Users/pashifika/Work/pashifika.github/rasen
```

Windows では同じ script にその machine の checkout の絶対パスを渡し、drive-qualified な `TEMP` を使う。グローバル install は不要。ローカルの Vitest 3.2.6 を使う。既存 `vitest.setup.ts` の build-freshness check は維持するため、この実行を LEAD の統合検証へ組み込み、fixer 側で別実行しない。

```js
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

assert(process.argv[2] && path.isAbsolute(process.argv[2]), 'Pass the absolute product checkout');
const repo = fs.realpathSync.native(process.argv[2]);
const vitest = path.join(repo, 'node_modules', 'vitest', 'vitest.mjs');
assert(fs.existsSync(vitest), 'Use the checkout with its local dependencies installed');
const sandbox = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'rasen-sg-r1-')));
const sentinel = path.join(sandbox, 'sentinel');
const home = path.join(sandbox, 'home');
const hooks = path.join(sandbox, 'empty-hooks');
const templates = path.join(sandbox, 'empty-templates');
for (const directory of [sentinel, home, hooks, templates]) fs.mkdirSync(directory);
const gitconfig = path.join(sandbox, 'gitconfig');
fs.writeFileSync(gitconfig, '');

// Never inherit a repository locator, Git config override, or session selector
// into the driver Git commands or the Vitest launcher. Normalize Windows keys
// before adding explicit values so spawn cannot choose an older case alias.
const cleanEnv = Object.fromEntries(Object.entries(process.env)
  .filter(([key]) => !/^(GIT_|RASEN_)/i.test(key))
  .map(([key, value]) => [process.platform === 'win32' ? key.toUpperCase() : key, value]));
delete cleanEnv.VITEST_FILE_PARTITION;
Object.assign(cleanEnv, {
  HOME: home,
  USERPROFILE: home,
  XDG_CONFIG_HOME: path.join(sandbox, 'config'),
  XDG_DATA_HOME: path.join(sandbox, 'data'),
  TMPDIR: sandbox,
  TMP: sandbox,
  TEMP: sandbox,
  RASEN_HOME: path.join(sandbox, 'machine'),
  RASEN_LANG: 'en',
  RASEN_TELEMETRY: '0',
  OPEN_SPEC_INTERACTIVE: '0',
  GIT_CONFIG_GLOBAL: gitconfig,
  GIT_CONFIG_SYSTEM: gitconfig,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'SG Sentinel',
  GIT_AUTHOR_EMAIL: 'sentinel@example.invalid',
  GIT_COMMITTER_NAME: 'SG Sentinel',
  GIT_COMMITTER_EMAIL: 'sentinel@example.invalid',
});
const git = (...args) => execFileSync('git', [
  '-c', `core.hooksPath=${hooks}`,
  '-c', `init.templateDir=${templates}`,
  '-c', 'commit.gpgsign=false',
  '-c', 'gc.auto=0',
  '-c', 'maintenance.auto=false',
  ...args,
], { cwd: sentinel, env: cleanEnv, encoding: 'utf8', windowsHide: true }).trim();

git('init', '--initial-branch=main');
assert.equal(fs.realpathSync.native(git('rev-parse', '--show-toplevel')), sentinel);
fs.writeFileSync(path.join(sentinel, 'committed.txt'), 'Sentinel baseline\n');
git('add', '--', 'committed.txt');
git('commit', '-m', 'Sentinel baseline');
fs.writeFileSync(path.join(sentinel, 'staged.txt'), 'Must remain staged, never committed by a fixture\n');
git('add', '--', 'staged.txt');
fs.mkdirSync(path.join(sentinel, 'rasen', 'specs'), { recursive: true });
fs.mkdirSync(path.join(sentinel, 'rasen', 'changes', 'archive'), { recursive: true });
fs.writeFileSync(path.join(sentinel, 'rasen', 'config.yaml'),
  'schema: spec-driven\nprojectId: sentinel-only\n');
const sessionFile = path.join(sandbox, 'foreign-session.json');
fs.writeFileSync(sessionFile, JSON.stringify({
  version: 2,
  sessionId: 'sg-sentinel-session',
  planning: { type: 'project', projectId: 'sentinel-only', root: sentinel },
  execution: { kind: 'planning-only' },
}) + '\n');

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
function treeFingerprint(root) {
  const entries = {};
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isDirectory()) {
        entries[relative] = 'directory';
        visit(absolute);
      } else if (entry.isSymbolicLink()) {
        entries[relative] = `symlink:${fs.readlinkSync(absolute)}`;
      } else {
        entries[relative] = digest(fs.readFileSync(absolute));
      }
    }
  };
  visit(root);
  return entries;
}
const before = {
  head: git('rev-parse', 'HEAD'),
  index: digest(fs.readFileSync(path.join(sentinel, '.git', 'index'))),
  tree: treeFingerprint(sentinel),
  session: digest(fs.readFileSync(sessionFile)),
};
const poison = {
  GIT_DIR: path.join(sentinel, '.git'),
  GIT_WORK_TREE: sentinel,
  GIT_COMMON_DIR: path.join(sentinel, '.git'),
  GIT_INDEX_FILE: path.join(sentinel, '.git', 'index'),
  GIT_OBJECT_DIRECTORY: path.join(sentinel, '.git', 'objects'),
  RASEN_SESSION_CONTEXT: sessionFile,
  RASEN_HOME: path.join(sandbox, 'ambient-machine'),
  RASEN_LANG: 'ja',
};
const setupFile = path.join(sandbox, 'poison.setup.ts');
fs.writeFileSync(setupFile, `
import { afterEach, beforeEach, expect } from ${JSON.stringify(path.join(repo, 'node_modules', 'vitest', 'dist', 'index.js'))};
const poison = ${JSON.stringify(poison)};
const normalize = (key) => process.platform === 'win32' ? key.toUpperCase() : key;
const snapshot = () => Object.fromEntries(Object.entries(process.env).map(([key, value]) => [normalize(key), value]));
let saved;
let expected;
beforeEach(() => {
  saved = { ...process.env };
  for (const [key, value] of Object.entries(poison)) {
    for (const existing of Object.keys(process.env)) {
      if (normalize(existing) === key) delete process.env[existing];
    }
    // Lowercase names on Windows deliberately exercise case-insensitive lookup
    // and the RASEN_HOME/RASEN_LANG stub restoration collision.
    process.env[process.platform === 'win32' ? key.toLowerCase() : key] = value;
  }
  expected = snapshot();
});
afterEach(() => {
  try {
    // The suite's afterEach has already run: compare the complete environment,
    // not merely that GIT_DIR is absent during one subprocess.
    expect(snapshot()).toEqual(expected);
  } finally {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
`);
const configFile = path.join(sandbox, 'vitest.config.ts');
const files = [
  'test/commands/repo-local-typed-scope.test.ts',
  'test/core/root-selection.test.ts',
];
fs.writeFileSync(configFile, `
import base from ${JSON.stringify(path.join(repo, 'vitest.config.ts'))};
export default {
  ...base,
  test: {
    ...base.test,
    include: ${JSON.stringify(files)},
    globalSetup: ${JSON.stringify(path.join(repo, 'vitest.setup.ts'))},
    setupFiles: ${JSON.stringify([path.join(repo, 'test', 'setup-reset-diagnostics.ts'), setupFile])},
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    sequence: { hooks: 'stack', setupFiles: 'list' },
  },
};
`);

let passed = false;
try {
  const result = spawnSync(process.execPath,
    [vitest, 'run', ...files, '--config', configFile, '--root', repo],
    { cwd: repo, env: cleanEnv, stdio: 'inherit', windowsHide: true });
  assert.deepEqual(treeFingerprint(sentinel), before.tree, 'Sentinel repository bytes changed');
  assert.equal(git('rev-parse', 'HEAD'), before.head, 'Sentinel HEAD changed');
  assert.equal(digest(fs.readFileSync(path.join(sentinel, '.git', 'index'))), before.index,
    'Sentinel index changed');
  assert.equal(digest(fs.readFileSync(sessionFile)), before.session, 'Foreign session bytes changed');
  assert.ifError(result.error);
  assert.equal(result.status, 0, `Vitest failed: status=${result.status}, signal=${result.signal}`);
  console.log('SG sentinel HEAD/index/tree/session unchanged; fixture scopes and environment restoration passed');
  passed = true;
} finally {
  if (passed) fs.rmSync(sandbox, { recursive: true, force: true });
  else console.error(`Validation files retained at ${sandbox}`);
}
```

### 合格として記録する証拠

- 対象2 suite の結果。Windows では drive-letter と forward-slash の名前付きケースも実行されていること。
- product/planning/worktree fixture の Git-root assertions、既存 CLI scope/artifact assertions、新規 capability/openChange assertions の成功。
- 各 test 終了後の環境全体の復元比較の成功。Windows の環境 key は意味に従い case-insensitive に比較する。
- sentinel HEAD、staged index、repository tree、別 session file の不変性。script の成功ログを保存する。失敗時は sandbox を保持し、実 repository を使う再現へ切り替えない。
- platform、head SHA、実行コマンド、結果を LEAD 側の新しい検証証拠へ記録する。本 report／過去の review evidence を実行済みへ書き換えない。

script 保存先は実行証拠を確保した後に削除する。Windows/CI の成功、task 3.4 の完了、独立 reviewer の finding close はこの fixer からは主張しない。

## 根拠と限界

Graph Verify tier: `Users-pashifika-Work-pashifika.github-ghostty-rasen`、generation `2026-09-06T04:07:19Z`。exact symbol search、nearest handoff の outbound trace、関連 path の coverage 確認を行った。tests／Change artifacts は excluded/not_tracked、`root-selection.ts` は metadata_changed のため現ソースを直接参照した。graph coverage を完全性の証拠にしていない。

LSP で `resolveOpenSpecRoot`、`samePathForPlatform`、`ResolvedOpenSpecRoot`、scope locator、`RuntimeContextSchema` と project-read capability の定義・参照を確認した。公開 symbol は変更していない。`openChange` は LSP の interface implementation lookup では出ず、`ProjectReadScope` references が示した `internal/resolver.ts:2399-2485` を読んだ。Vitest の環境 API は [vi.stubEnv / vi.unstubAllEnvs](https://vitest.dev/api/vi.html#vi-stubenv)、検証用 hook の順序は [sequence.hooks](https://vitest.dev/config/sequence.html#sequence-hooks) を参照した。

実行検証コマンド: **なし（dispatch 指示により LEAD へ集約）**。macOS/Windows の runtime 成功は未確認。

## Durable discoveries

1. `runCLI()` は渡された env object の前に `process.env` を再マージする。suite の親プロセスから locator/session selector を除去しない限り、filtered object だけでは隔離できない。
2. Windows の case-insensitive environment と Vitest の名前別 restoration tracking を併用すると、同じ論理 key を異なる spelling で stub しないことが重要になる。明示的に再設定する `RASEN_HOME`／`RASEN_LANG` と除去側の stub 名を統一する。
3. nearest handoff が守るものは公開 `planningScope.kind: 'standalone'` だけではない。実際の capability は `scope.kind: 'project'` と standalone ref を持ち、`locate()`／`openChange()` による同一 planning tree へのアクセスも維持する必要がある。
