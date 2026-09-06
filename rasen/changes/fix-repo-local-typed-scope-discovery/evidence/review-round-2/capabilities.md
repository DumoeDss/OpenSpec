# PR #189 — capabilities review, round 2

No findings.

## Standards

新規 remediation-delta finding: **0**。

**Blocker 0 / Major 0 / Minor 0 / Trivial 0**。軸内最大 severity: なし。

## Spec

新規 remediation-delta finding: **0**。

**Blocker 0 / Major 0 / Minor 0 / Trivial 0**。軸内最大 severity: なし。

**CAP-01: 修復確認・closed。** 元の finding は Spec / Blocker / P1。非作者 `CapabilityDeltaReview` が実ソース、consumer regression、および後着の native CI evidence を確認した。fixer report の自己申告を閉鎖根拠にはしていない。proposal の doctor promise は維持され、Store capability の偽装、fallback の一般化、元の diagnostic の置換はこの delta に認められない。

SG-001 / SG-002 / WIN-01 のソース判定は `StoreDeltaReview` 所有。本報告で重複判定しない。

## CAP-01 の閉鎖根拠

| 確認対象 | 実ソースによる根拠 |
| --- | --- |
| doctor が正しい入口を使う | `src/commands/doctor.ts:655-673` は selector の渡し方、`allowImplicitRoot: false`、`allowUnavailableStore: true`、`--project` がなければ `store-read` とする選択を維持。production delta はコメントのみ。 |
| 限定された capability negotiation | `src/core/root-selection.ts:1059-1078` は **store-read / metadata の positive absence / RootSelectionError / project_scope_required / target:intent** のすべてを要求する。`project-read` は同じ options を引き継いで一度だけ開かれる。元の拒否は `src/core/store-planning/internal/resolver.ts:1907-1918` で、standalone ref が aggregate intent と非互換であるために起きる。 |
| Store-first routing を広げない | explicit selector branches は `src/core/root-selection.ts:994-1042`、layout-v2 early return は `:1050-1051`、元の positive Store return は `:1079-1080` に残る。追加 project-read の回答が Store kind なら `:1076` で最初の error を再 throw し、その Store scope を採用しない。LSP で確認したもう一つの aggregate-intent caller、context は explicit Store の場合だけその intent を渡す (`src/commands/context.ts:377-391`) ため、この nearest-only fallback を使わない。 |
| 元の diagnostic を維持 | `src/core/root-selection.ts:1072-1076` は二回目の失敗を候補なしとして扱うが、直後に捕捉済みの **最初の error** を再 throw する。後段の `:1098-1117` は既存の compatibility / Store-fact / layout-v2 handling のまま。「すべての resolver error が必ず CLI に直接表示される」という主張ではなく、元の error と既存の表示経路を変更していないという確認。 |
| metadata・source・path の独立した境界 | `src/core/root-selection.ts:1046-1056` では metadata read が `null` のときだけ absence が立ち、読める Store metadata や read failure では立たない。候補は従来の adapter を通り、`source: nearest`、`storeId` 不在、`samePathForPlatform` での root 一致が必要 (`:1081-1094`)。不一致なら compatibility root を返す。採用時に変えるのは root の `source` だけで、scope の evidence source を上書きしない。metadata seam 自体の WIN-01 修復判定は sibling 所有。 |
| ref・typed paths・read capability の所有権 | `src/core/root-selection.ts:729-785` が既存の `StorePlanning.open` と `projectReadProjection` から capability と description を受け取る。intent の dispatch は `src/core/store-planning/internal/resolver.ts:459-497`、project-read capability は `:2399-2485`、standalone locations は `:2137-2148`。doctor や serializer に ref/path を合成する変更はない。JSON には description だけが出る (`src/core/root-selection.ts:1146-1152`; `src/core/relationship-health.ts:540-544`)。 |
| mismatch・broken frozen worktree・session の扱い | 両 open は同じ resolver の session/association と conflict reduction を通る (`src/core/store-planning/internal/resolver.ts:1530-1540,1662-1702`)。conflict reducer は異なる証拠を `planning_selection_conflict` として拒否 (`:685-753`)。壊れた session は `:755-828`、消滅・置換・ref 変更された frozen worktree は `:836-885` で別コードを返すため、新しい exact-intent fallback の対象にならない。既存の outer compatibility handling を新たな fail-closed 保証に言い換えてはいない。 |
| active Change を前提にしない | doctor は change selector を渡さない。project-read の selected-Change 検証は明示入力時だけ (`src/core/store-planning/internal/resolver.ts:1944-1948`)。したがって空の planning tree でも read scope を得る経路があり、missing Change の扱いを global に緩和する変更はない。 |

## Consumer regression と境界の対応

`test/commands/doctor.test.ts:52-92` の `exposes authoritative standalone scope without an active Change` は、mock の呼出し回数や内部 forwarding ではなく **built CLI の JSON 契約**を検証している。

- canonicalized temporary root の下に正常な standalone planning tree を作り、`rasen/specs` を cwd にする。fixture は config、specs、changes/archive のみを作る (`test/helpers/rasen-fixtures.ts:5-9`)。
- `list --json` の `changes: []` を確認してから doctor を実行する (`test/commands/doctor.test.ts:59-65`)。
- healthy nearest root、`standalone` / `project-read` / `nearest-standalone`、fixture を指す ref、全9 typed planning paths、`store_id` 不在を検証する (`:67-89`)。
- list と doctor の ref / paths の一致も検証する (`:90-91`)。期待値は fixture の native paths から作るため、両 consumer が同じ誤った場所を返すだけでは通らない。
- `runCLI` は実際に Node の CLI entry を spawn する (`test/helpers/run-cli.ts:178-201`)。この reviewer は helper、build、CLI、test を実行していない。

以下はソースと既存テスト本文の対応であり、この reviewer が取得した runtime coverage 率ではない。

```text
nearest root + doctor/store-read
|
+-- Store aggregate / legacy / explicit selection
|   -> 既存 routing
|   [test source] store-migration-cli.test.ts:164-226
|   [test source] store-v2-planning-scope-journey.test.ts:416-442,517-523
|
+-- metadata absent + exact aggregate-intent refusal
|   -> project-read open
|      +-- positive standalone
|      |   -> compatibility/source/no-store/path guard
|      |      +-- agreement -> resolver-owned scope -> doctor JSON
|      |      |   [new consumer test] doctor.test.ts:52-92
|      |      |   [native log] Windows shard3: named CAP case PASS
|      |      +-- disagreement -> existing compatibility root
|      +-- Store result / failure -> original error -> existing handler
|
+-- readable/unreadable Store metadata or another diagnostic
    -> no new negotiation; existing diagnostic/compatibility handling
    [test source] doctor.test.ts:212-253,316-349
    [session provider tests] store-planning.test.ts:1256-1361
```

新しい consumer case 単体はすべての拒否分岐を実行するものではない。それらの境界は実ソースと既存 preservation tests で照合した。Store-first や read-only preservation の既存ケースを standalone case で置き換えていない。

## Spec / docs の照合

- `rasen/changes/fix-repo-local-typed-scope-discovery/proposal.md:9-14` は doctor を列挙したまま、限定 handoff と metadata の positive absence を追記している。`specs/store-planning-scope-routing/spec.md:5` の resolver-owned paths、active Change 非依存、compatibility source、serialized scope が mutation authority を持たない要求と整合する。
- `design.md:78-93` と `tasks.md:31-39` は初期設計を doctor の aggregate intent に限って修正し、source completion、LEAD runtime validation、独立 review を区別する。task 5.4 の未チェックは本報告前の状態であり、leaf は更新しない。
- WIN-01 の docs は `.openspec-store` が regular file の場合の POSIX 影響も明記し、古い CI pass を修復後の証拠に転用していない (`design.md:104-118`; `tasks.md:51-59`; `proposal.md:34`)。metadata implementation の判定は sibling に委ねる。
- integrated `CHANGELOG.md:11-18` は doctor を含む typed-scope entry と upstream の archive Changed/Fixed entries の両方を保持。新しい scope entry は CI 全体が green だとは述べていない。

## Exact review target / integration preservation

- PR: `https://github.com/DumoeDss/rasen/pull/189`。同じ round **2**、ONE_SHOT、report-only。元の全 branch diff は再レビューしていない。
- Remediation base: `8ab98e1d9ab242efdd68dac49a4b08a4cea91d06`。
- Remediation head: `564d7ab5be1dd767f91d46ff50063d19178f9714`。
- Remediation tree: `e90086ca5150787f629ecbec818bf2c90cc4b3ea`。
- Integration head: **`1f9ee439eeeb4eff6596a77f8f0f614bfcabf30b`**。
- Integration tree: **`966b3fa306654d222b592c5e23213677d52be84f`**。
- Integration parents: `564d7ab5be1dd767f91d46ff50063d19178f9714` と upstream `3258a8cb6a0e51267e0be2c794a67ec934e0cde2`。

実行した read-only commands と観測結果:

1. `git branch --show-current` → `fix/repo-local-typed-scope`。
2. `git diff 8ab98e1d9ab242efdd68dac49a4b08a4cea91d06..564d7ab5be1dd767f91d46ff50063d19178f9714 -- src/core/root-selection.ts src/commands/doctor.ts test/commands/doctor.test.ts CHANGELOG.md rasen/changes/fix-repo-local-typed-scope-discovery/proposal.md rasen/changes/fix-repo-local-typed-scope-discovery/design.md rasen/changes/fix-repo-local-typed-scope-discovery/tasks.md` → **7 files, 145 insertions / 13 deletions**。raw diff を全読。
3. `git show --no-patch --format='%H%n%T' 564d7ab5be1dd767f91d46ff50063d19178f9714` と `git show --no-patch --format='%H%n%T%n%P' 1f9ee439eeeb4eff6596a77f8f0f614bfcabf30b` → 上記 fingerprint を確認。
4. `git diff 564d7ab5be1dd767f91d46ff50063d19178f9714..1f9ee439eeeb4eff6596a77f8f0f614bfcabf30b -- src/core/root-selection.ts src/commands/doctor.ts test/commands/doctor.test.ts CHANGELOG.md rasen/changes/fix-repo-local-typed-scope-discovery/proposal.md rasen/changes/fix-repo-local-typed-scope-discovery/design.md rasen/changes/fix-repo-local-typed-scope-discovery/tasks.md rasen/changes/fix-repo-local-typed-scope-discovery/specs/store-planning-scope-routing/spec.md` → **CHANGELOG の upstream 7行追加のみ**。CAP production/test と Change proposal/design/tasks/spec は不変。raw diff も全読。
5. Greptile の pull-review / issue comments の `gh api ... --paginate --jq ...` GET → 両方とも該当 comment 0。

LSP references は `resolveOpenSpecRoot` 55 occurrences、`resolveRootForCommand` 42 occurrences、command intent field 5 occurrences を返した。これらを caller 数とは扱っていない。definitions と必要な周辺ソースで doctor → root adapter → resolver → health serializer を追跡した。

Graph は `Users-pashifika-Work-pashifika.github-ghostty-rasen`、generation `2026-09-06T04:07:19Z` の fast index。関連 search/trace は pagination を完了。root-selection / doctor / archive の metadata_changed、tests と Change docs の excluded/not_tracked を coverage check で確認し、直接ソースを読んだ。古い graph span や存在しない旧 CLI path を authoritative な引用には使っていない。coverage は完全性の保証ではない。

## Runtime evidence と残る gate

**CAP の native Windows consumer proof は到着済み。全 CI の gate は別件を残して未完。**

`rasen/changes/fix-repo-local-typed-scope-discovery/evidence/native-ci-r2.md` を直接読んだ。run **34029988895 / attempt 1**、head **1f9ee439eeeb4eff6596a77f8f0f614bfcabf30b**、Windows shard3 job **101477630557** の保存された verbatim log は次を示す:

```text
2026-09-06T11:27:26.0022848Z  ✓ test/commands/doctor.test.ts (32 tests) 84962ms
2026-09-06T11:27:26.0026440Z    ✓ rasen doctor (3.6) > exposes authoritative standalone scope without an active Change  2688ms
```

同 evidence は Windows root-selection 52 tests、foundation 24 tests、repo-local CLI 4 tests の pass、および Linux full suite 432 files / 7618 passed / 40 skipped も記録する。WIN-01 の以前の failing CLI case はこの integrated head では **Windows shard1** に移動し、named pass がある。これは native 証拠の共有であり、sibling の source review を代行するものではない。

LEAD は別途、remediation head の93 files / 1718 passed / 2 skipped、統合後の22 files / 517 passed、strict Change validate 0 issues、実 doctor の healthy nearest + standalone/project-read、tsc と targeted eslint の pass を報告した。これは **LEAD 観測**であり、reviewer の再実行結果ではない。

残る material limitation は run 34029988895 の Windows shard1 にある既存 archive case の `Test timed out in 30000ms.` と後続 cleanup の `EBUSY`。保存ログの failing case は `test/commands/store-root-selection.test.ts:719` の `keeps stdout pure when REMOVED deltas target a new spec`。原因は未確定で、ファイルが upstream から未変更というだけで本 PR と無関係とは断定しない。LEAD が code-unchanged failed-job rerun と final gate を所有する。本報告は全 CI CLEAN を宣言しない。

この reviewer は tests / builds / lint / formatters / CLI behavior runs / source edits / commits / run-state writes / nested agents / external AI を実行していない。無関係な `rasen/config.yaml` は未読・未変更。

## Durable discoveries

1. `store-read` は汎用 read-only ではなく aggregate capability。doctor の standalone scope 修復は、Store-first を保ったまま exact intent refusal にだけ project-read を開くことで成立する。
2. metadata の positive absence と compatibility/source/path agreement は別々の必須境界。二回目の resolver が返す Store scope や error は採用せず、最初の diagnostic を既存 handler に返す。
3. CAP source 修復の独立確認と native consumer pass は、全 CI の CLEAN と同義ではない。今回の CAP native proof は揃ったが、archive timeout の全体 gate は LEAD の判定待ち。
