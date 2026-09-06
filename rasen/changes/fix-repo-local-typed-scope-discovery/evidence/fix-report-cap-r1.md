# CAP-01 — round-1 fixer report

## 状態

**DONE — 修正コード・consumer 回帰ケース・design/tasks の追記を提出。検証と CAP-01 の閉鎖判定は LEAD / 独立 delta reviewer 待ち。**

この fixer は build、test、lint、formatter、CLI smoke を実行していない。以下は適用内容とソース追跡の記録であり、pass または finding resolved の自己認定ではない。

## 変更ファイル

| ファイル | 変更内容 |
| --- | --- |
| `src/core/root-selection.ts:1059` | nearest 分岐に限定した read-capability handoff。既存の standalone 採用ガードを共有する。 |
| `src/commands/doctor.ts:666` | コメントのみ修正。read-only でも standalone project-read capability が必要になることを記述し、既存の Store-first intent 選択は変更しない。 |
| `test/commands/doctor.test.ts:52` | `exposes authoritative standalone scope without an active Change` を追加。built CLI の実 consumer seam を使う。 |
| `rasen/changes/fix-repo-local-typed-scope-discovery/design.md:78` | CAP-01 の原因、限定 handoff、維持する境界、追加 resolver open の理由、未実行検証を追記。 |
| `rasen/changes/fix-repo-local-typed-scope-discovery/tasks.md:32` | CAP-01 実装・test-source 完了と、LEAD 検証・独立再レビュー未完を区別して追記。 |
| `rasen/changes/fix-repo-local-typed-scope-discovery/evidence/fix-report-cap-r1.md` | 本報告。 |

`test/commands/repo-local-typed-scope.test.ts` と `test/core/root-selection.test.ts` は sibling 所有のため未変更。`rasen/config.yaml`、proposal の doctor promise、delta spec、既存 review/verification evidence、canonical specs は未変更。Git 操作、archive、spec sync、run-state writes、Ghostty アクセス、global install は行っていない。

## 原因と handoff

LEAD が提示した built CLI の結果は、`doctor --json` が exit 0、`root.healthy: true`、`root.source: nearest` なのに `root.scope` がないというもの。この再現を再実行していない。

ソースでは doctor が `--project` のない呼び出しを `store-read` として開く。一方 `StorePlanningResolver.resolve` は standalone ref に対する `store-read` を `project_scope_required` / `target: intent` で拒否する (`src/core/store-planning/internal/resolver.ts:1907`)。元の nearest handoff が受け取る positive standalone answer に到達せず、compatibility root に戻っていた。serializer や path builder の欠落ではない。

適用した変更は次の分岐だけを追加する。

1. 従来どおり最初に要求された intent を開く。doctor の `store-read` 優先、Store aggregate の早期 return、explicit selector branches は変更しない。
2. nearest 分岐の既存 metadata read が **`null` を返した場合のみ**、かつ失敗が **`RootSelectionError` / `project_scope_required` / `target: intent` の場合のみ**、同じ options/start path を使って既存の `project-read` resolver を開く。
3. **positive standalone answer だけ**を候補として返す。project read が失敗した場合や Store kind を返した場合は、**最初の診断を再 throw** し、元の compatibility/error handling を維持する。
4. 候補を既存の standalone adoption guard に通す。compatibility 側の `source: nearest`、`storeId` 不在、`samePathForPlatform` による root 一致が必要であり、notices/diagnostics は既存 adapter に任せる。
5. 採用時は resolver 所有の capability、description、ref、typed paths を使い、compatibility の `source` だけを維持する。scope や path を doctor/serializer で組み立てない。

`resolveOpenSpecRootThroughPlanning`、`StorePlanning` の公開 API、`PlanningIntent`、metadata classifier、serializer は変更していない。readable / unreadable Store metadata、その他の resolver error、Store project の回答を standalone に変換する経路は追加していない。

## Consumer 回帰ケース

新ケースは `createOpenSpecRoot` と既存の `runCLI` を使用する。登録されていない standalone project の `rasen/specs` を cwd にし、active Change がないことを `list --json` の `changes: []` で確認してから doctor を呼ぶ。`RASEN_SESSION_CONTEXT` は空にして、ambient frozen session が fixture の nearest discovery を置き換えないようにする。新ケースに Git mutation はない。

assertion は以下の観測可能な契約を対象とする。

- doctor が exit 0 の healthy nearest root を報告する。
- `root.scope` は `standalone` / `project-read` / `nearest-standalone` で、fixture の standalone ref を含む。
- `planning-checkout`、`project-home`、`project-config`、`project-schemas`、`project-work`、`specs`、`project-design-docs`、`active-changes`、`archive-line` が fixture 内の native paths を指す。
- doctor と list の ref / typed paths が一致し、Store identity を捏造しない。

期待 path は canonicalized temporary root と `path.join` で構成する。既存の doctor unavailable-declaration、malformed-pointer、legacy Store、read-only ケースは変更していない。Store aggregate の preservation seam は既存の `test/commands/store-migration-cli.test.ts` にある ambient MIGRATED Store case と、`test/commands/store-v2-planning-scope-journey.test.ts` の explicit aggregate case。

## ソース追跡と影響境界

- LSP `registerDoctorCommand` references: declaration、`src/cli/index.ts` の import / registration の 3 occurrences。
- LSP `resolveOpenSpecRoot` references: 53 occurrences。production は `resolveRootForCommand` と archive の呼び出しを確認。公開 signature は変更しないため caller migration は不要。
- LSP command-intent references: doctor の selector-free Store intent と context の explicit-Store-only intent を確認。context は既存 explicit branch を通るため、この nearest-only handoff を使わない。
- `StorePlanning` の公開 read API は `open(store-read)` と `open(project-read)` の strict capabilities。classification-only API を新設せず、root adapter に Store/session/binding 判定を複製しない。
- `gatherRelationshipData` は従来の root path を inspect し、health serializer への description handoff は既存のものを使う。
- Graph Verify tier: project `Users-pashifika-Work-pashifika.github-ghostty-rasen`、generation `2026-09-06T04:07:19Z`。search / trace pagination は終了。`root-selection.ts` の metadata_changed、tests / Change artifacts の excluded を確認して現ソースを直接 read。graph の古い CLI ノードは LSP の `src/cli/index.ts` で補った。coverage は完全性の証拠として扱わない。

## LEAD 向けの提案検証コマンド — 未実行

以下は integration 後に実行する候補。build は LEAD の統合 build を一度だけ使用する。既存 doctor suite には ambient Git 環境を引き継ぐ Git mutation ケースもあるため、ホストの `GIT_*` / selection-related `RASEN_*` locators を除去した検証プロセスで実行し、poisoned-environment 実験をこの全 suite に向けない。

```sh
RASEN_LANG=en pnpm run build:if-stale
RASEN_LANG=en pnpm exec vitest run test/commands/doctor.test.ts test/core/root-selection.test.ts test/commands/declared-store-fallback.test.ts test/commands/store-migration-cli.test.ts test/commands/store-v2-planning-scope-journey.test.ts
```

CAP-01 consumer だけを切り出す場合の正確な command（上の bounded run に含まれるので、通常は重複実行不要）:

```sh
RASEN_LANG=en pnpm exec vitest run test/commands/doctor.test.ts -t 'exposes authoritative standalone scope without an active Change'
```

build/CLI bundle freshness と上記結果の記録は LEAD が所有する。この fixer の実行結果はない。native Windows/POSIX CI と task 3.4 は未確認・未完のまま。

## リスク・durable discoveries

1. `store-read` は「汎用 read-only」ではなく aggregate-only capability。doctor が standalone scope を報告するには strict intent を保ったまま限定的に project-read を開く必要があり、単純に全 doctor を project-read にすると Store checkout の既存診断が壊れる。
2. Store metadata の **positive absence** と compatibility/source/path 一致は、resolver が standalone と分類した未登録 legacy Store に scope を付けないための独立した境界。今回も同じ guard を通し、Store の回答や失敗で scope を捏造しない。
3. healthy nearest standalone doctor は aggregate-intent refusal の後に resolver をもう一度開く。strict API と classifier の単一所有を保つための限定コストであり、I/O retry policy は追加していない。性能・native Windows 挙動はこの fixer では測定していない。
