# PR #189 — capabilities review, round 1

## Findings

### [P1] `doctor` の nearest 検出にも standalone scope を引き渡す

- **ID:** CAP-01
- **Axis:** Spec
- **Canonical severity:** **Blocker** — 明示された必須出力が未実装。データ破損や実行時クラッシュの指摘ではない。
- **Disposition:** ASK / FIXABLE。LEAD が修正担当へ割り当てる。leaf での変更なし。
- **対象差分:** `src/core/root-selection.ts:1059-1063`。呼び出し側: `src/commands/doctor.ts:673`。
- **発火条件:** 正常な `rasen/config.yaml` とローカル `rasen/changes` / `rasen/specs` を持つ、Store 非所属・セレクターなしのプロジェクトで `rasen doctor --json` を使う。active Change の有無は関係しない。
- **失敗経路:** doctor は `--project` がなければ `intent: 'store-read'` を渡す (`src/commands/doctor.ts:655-677`)。`resolveOpenSpecRootThroughPlanning` はこの intent をそのまま `StorePlanning.open` に渡す (`src/core/root-selection.ts:729-741`)。resolver は standalone ref を確定しても `store-read` を `project_scope_required` で拒否する (`src/core/store-planning/internal/resolver.ts:1907-1918`)。そのため追加された standalone adoption 分岐に到達せず、既存 catch → `resolveStandaloneOrLegacyRoot` に戻る (`src/core/root-selection.ts:1079-1096`)。最後の `toRootOutput` は存在しない `planningScope` を補わない (`src/core/root-selection.ts:1127-1133`; doctor の health 出力も `src/core/relationship-health.ts:540-544` で同じ serializer を使用)。
- **影響:** 同じ正常プロジェクトの list/context/status には typed scope が現れる一方、doctor JSON だけは引き続き `root.scope` を持たない。doctor を機械可読の発見・診断入口として使う consumer は、計画ツリーが存在しても scope の分類や typed locations の取得をできない。
- **要求根拠:** `rasen/changes/fix-repo-local-typed-scope-discovery/proposal.md:9` は scope が「present for `list`, `status`, `instructions`, `show`, `validate`, `archive`, `doctor`, and `context` JSON」と明記する。同 Change の `specs/store-planning-scope-routing/spec.md:5` は selector なしの qualifying local planning tree の machine-readable root に resolved standalone scope を必須とする。既存 doctor の欠落を無関係な既存不具合として挙げるのではなく、この PR が修復対象として明示した consumer の未対応として挙げる。
- **修正方針:** doctor のローカル project read と Store aggregate read の intent 選択を既存 scope resolver と整合させ、正常な standalone discovery が authoritative scope を受け取るようにする。Store checkout から selector なしで doctor を使える既存 aggregate 動作、unavailable Store を診断できる carve-out、Store metadata が存在・判読不能のとき scope を採用しない境界は維持する。serializer で scope を合成したり、一般の Store scope エラーを standalone に落としたりしない。
- **回帰ケース:** 新しい isolated repo-local fixture の discovery journey に `doctor --json` を加え、list/context と同じ `standalone` ref と typed paths が返ることを、active Change 有／無で確認する。Store aggregate doctor と unavailable declaration の既存診断も維持する。`test/commands/repo-local-typed-scope.test.ts:116-134,173-178` の現行 positive journey は doctor を呼ばず、`test/commands/doctor.test.ts:170-211,274-307` は診断・read-only 動作を調べるがこの standalone scope 契約を検証していない。
- **検証の区別:** 上記は実ソースと LSP でつないだ決定的な分岐追跡。`rasen doctor --json` の実行結果を観測したとは主張しない。指示どおり実行・テスト・ビルドは行っていない。

## Standards

No findings.

Standards: **0** — Blocker 0 / Major 0 / Minor 0 / Trivial 0。対象 slice で報告する実証済みの regression、権限拡大、データ破損はない。Spec finding をこの軸に重複計上しない。

## Spec

**CAP-01** のみ。proposal が列挙した discovery consumers のうち doctor の intent が追加 handoff と非互換で、要求された scope が欠落する。

Spec: **1** — Blocker 1 / Major 0 / Minor 0 / Trivial 0。軸内の最大 severity: **Blocker**。

## Branch / consumer coverage

以下はソースとテスト本文の対応図であり、今回の runtime coverage やテスト合格率ではない。

```text
resolveOpenSpecRoot — nearest branch (src/core/root-selection.ts:1044-1096)
|
+-- metadata read
|   +-- null -> standaloneMetadataAbsent=true
|   |   [test source] root-selection.test.ts:263-284
|   +-- readable Store declaration / read failure -> adoption disabled
|       [test source] repo-local-typed-scope.test.ts:180-218
|       [ownership] legacy Store classifier internals: Store-guard reviewer
|
+-- planning resolution
|   +-- store-project / store-aggregate -> existing return
|   |   [test source] root-selection.test.ts:787-820,905-941
|   +-- standalone + metadata absent -> compatibility adapter once
|   |   +-- nearest + no storeId + same canonical path -> scoped return
|   |   |   +-- plain nearest source
|   |   |   |   [test source] root-selection.test.ts:263-284
|   |   |   +-- inheritance / project identity -> source stays nearest
|   |   |       [test source] root-selection.test.ts:404-442,955-975
|   |   |       [test source] declared-store-fallback.test.ts:297-338
|   |   +-- compatibility mismatch -> compatibility return
|   |       [not exercised] disagreement guard / native Windows aliases
|   +-- error -> existing Store-fact/compatibility diagnostic handling
|       [test source] root-selection.test.ts:444-501,546-585,905-953
|       [CAP-01] doctor store-read rejects standalone before adoption
|
+-- adopted scope -> consumers
    +-- list: root serialized both with Changes and with []
    |   [test source] repo-local-typed-scope.test.ts:116,144,173-178
    +-- context: working-set root retains scope; no workspace fabricated
    |   [test source] repo-local-typed-scope.test.ts:121-134,173-178
    +-- status / artifact instructions: Change and landing directories
    |   [test source] repo-local-typed-scope.test.ts:117-170
    +-- apply instructions: same landing seam and scope serializer
    |   [test source] artifact-workflow.test.ts:930-959
    +-- show / validate: scope serializer fed by resolved project-read root
    |   [source trace] show.ts:32,68-72; validate.ts:101,316,418,475
    +-- archive: standalone plan identity and execution root stay separate
    |   [source trace] archive.ts:452-465,1401-1468
    +-- doctor: scope-less compatibility root
        [missing behavior] CAP-01
```

この slice の path/authority 追跡根拠:

- `root.path` と `root.source` は compatibility と照合される一方、`root.scope.source` は resolver の evidence のままになる。`project-binding` を `nearest` に塗り替えてはいない (`src/core/root-selection.ts:1064-1073`; `src/core/store-planning/internal/resolver.ts:2043-2059`)。
- standalone の `project-home`, `project-config`, `project-schemas`, `project-work`, `specs`, `project-design-docs`, `active-changes`, `archive-line` は resolver 所有の locations (`src/core/store-planning/internal/resolver.ts:2137-2148,3005-3028`)。`toRootOutput` が扱うのは `PlanningScopeDescription` であり、runtime の `ProjectReadScope` オブジェクトではない (`src/core/root-selection.ts:120-128,1127-1133`; `src/core/store-planning/types.ts:194-204,266-271`)。
- status と両 instructions は同じ `resolvePlanningActionContext` を呼ぶ。planning write roots は `[root.specsDir, root.changesDir]`、execution/ephemera は `resolvedExecutionProjectRoot` から来る (`src/commands/workflow/shared.ts:68-98`; `src/core/root-selection.ts:1271-1290`)。新しい `projectHome` によって readRoots の先頭は `<project>/rasen` になるが、standalone の codeWriteRoots と v1 allowedEditRoots は `<project>` のまま (`src/core/change-status-policy.ts:297-334`)。同じ分岐で constraints の文言も split-root 用になるが、書き込み対象の拡大を示すものではないため独立した不具合として水増ししない。
- planningHome.root は scope の project home を採用するが、Change lookup は `planningHome.changesDir` を使うため、`rasen/rasen` の再構築は起こらない (`src/core/root-selection.ts:1188-1195`; `src/core/planning-home.ts:118-120`; `src/commands/workflow/status.ts:119-123`; `src/commands/workflow/instructions.ts:151-155,461-471`)。

## Review target / evidence / limitations

- **Mode:** rasen-review dispatched、report-only、ONE_SHOT。checklist.md と greptile-triage.md を読み、Standards の両 pass と Spec 軸をこの slice で実施。nested agents、外部 reviewer、product edits、run-state writes は行っていない。
- **Target:** PR #189 / `fix/repo-local-typed-scope`。base `upstream/dev/0.1.8` = `2b2b5c3d370877aecf4f41f1fb2ef6228850d9b1`、head `8ab98e1d9ab242efdd68dac49a4b08a4cea91d06`。`git diff upstream/dev/0.1.8...HEAD` の全 13 files、646 insertions / 23 deletions、raw diff 819 lines を読み、source は現在の実体で追跡した。無関係な dirty `rasen/config.yaml` は対象外で未読・未変更。
- **Read-only commands actually run:** `git branch --show-current` → `fix/repo-local-typed-scope`; `git diff upstream/dev/0.1.8...HEAD` → 上記 diff; `gh pr view 189 --repo DumoeDss/rasen --json body,baseRefName,headRefOid` と `pr://DumoeDss/rasen/189?comments=0` → PR の target/body 確認。Greptile の pull-review comments と issue comments の GET はどちらも該当コメント 0 件。Git fetch、validation commands、CLI behavior runs、build、tests、lint、formatter は実行していない。
- **Semantic evidence:** `resolveOpenSpecRoot`, `resolveRootForCommand`, `planningScope`, `scope`, `schemasDir`, `configPath`, `toPlanningHome`, `toRootOutput`, `archivePlanScope` に LSP references/definitions を使用。graph の `resolveOpenSpecRoot` 両方向 depth 2 と action-context 両方向 depth 1 をたどり、該当ソースを読んだ。graph に古い `src/cli.ts` が残っていた箇所は LSP の実在 `src/cli/index.ts` で補った。
- **Graph limits:** project `Users-pashifika-Work-pashifika.github-ghostty-rasen` の root/head/branch を list_projects / index_status で確認。generation `2026-09-06T04:07:19Z`, fast index。検索 pagination は `has_more:false`、trace も未取得ページなし。evidence paths と scoped test/workflow paths に `check_index_coverage` を実施。`root-selection.ts` / `archive.ts` は `metadata_changed`、test files は excluded / not_tracked、`rasen/` は excluded なので graph 行番号・欠落を完全性証拠にせず直接 read した。他の主要 consumer は metadata_match だが、これも完全性の保証ではない。
- **Runtime limits:** 親から共有された 353/16 pass と lifecycle smoke は既存 evidence であり、この reviewer が再実行した証拠ではない。native Windows/POSIX CI の task 3.4 は未完のまま。Windows alias/drive/separator variant の test-contract 判定は Store-guard reviewer に共有済みで、この report に重複 finding を作っていない。legacy Store classifier internals と broad test/spec coverage は sibling の担当。
