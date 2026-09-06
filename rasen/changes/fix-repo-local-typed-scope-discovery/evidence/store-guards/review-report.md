> LEAD final-gate update: the point-in-time CI limitation recorded below was closed by run `34029988895`, attempt 2, at the same source head `1f9ee439eeeb4eff6596a77f8f0f614bfcabf30b`. No product or timeout changes followed this review. See `../review-cycle-report.md` for the final CI disposition; the independent source verdict below is unchanged.

No findings.

**WIN-01 は source repair と native Windows の元 failing case の pass を非著者として照合し、closed。SG-001／SG-002 も closed。新規 fix-delta findings は 0。** ただし PR 全体の CI gate は別件の Windows timeout により未完了であり、最終 CLEAN／all-CI pass は認定しない。

本更新は **round 2 の evidence completion**。追加の code-review round ではない。source/test/runtime の再実行や変更は行わず、`evidence/native-ci-r2.md` の保存済み job-log 抜粋を読み、前回の native-pending disposition を更新した。

## Review target and integration attestation

- PR: https://github.com/DumoeDss/rasen/pull/189
- Round: 2/2、dispatched / report-only / ONE_SHOT。Reviewer: `StoreDeltaReview`。修復の著者ではなく、製品・テスト・spec・run-state は変更していない。
- Remediation base: `8ab98e1d9ab242efdd68dac49a4b08a4cea91d06`
- Independently reviewed remediation head: `564d7ab5be1dd767f91d46ff50063d19178f9714`
- Remediation tree: `e90086ca5150787f629ecbec818bf2c90cc4b3ea`
- **Integrated/native-tested head:** `1f9ee439eeeb4eff6596a77f8f0f614bfcabf30b`
- **Integrated tree:** `966b3fa306654d222b592c5e23213677d52be84f`
- Integrated commit の parents は上記 remediation head と upstream `3258a8cb6a0e51267e0be2c794a67ec934e0cde2`。`git show` で独立確認した。
- 完全に読んだ担当差分: `src/core/store/foundation.ts`、`test/core/store/foundation.test.ts`、`test/commands/repo-local-typed-scope.test.ts`、`test/core/root-selection.test.ts`。4 files、182 insertions、15 deletions。周辺の metadata consumers、read precedence、identity refusal、fixture helpers、実際の read capability を追跡した。
- **Integration check:** remediation head → integrated head の `git diff --exit-code` は担当4 files **と必要 caller `src/core/root-selection.ts`**について出力なし／exit 0。以下の source disposition と、今回の native evidence は同じ担当コードに対応する。未関連 upstream 差分全体を再レビューしたという意味ではない。
- `AGENTS.md`、`test/AGENTS.md`、`rasen-review` と必須 `checklist.md`／`greptile-triage.md` を適用。現行 Change の proposal/design/tasks/scope spec と、`rasen/specs/store-registration/spec.md:28-42` の legacy-read contract を読んだ。初回 report、SG/WIN fix reports、CI triage は調査の入口であり、修復の自己認定としては使用していない。

## Standards

**新規 findings: 0 — P0 0 / P1 0 / P2 0 / P3 0。Canonical: Blocker 0 / Major 0 / Minor 0 / Trivial 0。Worst: none。**

### SG-001 — 修復確認、closed（既存 severity: Major）

- `test/commands/repo-local-typed-scope.test.ts:32-38` と `test/core/root-selection.test.ts:68-74` は最初の fixture 作成／Git subprocess より前に、ambient `GIT_*`／`RASEN_*` を case-insensitive に検出して親の `process.env` から除去する。`GIT_DIR`、`GIT_WORK_TREE`、`GIT_INDEX_FILE`、`GIT_COMMON_DIR`、Git config overrides、`RASEN_SESSION_CONTEXT` はこの境界を越えない。
- `runCLI()` は `test/helpers/run-cli.ts:188-199` で親環境を再マージする。この修復は渡す env object だけを filter する方式ではないため、その再マージによる locator/session の再侵入も防ぐ。Git identity/config は既存 `isolatedGitEnv()` の値、CLI HOME/XDG は明示的な fixture 値を再導入する。
- CLI の product/planning 両 checkout は `:71-80`、core の Git/worktree fixture は `test/core/root-selection.test.ts:1113-1132` で、`git init` 直後・`git add`／`git commit` より前に実際の `git rev-parse --show-toplevel` を canonical fixture root と比較する。env object の形ではなく、Git が選んだ repository を検査している。
- 復元は CLI `:85-87`、core `:91-93` で directory cleanup より先に `vi.unstubAllEnvs()` を呼ぶ。cleanup の例外で復元は飛ばない。インストール済み Vitest 3.2.6 の `dist/chunks/vi.bdSIJ99Y.js:3956-3977` は最初の stub 時の値を名前別に保存し、復元後に map を clear する。Windows で除去時の stub 名を uppercase に統一するので、後続の明示的 `RASEN_HOME`／`RASEN_LANG` stub が同じ論理 key の保存値を壊さない。
- setup/test の失敗時も復元に到達することを runner ソースで確認した。`node_modules/.pnpm/@vitest+runner@3.2.6/node_modules/@vitest/runner/dist/chunk-hooks.js:1566-1601` は `beforeEach`／test の例外を記録した後、別の `try` で `afterEach` を実行する。`vitest.config.ts:127-131` の `pool: 'forks'` と担当 suite の非 concurrent 構成も確認した。これは failure injection を実行した証拠ではない。
- 担当2 suites の native Windows/POSIX pass は後掲の保存済み CI evidence で確認。poisoned-sentinel の全環境・byte 比較を native Windows で実行した、という追加の主張はしない。

### WIN-01 — error/ownership boundaries の確認

`readOptionalStoreMetadataState` の LSP references は **40 occurrences**（declaration/import/test/type references を含む）、新 namespace helper は **2 occurrences**。occurrences を caller 数とは扱っていない。production の呼出箇所を直接読んだ結果、追加の `ENOTDIR` が新たな write permission や identity に変わる経路は確認されなかった。

| 境界 | 確認した処理 |
| --- | --- |
| Nearest adoption | `src/core/root-selection.ts:1044-1056,1081-1092` は optional read の `null` だけで adoption を許し、例外なら `standaloneMetadataAbsent` は false のまま。CAP negotiation も同じ事実を要求する。 |
| Registered identity | `src/core/store/inspection.ts:39-59` は read error／missing／id mismatch を区別する。`src/core/root-selection.ts:387-408` は既存 taxonomy を維持し、`fromStoreError:229-238` は未知の read error を成功へ変換しない。`registry.ts:461-509` の verification も metadata read と id/uid mismatch 判定を write より前に行う。 |
| Bootstrap / operation admission | `src/core/store/bootstrap.ts:987-1000,2837-2851` は unreadable と absent を分離し、`src/core/store/operations.ts:390-402,1773-1824` は error/invalid metadata を報告する。occupied legacy namespace は missing ではなく既存の unreadable 側へ入る。 |
| Identity rewrite / rollback | `identity-migration.ts:132-155,193-214`、`upgrade-identity.ts:226-239,321-329`、`registry.ts:645-666`、`foundation.ts:687-696` は拒否／skip／read-back verification／所有確認の既存境界を保つ。 |
| 意図的に error を吸収する read consumers | doctor の3箇所、`layout-write-guard.ts:125,190`、`migration-ops.ts:166,262` は従来から catch して null/undefined にしている。新 helper はこれらの policy を変更しない。 |

## Spec

**新規 findings: 0 — P0 0 / P1 0 / P2 0 / P3 0。Canonical: Blocker 0 / Major 0 / Minor 0 / Trivial 0。Worst: none。**

### WIN-01 — source repair と native regression pass を確認、closed（既存 severity: Blocker）

根拠は `src/core/store/foundation.ts:280-294,898-915`、それが返す値を使う nearest guard、および後掲の native failing-case pass。`readStoreMetadataState` の成功 read／parse は先に完了し、helper は **ENOENT catch 内だけ**で呼ばれる。

| 入力・状態 | 現ソースの結果 |
| --- | --- |
| modern metadata が読める | 従来どおりそれを返す。helper は走らない。 |
| modern file がなく legacy metadata が読める | `resolveReadableStoreMetadataPath:214-222` が legacy を選ぶ。modern namespace が regular file でも readable legacy が先に成功する既存 precedence は維持される。 |
| modern と legacy の両 file がある | modern が優先。malformed modern を legacy に読み替えない。 |
| 選ばれた modern/legacy file が malformed、schema-invalid、または read が EACCES/EISDIR/ENOTDIR 等で失敗 | `:904` は非 ENOENT をそのまま再送出する。`parseStoreMetadataState:467-505` の id/uid/schema checks、parse error の `StoreError` 化は変更されていない。 |
| supported namespaces が missing、または directories で metadata file がない | ENOENT 後の確認を通り null。directory が存在するだけでは拒否しない。 |
| `.rasen-store` が regular file | POSIX の自然な ENOTDIR は再送出。Windows 側の ENOENT 経路では namespace `stat().isDirectory()` が false になり ENOTDIR を生成するため、null を返さず adoption を止める。元 failing CLI case の native Windows pass を今回確認。 |
| `.openspec-store` が regular file で readable modern metadata がない | 両 platform で ENOTDIR。POSIX でも旧 null から拒否へ変わるが、現行 `design.md:110-116`／`tasks.md:55` が明記する修復契約であり、未承認の precedence 変更ではない。 |
| absence 確認中の namespace stat が非 ENOENT で失敗 | `:289-290` が再送出し、未確認の状態を absent にしない。 |

この確認は、既存 `pathIsFile` が隠すすべての filesystem failure を新 helper が解決した、という主張ではない。今回の差分は optional reader の ENOENT ambiguity を修復するもの。`probeStoreMetadataState`／`classifyStoreRootLayout` は変更されておらず、前者の成功を optional reader の証拠として流用していない。

occupied legacy namespace の拒否は `rasen/specs/store-registration/spec.md:28-42` の「有効な legacy `.openspec-store/store.yaml` を読む／legacy directory を変更しない」契約を壊さない。有効な file は先に読まれ、新 helper による書込みはない。Store mismatch 側も読み取った id/uid をそのまま既存検査へ渡す。

`test/core/store/foundation.test.ts:396-436` は genuine absence（root 不在・namespace directory のみ）と malformed metadata の既存境界を残し、modern／legacy の occupied namespace を個別の `it.each` case として ENOTDIR rejection で検査する。`test/commands/repo-local-typed-scope.test.ts:193-201` の実 CLI regression は scope 不在と planning tree 不変を維持し、skip や Windows 専用の弱い期待値に置換されていない。

### SG-002 — source と native coverage を確認、closed（既存 severity: Minor）

- 対応要求: Change spec `specs/store-planning-scope-routing/spec.md:43-47` と `test/AGENTS.md:19-30`。
- `test/core/root-selection.test.ts:32-62` は native path と比較する symlink/junction case、Windows drive-letter case、Windows forward-slash case を定義する。drive-qualified path を要求するため drive-case 変換が空振りして pass することはない。
- `:316-366` は実在する同じ planning tree と Change を準備し、`:333-334` で **実際の `resolveOpenSpecRoot`** を native/alias の両方から呼ぶ。
- `:343-365` は nearest source／standalone description に加えて、`root.scope.kind === 'project'` と standalone ref を要求する。`locate()` で active Changes／archive line／specs／design-docs の absolute/native-normalized locator を得て、既知の実ディレクトリと `fs.realpathSync.native()` で比較する。description の locator と capability の locator の一致も検査する。
- 両 capability に実際の `openChange({ changeId })` を行い、返された Change location を実在 fixture Change と比較する。production は `src/core/store-planning/internal/resolver.ts:2399-2485` の `readCapability`、契約は `types.ts:266-271`。description metadata だけのテストではない。
- Native Windows で root-selection suite **52 tests**、POSIX で **50 tests** が pass した記録を確認。Windows-only 2 rows を含む unskipped case table と、この suite-level の実行証拠を照合した。fast rows の個別成功ログが印字されたとは主張しない。

## Native evidence — runtime closure

証拠: `rasen/changes/fix-repo-local-typed-scope-discovery/evidence/native-ci-r2.md`。同ファイルの job-log 抜粋を直接読んだ。この reviewer が tests を起動した、または full job logs を再取得した証拠ではない。

- Run: [34029988895](https://github.com/DumoeDss/rasen/actions/runs/34029988895)、**attempt 1**。
- Tested head/tree は上記 integrated fingerprint と一致。
- Windows: `windows-2025-vs2026`、image `20260824.214.3`、PowerShell、Node `v20.19.0`。
- Linux: `ubuntu-24.04`、image `20260831.293.1`、Bash、Node `v20.19.0`。

| Gate / evidence | 保存された結果 |
| --- | --- |
| WIN-01 元 failing CLI case | Windows shard 1 [job 101477630660](https://github.com/DumoeDss/rasen/actions/runs/34029988895/job/101477630660)、source-log lines 1350–1354。`test/commands/repo-local-typed-scope.test.ts (4 tests)` が passし、`does not adopt a standalone scope when Store metadata cannot be read` は **3870ms の明示的な ✓ 行**。同じ抜粋で legacy scope-less/archive refusal case も pass。 |
| SG-002 Windows alias cases | Windows shard 3 [job 101477630557](https://github.com/DumoeDss/rasen/actions/runs/34029988895/job/101477630557)、source-log line 2297。`✓ test/core/root-selection.test.ts (52 tests) 8602ms`。reviewed source の unskipped Windows-only 2 rows と基本 alias row を含む。 |
| WIN-01 metadata seam cases | Windows shard 2 [job 101477630608](https://github.com/DumoeDss/rasen/actions/runs/34029988895/job/101477630608)、source-log line 974。`✓ test/core/store/foundation.test.ts (24 tests) 132ms`。reviewed source の modern/legacy occupied-namespace 2 rows を含む。 |
| POSIX preservation | Linux [job 101477630638](https://github.com/DumoeDss/rasen/actions/runs/34029988895/job/101477630638) の root-selection 50 tests、foundation 24 tests、repo-local CLI 4 tests が pass。CLI の unreadable/legacy refusal cases も明示的な ✓ 行。 |
| Linux full-suite context | 同 Linux job の totals は **432 files passed、7618 tests passed／40 skipped**。対象 suite の pass と、全体の skip 数を混同していない。 |

WIN-01 closure は **元の実在 Windows failure が修復を含む同一 source で再発しなくなったこと**と、metadata/alias suites・POSIX preservation の証拠に基づく。初回 run `34026299987` の旧 head/POSIX pass を流用していない。今回の元 failing case は旧 shard 3 ではなく **shard 1** に移っている。

### Separate CI gate — 未完了、WIN-01 と混同しない

Attempt 1 の Windows shard 1 job 自体は失敗している。別の既存 case:

`test/commands/store-root-selection.test.ts > store root selection for normal commands > archive --json is non-interactive > keeps stdout pure when REMOVED deltas target a new spec`

が `test/commands/store-root-selection.test.ts:719:5` で `Error: Test timed out in 30000ms.`、続いて `EBUSY` cleanup となった。保存証拠の exact timeout 行を確認した。test/helper が upstream から未変更という記録だけでは、この PR と無関係とは証明できない。**root cause unknown**。この限定 evidence update では調査・分類・timeout 緩和をしていない。

Main が要求した code-unchanged failed-job rerun の結果は未提供。従って **WIN-01 closed と all-CI pass は別の判定**であり、この report は PR の最終 gate を閉じない。failed job の再実行・triage・run-state の所有者は Main。

## Coverage map — source inspection と CI observation の区別

`[T]` は行動 assertion を持つ reviewed test source、`[CI]` は上記保存済み native evidence、`[S]` は source-only の境界確認。

```text
Optional metadata read
├─ readable modern / legacy precedence            [S + existing legacy-metadata tests:57-93]
├─ selected read/parse failure                    [S; foundation malformed assertion:405-409]
└─ ENOENT → supported namespace confirmation
   ├─ missing / directory without metadata        [T; Windows/POSIX foundation suite CI pass]
   ├─ modern / legacy occupied by regular file    [T; Windows/POSIX foundation suite CI pass]
   └─ non-ENOENT namespace stat failure            [S; explicit errno injection 未実施]
Nearest → scope not adopted/no writes              [T + CI: 元 failing Windows case 明示 pass]
Fixture boundary
├─ ambient GIT_/RASEN_ removed before children    [S; Git-root assertions; native suites pass]
└─ failure → afterEach → restore before cleanup   [S; installed Vitest 3.2.6 lifecycle確認]
Alias handoff
├─ native versus symlink/junction                [T + Windows/POSIX suite CI pass]
├─ Windows drive case / forward slash            [T + Windows 52-test suite CI pass]
└─ actual locate/openChange + canonical target   [T + 上記 suite-level CI evidence]
```

## 実施した非変更チェックと限界

- `git diff 8ab98e1d9ab242efdd68dac49a4b08a4cea91d06..564d7ab5be1dd767f91d46ff50063d19178f9714 -- src/core/store/foundation.ts test/core/store/foundation.test.ts test/commands/repo-local-typed-scope.test.ts test/core/root-selection.test.ts` — 完全な4-file差分を読んだ。
- `git show -s --format='%H%n%T%n%D%n%s' 564d7ab5be1dd767f91d46ff50063d19178f9714` — remediation head/tree は上記と一致。
- `git diff --exit-code 564d7ab5be1dd767f91d46ff50063d19178f9714..1f9ee439eeeb4eff6596a77f8f0f614bfcabf30b -- src/core/store/foundation.ts test/core/store/foundation.test.ts test/commands/repo-local-typed-scope.test.ts test/core/root-selection.test.ts src/core/root-selection.ts` — 出力なし、exit 0。
- `git show -s --format='%H%n%T%n%P%n%s' 1f9ee439eeeb4eff6596a77f8f0f614bfcabf30b` — integrated head/tree/parents は上記と一致。
- 初回の `gh api --paginate` による PR review-comments と issue-comments の Greptile bot 抽出は両方 `[]`。旧 remediation head `564d7ab5` に対する CI query は run 0 件であり、今回の integrated-head native evidence と矛盾しない。
- Main の remediation local gate **93 files／1718 tests／2 skipped**、`node build.js --if-stale`、tsc/targeted eslint pass は Main の報告としてのみ扱う。今回の WIN-01 closure の直接 runtime 根拠は native CI の同一 head と元 failing-case pass。
- Graph Verify tier: project `Users-pashifika-Work-pashifika.github-ghostty-rasen`、root は対象 repository、generation `2026-09-06T04:07:19Z`。関連 symbol searches と depth-1 both-direction trace の pagination は終了。foundation/root-selection は `metadata_changed`、tests/specs/installed dependency は excluded/not_tracked のため LSP と現ソースを使用。引用 path と環境検索 scope に coverage check を行った。stale index span の `get_code_snippet` は要求した関数と違う範囲を返したため証拠から除外し、tool issue として報告した。native evidence も excluded のためファイル本文を直接読んだ。graph を完全性の証明にしていない。
- 指示どおり test/build/lint/formatter、CLI dispatch、sentinel／errno probe、製品編集、Git mutation、external AI、nested agent は実施していない。今回の evidence completion の書込みはこの canonical report のみ。
- Native Windows の poisoned-sentinel failure injection や個別 ACL/errno probe を reviewer 自身が実行したとは主張しない。fast alias/foundation rows は suite pass と reviewed source の対応で確認しており、存在しない row-level log を捏造しない。未変更 Linux agent-dispatch race は調査していない。`rasen/config.yaml`、実 Store／Archive／spec sync、run-state は対象外。

## Disposition / counts

| Prior ID | 非著者 disposition | 根拠と範囲 |
| --- | --- | --- |
| SG-001 — Major / Standards | **Confirmed repaired / closed** | 親 env 除去・Git-root 検査・失敗時復元の source確認。担当 suites の Windows/POSIX pass。native poisoned-sentinel を実行済みとはしない。 |
| SG-002 — Minor / Spec | **Confirmed repaired / closed** | 実 capability の alias case table と、Windows 52／POSIX 50 の suite-level native evidence を照合。 |
| WIN-01 — Blocker / CI・platform safety | **Confirmed source and native repair / closed** | 同一 integrated source、Windows 元 failing case の明示 pass、foundation 24-test pass、POSIX preservation。 |

**新規 unique findings: 0。Standards: 0、Spec: 0。Prior findings: closed 3 / still-open 0 / rejected 0。WIN-01 native gate の持越し: 0。別の PR CI gate: 未完了（Windows timeout、root cause unknown、Main 所有）。これを fix-delta finding として重複計上しない。**

## Durable discoveries

1. Namespace validation は成功 read より前に置いてはいけない。有効な legacy metadata が読める場合を含む既存 precedence を保ったまま、ENOENT のときだけ「非 directory による見かけの不在」を拒否する。
2. `runCLI` の親環境再マージと Vitest の名前別 restoration map が隔離境界を決める。親から locator を除去し、Windows の論理 key spelling を揃え、cleanup より先に復元する必要がある。
3. Native regression の閉鎖証拠は exact head・case・job に結び付ける。shard 番号は変わり、別 case で失敗した job 内にも当該 regression の有効な pass 証拠は残る。その finding closure と all-CI gate を混同しない。
