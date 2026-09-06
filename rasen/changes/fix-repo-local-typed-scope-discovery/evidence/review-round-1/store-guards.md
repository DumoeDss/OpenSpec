## Standards

### [P1] fixture 起動前にホストの Git／Session 環境を除去してください

- **ID:** SG-001
- **Canonical severity:** Major
- **分類:** ASK（報告のみ。修正・書込みコマンドの再現は未実施）
- **最小位置:** `test/commands/repo-local-typed-scope.test.ts:59-69`、特に `:61`。
- **トリガー:** テストを起動したプロセスに、別 checkout を指す絶対 `GIT_DIR`／`GIT_WORK_TREE`、または `RASEN_SESSION_CONTEXT` が存在する。
- **機構と影響:** 新しい fixture は `env: { ...process.env, ...env }` を使って実際の `git init` と `git commit --allow-empty` を起動する。`isolatedGitEnv()` は Git config と作者情報を上書きするだけで、Git の repository locator を消さない（`test/helpers/store-git.ts:32-49`）。したがって `cwd: checkout` は隔離境界にならず、fixture 用の commit がホスト側の repository に向かい、既存の staged 内容まで commit し得る。これは fixture 外を変更しないという `tasks.md:23` の制約に反する。
- **同じ境界のもう一つの欠落:** `runCLI()` 自身も `process.env` を再マージする（`test/helpers/run-cli.ts:188-199`）。`RASEN_SESSION_CONTEXT` は fixture の HOME/XDG 指定とは独立した絶対ファイルポインタであり、そのまま `StorePlanning` に入る（`src/core/store-planning/internal/dependencies.ts:285` → `src/core/store-planning/internal/resolver.ts:755-783`）。fixture 外の session ファイルを読み、nearest-discovery の scope-positive ケースを session conflict／scope-less fallback に変えてしまう。`vitest.setup.ts:42-74` と `test/setup-reset-diagnostics.ts:1-12` にもこれらの除去はない。`tasks.md:6` の「no inherited `RASEN_*` variables」は現状では満たされていない。
- **非破壊の確認:** `cwd=/private/tmp`、`GIT_DIR=/Users/pashifika/Work/pashifika.github/rasen/.git`、`GIT_WORK_TREE=/Users/pashifika/Work/pashifika.github/rasen` を指定して `git rev-parse --show-toplevel` を実行した。exit 0、出力は `/Users/pashifika/Work/pashifika.github/rasen`。Git が fixture 側 cwd より環境 locator を優先することを確認した。`git init`／`git commit` は実行していないため、実際のホスト変更を観測したという主張ではない。
- **最小修正の不変条件:** fixture 用 subprocess を作る前に ambient `GIT_*`／`RASEN_*` を保存・除去し、既存の `isolatedGitEnv` と明示的な fixture 設定だけを再導入して終了時に復元する。単に filtered object を `runCLI({ env })` に渡すだけでは、同 helper が親環境を再マージするため不十分。Windows の環境変数名の大文字小文字も考慮する。
- **回帰確認案:** 別の一時 sentinel repository と session ファイルを環境から渡して同 fixture を起動し、sentinel の HEAD/index が不変、fixture の product/planning Git roots が各 fixture ディレクトリ、CLI の standalone scope が fixture 内を指すことを確認する。実ユーザーの repository を再現用に使わない。

## Spec

### [P2] Windows の別表記を nearest handoff 経由で検証してください

- **ID:** SG-002
- **Canonical severity:** Minor
- **分類:** AUTO-FIX 候補（dispatched のためテスト追加・実行は未実施）
- **最小位置:** `test/core/root-selection.test.ts:263-284`、`test/commands/repo-local-typed-scope.test.ts:119-132`。
- **要求:** Change spec `rasen/changes/fix-repo-local-typed-scope-discovery/specs/store-planning-scope-routing/spec.md:43-47` は drive-letter case、separator form、canonical filesystem spelling が異なっても同一 standalone scope を返すことを要求する。`test/AGENTS.md:19-30` も path identity を変更するときの alias regression を要求している。
- **確認した欠落:** 追加・更新された二つの suite は canonicalized temp root と `path.join` した通常の開始パスだけを使う。同じ root に対する drive-letter case／slash 変換／symlink・junction alias を渡して scope を比較するケースはない。既存の StorePlanning alias ケース（例: `test/core/store-planning/store-planning.test.ts:876-925`）は registry conflict／resolver 内部の別 seam で、新しい `resolveOpenSpecRoot` の compatibility-path 一致判定を通らない。
- **守るべき行動:** `src/core/root-selection.ts:1064-1075` では二つの resolver の path identity が食い違うだけで成功応答のまま scope-less compatibility root に戻る。別表記で canonicalization が食い違うという実在し得る回帰を、通常の native spelling だけのケースでは検出できない。影響は Windows／alias 経由の利用者にだけ `root.scope` が再び欠けることであり、default-field snapshot の不足ではない。
- **タスク未実行との区別:** `tasks.md:22` の task 3.4 が未チェックなのは正直な記録で、未実行それ自体を欠陥として報告していない。ただし現状の二 suite を Windows CI で実行しても、上記別表記の要求は検証されない。これは実装の Windows 障害を再現したとの主張ではなく、要求された振る舞いの回帰ケースが欠けているという finding。
- **最小修正／回帰確認案:** core の nearest-root ケースに同じ実在 root の native spelling と symlink/junction alias を追加し、Windows では drive-letter case と separator form も変える。各結果に standalone scope が存在し、scope の ref と typed path が同じ canonical locations を指すことを比較する。期待値の大文字小文字を Windows 専用文字列へ書き換えず、native CI の run id/head SHA を task 3.4 に記録する。

## Coverage diagram

`[T]` はテストコードの存在と行動 assertion を直接確認した意味で、このレビューでの実行成功を意味しない。`[S]` はソース追跡のみ。`[GAP]` は上の actionable finding に対応する。

```text
Store admission / nearest discovery
├─ explicit --store / --project / --target-line          [T: 既存、今回の編集外]
│  ├─ selected legacy Store → archive refusal/no writes  store-root-selection.test.ts:379-407
│  ├─ explicit standalone --project                     root-selection.test.ts:719-741
│  └─ Store v2 project dimensions                       root-selection.test.ts:787-805
├─ nearest metadata read                               root-selection.ts:1044-1056
│  ├─ layoutVersion=2 → existing planning path           [S + 既存 Store v2 journey]
│  ├─ readable legacy metadata → no adoption             [T★★★] repo-local-typed-scope.test.ts:190-218
│  ├─ ENOTDIR → false remains → no adoption/no writes    [T★★★] repo-local-typed-scope.test.ts:181-188
│  ├─ malformed YAML/read failure → false remains        [S] foundation.ts:866-877
│  │                                                     archive.ts:445-448 / layout-write-guard.ts:183-194
│  └─ positively absent (null) → planning resolution     root-selection.ts:1049,1062
│     ├─ store-project/store-aggregate → return scoped    [T: 既存] root-selection.test.ts:904-950
│     └─ standalone → compatibility adapter             root-selection.ts:1063-1075
│        ├─ nearest + no storeId + same path → adopt      [T★★] root-selection.test.ts:263-284
│        ├─ inheritance → nearest + one notice           [T★★★] root-selection.test.ts:404-440
│        │                                               declared-store-fallback.test.ts:297-332
│        ├─ configured projectId retained                [T★★] root-selection.test.ts:954-974
│        ├─ path/source/Store identity disagreement      [S] compatibility result retained
│        └─ Windows/alias spellings of same root          [GAP] SG-002
├─ planning failure → existing compatibility diagnostic [T★★★] root-selection.test.ts:444-497,547-568,929-950
└─ no nearest → implicit/no-root compatibility           [T: 既存] root-selection.test.ts:306-344

Archive consumers
├─ ArchiveCommand.execute → storeFinalizationDiagnostic archive.ts:696,728-750
│  ├─ legacy-store scope → migration refusal             [S] archive.ts:428-433
│  ├─ standalone scope → bypass Store classifier         [T★★★] existing standalone archive consumer flow
│  │                                                     archive-consumer-integration.test.ts:351-381
│  ├─ scope absent → root metadata classification        [T★★★] unregistered/selected/declared legacy refusal
│  │                                                     repo-local-typed-scope.test.ts:190-218
│  │                                                     declared-store-fallback.test.ts:145-177
│  └─ Store v2 project → outcome/finalization admission   [T: 既存] store-v2-planning-scope-journey.test.ts:523-
├─ archivePlanScope → standalone + optional projectId    [S] archive.ts:452-466,1435
│  └─ actual apply path still createArchivePlan/engine    archive.ts:1460-1470
└─ --apply-plan / --abort-plan consume saved plan         [S: 今回の編集外] archive.ts:652-659,941-1070
   └─ generated single/bulk/in-ship parity/evidence       [T★★★] archive-consumer-integration.test.ts:279-381

CLI user flow / fixture boundary
├─ product root / planning Git root / nested specs cwd
│  └─ list/status/instructions/context + typed artifacts [T★★★] repo-local-typed-scope.test.ts:103-169
├─ no active Change → list/context still carry scope    [T★★] repo-local-typed-scope.test.ts:171-179
├─ legacy Store refusal preserves planning bytes        [T★★★] repo-local-typed-scope.test.ts:190-218
└─ ambient Git/session locators cannot escape fixture   [GAP] SG-001
```

ENOTDIR の新ケースは **list に scope を付けないこと** を証明する形であり、ENOTDIR に対する archive refusal の実行証拠ではない。実在する malformed metadata file は `stat().isFile()` を通った後に legacy-flat として拒否される経路をソースで確認した。これらを同じ実行済み証拠として扱っていない。

## Review target and evidence

- PR #189。対象は `git diff upstream/dev/0.1.8...HEAD`。全 diff（13 files、646 insertions、23 deletions）を読み、上記 slice の周辺実装を追跡した。
- Base: `2b2b5c3d370877aecf4f41f1fb2ef6228850d9b1` (`upstream/dev/0.1.8`)。Head: `8ab98e1d9ab242efdd68dac49a4b08a4cea91d06`。`gh pr view 189 --repo DumoeDss/rasen --json title,body,baseRefName,headRefName,baseRefOid,headRefOid` の値も一致した。
- `AGENTS.md`、`test/AGENTS.md`、dispatched `rasen-review`、同 skill の `checklist.md`／`greptile-triage.md` を適用。Standards の安全性／状態遷移と情報的検査、Spec の要求／task の二軸を実施した。read-only のため AUTO-FIX、質問、nested agent、外部 reviewer process は使用していない。
- Greptile の PR review-comments と issue-comments の双方を `gh api --paginate` で確認し、該当 bot comment は 0 件。
- `sha256sum src/core/archive.ts src/core/root-selection.ts test/commands/repo-local-typed-scope.test.ts test/core/root-selection.test.ts test/commands/declared-store-fallback.test.ts` を実行。5 ファイルすべてが既存 `evidence/verification-report.md` の fingerprint と一致した。これは既存証拠とソース状態の一致であり、同報告の 353/16 pass、tsc/eslint、lifecycle smoke をこの reviewer が再実行したという意味ではない。
- LSP: `storeFinalizationDiagnostic` は declaration と `ArchiveCommand.execute:740` の 2 occurrences。`archivePlanScope` は declaration と plan construction `:1435` の 2 occurrences。`resolveOpenSpecRoot` は 53 occurrences を確認し、production の archive 経路と compatibility wrapper、対象 tests を区別した。一般の context/actionContext consumer semantics は sibling 担当のため重複評価していない。
- Graph Verify tier: project `Users-pashifika-Work-pashifika.github-ghostty-rasen`、root は対象 repository、generation `2026-09-06T04:07:19Z`、fast index。初期 `list_projects`／`index_status` を確認し、検索・trace の pagination は終了まで確認。`root-selection.ts`／`archive.ts` は `metadata_changed` のため現ソースを直接読んだ。関連 resolver/foundation/helper は `metadata_match`。tests と Change artifacts は excluded/not_tracked が多く、関連 scope と引用 path に `check_index_coverage` を実施して直接読みへフォールバックした。graph coverage は best-effort であり、完全性の証明に使っていない。

## Limitations

- 指示どおり build、test、lint、formatter、実 archive/spec sync、Git init/commit、製品編集を行っていない。実行した追加の挙動確認は SG-001 の read-only Git locator probe のみ。
- Windows の実動作、POSIX/Windows CI の pass、task 3.4 の完了はこのレビューでは未確認。SG-002 は CI 待ちとは別の、入力 variant が不足している問題。
- 新しい malformed-file／EACCES archive ケースを実行していない。古い `.openspec-store/store.yaml` fallback は `foundation.ts:214-222` と既存 metadata helper tests を確認したが、この round で CLI 実行証拠を追加していない。
- 既存 lifecycle smoke の throwaway scripts は削除済みとの記録であり、その実行記録を独立に再現したとは扱っていない。
- 無関係な `rasen/config.yaml`、Ghostty、PR #188、グローバル install、run-state は対象外で、変更していない。書込みはこの slice 専用 report のみ。

**Standards:** 1 finding — Major 1（worst: Major）。**Spec:** 1 finding — Minor 1（worst: Minor）。**Unique total:** 2 — Blocker 0 / Major 1 / Minor 1 / Trivial 0。SG-001 の task 違反は Standards finding 内に引用し、Spec 側で重複カウントしていない。
