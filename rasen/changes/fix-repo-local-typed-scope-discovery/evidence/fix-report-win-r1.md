# WIN-01 — round-1 fixer report

## 状態

**DONE — 修正コードと foundation 回帰ケースを提出。検証と WIN-01 の閉鎖判定は LEAD / 独立 delta reviewer / native Windows CI 待ち。**

この fixer は build、test、lint、formatter、CLI smoke、CI 再実行を行っていない。以下は適用内容とソース追跡の記録であり、pass または finding resolved の自己認定ではない。編集後に行ったのは 2 ファイルの language-server diagnostics 確認（エラーなし）のみ。

## 変更ファイル

| ファイル | 変更内容 |
| --- | --- |
| `src/core/store/foundation.ts:271-294` | private `findNonDirectoryMetadataNamespace(storeRoot)` を追加。`.rasen-store` / `.openspec-store` の各 namespace を `fs.stat` し、ENOENT は不在、directory は不在確定、非 directory は occupied namespace として返す。その他の stat 失敗は propagate。 |
| `src/core/store/foundation.ts:891-915` | `readOptionalStoreMetadataState` の ENOENT 分岐を「確認済みの不在」に限定。occupied namespace があれば `code: 'ENOTDIR'` の Error（POSIX が read 自体で返すものと同じ形）を throw。契約を doc comment に記述。 |
| `test/core/store/foundation.test.ts:396-436` | 既存 `returns null only when optional metadata is missing` に「namespace directory はあるが file がない → null」境界を追加。`it.each` table で `.rasen-store` / `.openspec-store` が regular file の場合に `rejects.toMatchObject({ code: 'ENOTDIR' })` を検証。import に `getLegacyStoreMetadataDir` を追加。 |
| `rasen/changes/fix-repo-local-typed-scope-discovery/evidence/fix-report-win-r1.md` | 本報告。 |

`src/core/root-selection.ts`、`src/commands/doctor.ts`、`test/commands/repo-local-typed-scope.test.ts`、`test/core/root-selection.test.ts`、`test/commands/doctor.test.ts`、proposal/design/tasks、`evidence/ci-triage-r1.md`、`rasen/config.yaml` は未変更（sibling / 前回 fixer 所有）。Git 操作、archive、spec sync、run-state writes、Ghostty、global install、nested agent は行っていない。

## 原因

CI 実失敗: `test/commands/repo-local-typed-scope.test.ts > does not adopt a standalone scope when Store metadata cannot be read`（Windows shard3、`ci-windows-shard3.log:3502-3566`）。fixture は `repoRoot/.rasen-store` に **regular file** を置き、`list --json` に `root.scope` が付かないことを要求する。Windows では `root.scope` が `nearest-standalone` / `project-binding` で付いた。

ソース経路（旧コード）:

1. `resolveReadableStoreMetadataPath` は `pathIsFile(canonical)` → false（stat 失敗を黙って false）、`pathIsFile(legacy)` → false、canonical path を返す。
2. `readStoreMetadataState` が `fs.readFile('<root>/.rasen-store/store.yaml')` を実行。
   - POSIX: `.rasen-store` が file なので **ENOTDIR** → `isFileNotFoundError` は false → throw → root-selection の `catch` で `standaloneMetadataAbsent = false` のまま → scope なし。
   - Windows: 同じ形を OS が **ERROR_PATH_NOT_FOUND → ENOENT** として報告 → `isFileNotFoundError` true → **`null`** → `standaloneMetadataAbsent = true` → standalone scope 採用。
3. root-selection は `metadata === null` だけを positive absence と信じる（`src/core/root-selection.ts:1048-1049`）。この契約は維持する対象であり、崩れていたのは metadata reader 側の「ENOENT = 不在」という errno 依存の判定。

`fs.stat` / `fs.readFile` の errno が platform で異なること自体は repo 内の他テストも前提にしている（`test/core/omp/project-context.test.ts:11-17`、`test/core/pipeline-registry/run-state.test.ts:43-47`、`test/utils/file-system.test.ts:303-307`）。

## 適用した契約

`readOptionalStoreMetadataState(storeRoot)`:

- 読めた → metadata を返す（modern → legacy の read 優先順は `resolveReadableStoreMetadataPath` のまま、未変更）。
- ENOENT 以外の失敗（malformed YAML / schema violation の `StoreError`、EISDIR、EACCES、POSIX の ENOTDIR 等）→ 従来どおり propagate。
- ENOENT → `findNonDirectoryMetadataNamespace` で `.rasen-store` と `.openspec-store` を確認。
  - 両方が missing または directory → **genuine absence → `null`**（root なし、namespace directory のみで file なし、を含む）。
  - いずれかが非 directory → `Error("ENOTDIR: not a directory, open '<namespace>/store.yaml'")` with `code: 'ENOTDIR'` を throw。
  - namespace の stat が ENOENT 以外で失敗 → その stat error を propagate（不在を確認できないので fail closed）。

意図的な結果:

- Windows の `.rasen-store` file は POSIX と同じ ENOTDIR 失敗になり、root-selection は既存 `catch` を通って scope なしの compatibility root を返す（CI 失敗ケースの経路）。root-selection に第 2 の classifier は追加していない。
- **両 platform 共通の挙動変更**: `.openspec-store` が regular file で `.rasen-store` が missing/空 directory の場合、旧コードは POSIX でも `null` を返していた。新コードは同じ ENOTDIR を throw する。「supported namespace が非 directory なら absent にしない」を legacy namespace にも一様に適用した結果であり、read 優先順は変えていない（`.rasen-store` が file でも `.openspec-store/store.yaml` が読めればそれを返す点も従来どおり）。
- 新しい public option / API / diagnostic code はない。`StoreError` も新設していない。errno 付き Error の合成は `src/core/specs-apply.ts:431-433`（ENOENT）や `src/core/work-migration.ts:272`（ESTALE）と同じ既存パターン。

## Caller とリスク

`readOptionalStoreMetadataState` の LSP references は 34 件（declaration / import 含む）。production 呼び出しはすべて「throw を propagate する」「`.catch(() => null)`」「catch して `failure.message` を報告する」のいずれかで、error の `code` を分岐に使う箇所はない。

| Caller | 新しい ENOTDIR に対する挙動 |
| --- | --- |
| `src/core/root-selection.ts:1048`, `:978` | 既存 `catch` → `standaloneMetadataAbsent=false` / `declaresLayoutV2=false`。WIN-01 の修正経路。 |
| `src/commands/doctor.ts:92,150,364` | `.catch(() => null)`。変化なし。 |
| `src/core/store/bootstrap.ts:989`, `:2839` | `unreadable` / `blocked(unreadableState(...))` に `failure.message` を載せる。Windows でも POSIX と同じ「ENOTDIR: not a directory」文になる。 |
| `src/core/store/operations.ts:392` | `StoreError(error.message)` に包む。同上。 |
| `src/core/store/inspection.ts:42` | `{ kind: 'metadata_error', error }`。identity.ts で `metadata-missing` unavailable として扱う経路は従来の POSIX ENOTDIR と同じ。 |
| `registry.ts:466`, `upgrade-identity.ts:226,321`, `identity-migration.ts:134,194` | propagate または catch → result。POSIX の従来挙動と一致。 |
| `layout-write-guard.ts:125,190`, `migration-ops.ts:166,262`, `foundation.ts:664 readEntryUid` | `.catch(() => null)` / `undefined`。変化なし。 |

新旧いずれにも残る境界（この fixer のスコープ外、変更していない）:

- `probeStoreMetadataState` と `classifyStoreRootLayout` は「metadata **file** が stat で file か」で absent / not-a-store を決めるため、`.rasen-store` file は両 platform で従来どおり `absent` / `not-a-store`。旧コードでも POSIX の optional reader（ENOTDIR throw）と既に不一致だった。今回は Windows の optional reader を POSIX に合わせただけで、新しい不一致は導入していない。
- `storeRoot` 自体が regular file の場合: POSIX は read で ENOTDIR、Windows は namespace stat も ENOENT になり `null`。namespace の外側なので今回の契約に含めていない。root-selection の `nearest` は directory walk の結果なので到達しない。
- 追加コストは「metadata が読めず ENOENT だった場合」だけの `fs.stat` 最大 2 回。成功 read と ENOENT 以外の失敗に追加 I/O はない。

## 回帰ケースの設計

`test/core/store/foundation.test.ts` の `store metadata IO`:

- `returns null only when optional metadata is missing`: root なし → null、**`.rasen-store/` directory のみ → null**（over-eager な「namespace が存在すれば absent ではない」判定を排除する境界）、malformed file → `Invalid store metadata state`。
- `it.each` table（`$scenario`）: `.rasen-store` / `.openspec-store` を regular file にして `rejects.toMatchObject({ code: 'ENOTDIR' })`。POSIX では canonical 行は OS の自然な ENOTDIR、legacy 行は新 classifier を通る。Windows では両行が新 classifier を通る。table は行ごとに独立 test として報告される。

CLI 側の `does not adopt a standalone scope when Store metadata cannot be read` は sibling 所有で未変更。native Windows CI がその実ケースの証拠を持つ。

## LEAD 向けの提案検証コマンド — 未実行

```sh
RASEN_LANG=en pnpm exec vitest run test/core/store/foundation.test.ts test/core/store/legacy-metadata.test.ts test/core/store/bootstrap-metadata-probe.test.ts test/core/root-selection.test.ts
RASEN_LANG=en pnpm run build:if-stale
RASEN_LANG=en pnpm exec vitest run test/commands/repo-local-typed-scope.test.ts test/commands/doctor.test.ts test/commands/declared-store-fallback.test.ts test/commands/store-migration-cli.test.ts
```

WIN-01 だけを切り出す場合:

```sh
RASEN_LANG=en pnpm exec vitest run test/core/store/foundation.test.ts -t 'unreadable declaration'
RASEN_LANG=en pnpm exec vitest run test/commands/repo-local-typed-scope.test.ts -t 'does not adopt a standalone scope when Store metadata cannot be read'
```

POSIX host での CLI ケース pass は WIN-01 の閉鎖証拠にならない（旧コードでも POSIX は pass していた）。閉鎖には native Windows CI の同ケース pass が必要。tsc / eslint は LEAD の統合 run に委ねる。

## Durable discoveries

1. Windows の libuv は `file\child` への open/stat を ERROR_PATH_NOT_FOUND → **ENOENT** として返す。「ENOENT = 不在」を positive absence の根拠にする optional reader は、path component が非 directory の場合に Windows でだけ fail-open する。absence を errno だけで判定せず、namespace directory の型を確認する必要がある。
2. `pathIsFile` / `pathIsDirectory`（`src/core/file-state.ts:77-95`）は stat 失敗を黙って false にするため、「absent」と「occupied by a non-directory」を区別できない。`isStoreRoot`、`probeStoreMetadataState`、`classifyStoreRootLayout` はこの primitive に依存しており、`.rasen-store` file を両 platform で absent / not-a-store と分類する。今回はスコープ外として据え置いた。
3. Windows CI の shard 分割により、この種の platform 差は特定 test file が乗った shard だけで顕在化する。errno 差を前提とする既存テストは errno 注入（`project-context.test.ts`）か platform 非依存の形（`fs.stat` の型確認）で書かれており、`.rasen-store` file fixture を使う test は platform 非依存の absence 判定が seam 側に無いと Windows で fail-open する。
