# Native CI evidence — round 2

## Identity and scope

- Run: [34029988895](https://github.com/DumoeDss/rasen/actions/runs/34029988895), attempt 1.
- Head: `1f9ee439eeeb4eff6596a77f8f0f614bfcabf30b`; integrated tree: `966b3fa306654d222b592c5e23213677d52be84f`.
- Windows: `windows-2025-vs2026`, image `20260824.214.3`, PowerShell, Node `v20.19.0` (job logs lines16–17 and setup/environment output).
- Linux: `ubuntu-24.04`, image `20260831.293.1`, Bash, Node `v20.19.0`.
- Direct completed-job logs obtained by `gh api repos/DumoeDss/rasen/actions/jobs/<job-id>/logs --allow-escape-sequences`; excerpts below are verbatim, not reconstructed test output.
- Native closure evidence for WIN-01 is in **shard 1** on this head, not shard 3 from the original run. Shard allocation changed after upstream integration.
- The default reporter prints the successful root-selection suite rather than every fast table row. Its52 passed tests include the unskipped Windows-only drive-case and separator rows in the reviewed source; POSIX has50. Foundation's24 passed tests include both occupied-namespace rows. Do not claim individually printed row-level logs for those fast cases.

## Attempt-1 job outcome boundary

The changed repo-local CLI, root-selection and foundation suites passed on Windows. Linux, Linux Node24, macOS, lint/type, layout migration and placement-recovery jobs passed. This is **not** an attempt-1 all-CI pass: Windows shard1 failed one existing archive case with `Test timed out in 30000ms.`, followed by `EBUSY` cleanup. The test/helper files are unchanged from upstream3258a8cb, but that fact alone does not prove the failure unrelated to this PR. No root cause is established. LEAD requested a code-unchanged rerun of only job101477630660; its result remains separate from this immutable attempt-1 evidence.

## Windows shard 1 — changed CLI regression passed; job failed elsewhere

[Job101477630660](https://github.com/DumoeDss/rasen/actions/runs/34029988895/job/101477630660); source log lines1350–1354.

```text
2026-09-06T11:38:01.5745832Z  [32m✓[39m test/commands/repo-local-typed-scope.test.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 17703[2mms[22m[39m
2026-09-06T11:38:01.5747671Z    [33m[2m✓[22m[39m repo-local typed scope discovery[2m > [22mkeeps list, status, context, and absolute artifacts on the same standalone scope [33m 6480[2mms[22m[39m
2026-09-06T11:38:01.5749448Z    [33m[2m✓[22m[39m repo-local typed scope discovery[2m > [22mexposes the same list and context locators before any active Change exists [33m 2946[2mms[22m[39m
2026-09-06T11:38:01.5750718Z    [33m[2m✓[22m[39m repo-local typed scope discovery[2m > [22mdoes not adopt a standalone scope when Store metadata cannot be read [33m 3870[2mms[22m[39m
2026-09-06T11:38:01.5751995Z    [33m[2m✓[22m[39m repo-local typed scope discovery[2m > [22mkeeps an unregistered legacy Store scope-less and refuses archive without writes [33m 4405[2mms[22m[39m
```

## Windows shard 3 — root-selection and native alias table

[Job101477630557](https://github.com/DumoeDss/rasen/actions/runs/34029988895/job/101477630557); source log lines2297–2297.

```text
2026-09-06T11:24:17.9066366Z  [32m✓[39m test/core/root-selection.test.ts [2m([22m[2m52 tests[22m[2m)[22m[33m 8602[2mms[22m[39m
```

## Windows shard 3 — doctor regression

[Job101477630557](https://github.com/DumoeDss/rasen/actions/runs/34029988895/job/101477630557); source log lines2736–2737.

```text
2026-09-06T11:27:26.0022848Z  [32m✓[39m test/commands/doctor.test.ts [2m([22m[2m32 tests[22m[2m)[22m[33m 84962[2mms[22m[39m
2026-09-06T11:27:26.0026440Z    [33m[2m✓[22m[39m rasen doctor (3.6)[2m > [22mexposes authoritative standalone scope without an active Change [33m 2688[2mms[22m[39m
```

## Windows shard 2 — metadata foundation

[Job101477630608](https://github.com/DumoeDss/rasen/actions/runs/34029988895/job/101477630608); source log lines974–974.

```text
2026-09-06T11:35:20.8531035Z  [32m✓[39m test/core/store/foundation.test.ts [2m([22m[2m24 tests[22m[2m)[22m[32m 132[2mms[22m[39m
```

## Linux — root-selection

[Job101477630638](https://github.com/DumoeDss/rasen/actions/runs/34029988895/job/101477630638); source log lines2341–2341.

```text
2026-09-06T11:23:27.6539245Z  [32m✓[39m test/core/root-selection.test.ts [2m([22m[2m50 tests[22m[2m)[22m[33m 1799[2mms[22m[39m
```

## Linux — metadata foundation

[Job101477630638](https://github.com/DumoeDss/rasen/actions/runs/34029988895/job/101477630638); source log lines4130–4130.

```text
2026-09-06T11:30:37.5621721Z  [32m✓[39m test/core/store/foundation.test.ts [2m([22m[2m24 tests[22m[2m)[22m[32m 151[2mms[22m[39m
```

## Linux — repo-local regression

[Job101477630638](https://github.com/DumoeDss/rasen/actions/runs/34029988895/job/101477630638); source log lines5256–5260.

```text
2026-09-06T11:32:59.8828681Z  [32m✓[39m test/commands/repo-local-typed-scope.test.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 12666[2mms[22m[39m
2026-09-06T11:32:59.8843351Z    [33m[2m✓[22m[39m repo-local typed scope discovery[2m > [22mkeeps list, status, context, and absolute artifacts on the same standalone scope [33m 6077[2mms[22m[39m
2026-09-06T11:32:59.8899111Z    [33m[2m✓[22m[39m repo-local typed scope discovery[2m > [22mexposes the same list and context locators before any active Change exists [33m 2669[2mms[22m[39m
2026-09-06T11:32:59.8911670Z    [33m[2m✓[22m[39m repo-local typed scope discovery[2m > [22mdoes not adopt a standalone scope when Store metadata cannot be read [33m 1390[2mms[22m[39m
2026-09-06T11:32:59.8939840Z    [33m[2m✓[22m[39m repo-local typed scope discovery[2m > [22mkeeps an unregistered legacy Store scope-less and refuses archive without writes [33m 2528[2mms[22m[39m
```

## Linux — full suite

[Job101477630638](https://github.com/DumoeDss/rasen/actions/runs/34029988895/job/101477630638); source log lines5626–5629.

```text
2026-09-06T11:34:10.6864739Z [2m Test Files [22m [1m[32m432 passed[39m[22m[90m (432)[39m
2026-09-06T11:34:10.6904732Z [2m      Tests [22m [1m[32m7618 passed[39m[22m[2m | [22m[33m40 skipped[39m[90m (7658)[39m
2026-09-06T11:34:10.6905523Z [2m   Start at [22m 11:21:42
2026-09-06T11:34:10.6921722Z [2m   Duration [22m 747.81s[2m (transform 17.69s, setup 4.55s, collect 249.43s, tests 2591.50s, environment 145ms, prepare 55.14s)[22m
```

## Separate timeout observation

```text
2026-09-06T11:39:02.4903001Z [41m[1m FAIL [22m[49m test/commands/store-root-selection.test.ts[2m > [22mstore root selection for normal commands[2m > [22marchive --json is non-interactive[2m > [22mkeeps stdout pure when REMOVED deltas target a new spec
2026-09-06T11:39:02.4934145Z [31m[1mError[22m: Test timed out in 30000ms.
2026-09-06T11:39:02.4935452Z If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".[39m
2026-09-06T11:39:02.4937135Z [36m [2m❯[22m test/commands/store-root-selection.test.ts:[2m719:5[22m[39m
```
