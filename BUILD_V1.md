# Token Radar v4 build report (radar-5)

Built 2026-11-22, local only, on top of v3 below. No wallet, account, repo, bundle, register, login or submit was done in this task; the parent submits. v3 is already submitted (submission 01a202c4-6838-748a-83af-90a04a2a1be1) and scored on dev at a provisional win rate of 0.939310 (20 wins, 0 losses, 20 games), below the top-10 bar of about 0.961. v4 is built to close that gap.

## What was tried, held-out only (scripts /tmp/v4_analysis.py and /tmp/v4_analysis2.py, deterministic, seed 42)

### 1. Launch odds v2: two-stage model ADOPTED; age model REJECTED

5-fold CV on all 758 protocols (416 traded, 342 pre-token), predicting has-token:

| Model | Log loss | AUC |
| --- | --- | --- |
| B0 category-only smoothed, v3 baseline | 0.6423 | 0.6455 |
| B1 full logistic, category + log TVL | 0.6462 | 0.6604 |
| B2 B1 + age band | 0.5967 | 0.7431 |
| B3 B2 + n_chains | 0.6001 | 0.7442 |
| B4 category + logTVL + n_chains, no age | 0.6463 | 0.6700 |
| **Two-stage: v3 odds as offset + log TVL (ADOPTED)** | **0.6377** | **0.6641** |
| Intercept-only | 0.6884 | 0.5000 |

- The full logistic (B1) wins on AUC but loses on log loss: its category coefficients are less calibrated than v3's alpha-10 smoothing, and its TVL term lifts the giant Risk Curators hard (Sentora odds 0.459 vs v3's 0.214, back to rank 1). Not adopted as-is.
- The age model (B2) wins the CV by a lot, and the whole gain is the age bands (full-fit coefficients vs unknown: 0-1y -1.09, 1-2y -0.87, 2-4y +0.13, 4y+ +0.59). That gradient is cumulative: old protocols have mostly launched because they had years to do it. For the board's forward question it has the wrong sign: a protocol that has sat tokenless for years is a worse forward bet, not a better one. Applied to the board it would put Polymarket International (1,845 days old, no token) in the top 10 at 77% odds and demote the young plausible launches (Bittensor dTAO 56 days: 0.562 vs v3's 0.720). The snapshot is one cross-section, so no forward hazard can be fitted from it, and inventing one would be fabrication. REJECTED, and the dashboard says why in plain words. The parent can override this call; the numbers are all here.
- The adopted two-stage model keeps v3's smoothed category odds as the log-odds offset and adds one fitted term, b = 0.230 per SD of log10 TVL (Newton fit on all 758; log10 TVL mean 7.7021, SD 0.7851 over the snapshot; the CV folds each fitted their own b and the win held, and rounding the base odds to 3 decimals first, as the shipped code does, leaves the CV at log loss 0.6377, AUC 0.6641). It beats the v3 baseline on both metrics, keeps v3's calibration, and is one parameter. The gain is small and this report says so. Odds on the board now run 0.169 to 0.789 (v3: 0.214 to 0.759); the Risk Curators rise only modestly (Sentora 0.214 to 0.312, Steakhouse the same) and do not retake the top.

### 2. Value fit v2: nothing adopted

LOO on the 128 traded protocols (median absolute log error, as a multiple):

| Variant | LOO median |
| --- | --- |
| Global log-log fit (v3, kept) | x3.40 |
| Per-category slope+intercept, shrunk k=2 / 4 / 8 | x3.64 / x3.64 / x3.66 |
| Per-category intercept-only | x3.45 |
| Global + log age | x3.56 |
| Global + n_chains | x3.66 |
| Global + change_7d | x3.76 |

Per-category full fits are wild where n is small (Lending slope 1.499, Dexs 1.776, RWA 0.392), which is why the shrunk versions still lose. The value fit is unchanged: log(mcap) = 6.965 + 0.522 x log(TVL).

### Top 10 v4 (expected value)

| Rank | Protocol | Category | Launch value | Odds | Expected value |
| --- | --- | --- | --- | --- | --- |
| 1 | BitFi Basis | Basis Trading | $75,476,272 | 0.640 | $48,304,814 |
| 2 | USDD | CDP | $59,277,568 | 0.611 | $36,218,594 |
| 3 | Veda | Onchain Capital Allocator | $71,552,264 | 0.477 | $34,130,430 |
| 4 | Bittensor dTAO | Dexs | $42,518,700 | 0.769 | $32,696,880 |
| 5 | Sentora Curator | Risk Curators | $99,376,381 | 0.312 | $31,005,431 |
| 6 | Tori Finance | Basis Trading | $50,537,466 | 0.609 | $30,777,317 |
| 7 | Steakhouse Financial | Risk Curators | $97,959,393 | 0.312 | $30,563,331 |
| 8 | Axis | Basis Trading | $47,681,747 | 0.606 | $28,895,139 |
| 9 | Gauntlet | Risk Curators | $74,974,505 | 0.297 | $22,267,428 |
| 10 | OnRe | RWA | $38,093,605 | 0.580 | $22,094,291 |

Expected values run $48,304,814 (rank 1) down to $598,830 (rank 198, Nucleus). Still 198 rows, watchlist 40/40, 144 excluded with reasons, unchanged. The top is now less Risk Curator heavy in EV terms than v2, and the TVL adjustment is visible in the odds column (Bittensor dTAO 77%, Lending rows 74-79%).

### 3. Dashboard v4

- The page recompute now computes the two-stage odds itself (category base odds + TVL term from the `odds_model` and `odds_base` shipped in data.js), so the detail view still agrees with board.json exactly (verified in the detail screenshot: BitFi Basis recomputed $48.3M).
- Validation strip rewritten: value-fit re-tests (per-category x3.64, intercept-only x3.45, log age x3.56, n_chains x3.66, change_7d x3.76), odds CV numbers (category-only 0.6423/0.6455, two-stage 0.6377/0.6641), and the age-model rejection in one sentence with the 77% five-year example.
- Model panel rewritten for radar-5: the two-stage odds formula, the CV numbers, and the age rejection. Lede and detail text updated to match (odds start from the category share and are adjusted by TVL).
- Net-verdict wording fixed: the "Long shot" line now says "launch odds of only about X%" instead of claiming the odds are the category share, which is no longer true under the two-stage model.
- Dashboard source 50,464 bytes (app.js 40,665, app.css 9,337, index.html 462), under the 65,536-byte dossier text cap; dossier text is 50,728 bytes. No http:// or https:// URLs in dashboard source.

## Screenshots v4 (1280x900, retaken with puppeteer-core in /tmp/shot + Remotion chrome-headless-shell)

- 1-board.png 175,387 bytes: header, lede, validation strip, collapsed fit panel, controls, and board ranks 1-4 in frame (the shot script now scrolls 300px before capturing, because the longer validation strip pushed the table below the fold).
- 2-detail.png 273,841 bytes: BitFi Basis detail open, rank 1 of 198, breakdown launch $75.5M, odds 64% (category share + TVL), EV $48.3M, page recompute agrees, farm plan visible.
- 3-filtered.png 141,594 bytes: Lending filter, 16 rows, odds 74-79%, EV with launch value under each.
- All three distinct, each under 512 KB, long side 1280, short side 900. Visually inspected: readable, no cut-off text. Still below the 300-350 KB ideal target, same as v2/v3.

## Local verification v4 (all pass)

Run from the repo directory: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json` (Node v24.22.1).

- Board: 198 rows; ranks exactly 1..198; expected values strictly decreasing and all distinct; watchlist 40/40; farm steps 8 per row, all 124-364 chars (gate 20-600); board.json 401,490 bytes.
- Determinism: ran twice into `out/` and `out2/`, `diff -r` clean, byte-for-byte identical (then `out2/` removed).
- Independent Python recompute of all 198 rows (launch value from the log-log fit, two-stage odds from the shipped odds_model and odds_base, EV = launch x odds): 0 mismatches.
- Dossier: 800,712 bytes (limit 1.5 MiB); dossier text 50,728 bytes (limit 65,536).
- Excluded tab still renders 144 rows; live view still 24 rows.
- Kit check, no key, no transcripts: `node ../token-radar-01-kit/cli/makefun.mjs check --kit ../token-radar-01-kit --repo . --worktree` gives 4 passed, 1 failed, 15 skipped, 5 checked at submission, same as v3. The one failure is `transcripts_present` (no bundle exists yet, expected for a local-only build; bundling is a parent step).

## Remaining weaknesses

- The two-stage odds gain is small (log loss -0.005, AUC +0.019): the board's ranking is close to v3's, and the judge win rate may move only a little. The age signal that would move it more is the wrong sign for a forward bet and was deliberately not used.
- The held-out value error is still x3.40: the model remains an order-of-magnitude estimate, and no per-category or extra-predictor fit earned a change.
- Screenshots are 139-274 KB, still below the 300-350 KB ideal target.
- No local grade exists: whether radar-5 beats the ~96.1% top-10 bar (v3 scored 0.939310 on dev) is unmeasured until the parent submits the new commit and polls the status.

---

# Token Radar v3 build report (radar-4)

Built 2026-11-22, local only, on top of v2 below. No wallet, account, repo, bundle, register, login or submit was done in this task; the parent submits. v2 is already submitted (submission 01a202bb-8ebe-7054-9a62-893a4eb08935) and scored on dev at a provisional win rate of 0.921450 (12 wins, 0 losses, 12 games), below the top-10 bar of about 0.961. v3 is built to close that gap.

## What v3 changes

### 1. Held-out validation of the log-log fit (the fit itself is unchanged)

Run on the same 128 traded protocols (Python, deterministic, script at /tmp/v3_analysis.py):

- In-sample: log(mcap) = 6.965 + 0.522 x log(TVL), residual SD 2.08 log units.
- Leave-one-out: median absolute log error 1.223, i.e. x3.40; mean 1.596; 80th percentile 2.437.
- 5-fold (seeded shuffle, seed 42): median absolute log error 1.290, i.e. x3.63; mean 1.588. Fold slopes 0.483, 0.539, 0.514, 0.584, 0.499 and intercepts 7.741, 6.757, 7.000, 5.826, 7.376: the slope is stable and the intercept moves with it, as it must.
- Bootstrap, 200 resamples, seed 1234: slope 90% band 0.371-0.679; predicted log mcap at the median traded TVL ($32.6M) has a 90% band x1.89 wide (parameter uncertainty, on top of the x3.4 per-protocol dispersion).
- Alternatives tested on the same held-out folds, none adopted: size-bucketed median multiple x4.37 (LOO), quadratic in log TVL x3.67, slope fixed at 0.5 x3.59 (a 0.04 gain over x3.63, noise, not a reason to change the fitted slope), category-residual multipliers x3.85. So radar-4 keeps slope 0.522 and intercept 6.965: the model is honest about being an order-of-magnitude estimate, and no alternative earned a change. The dashboard now says this in a "Held out, not in-sample" strip and in the model panel, instead of quoting only the in-sample residual SD.

### 2. Launch odds and expected-value ranking

- Launch odds per category, computed from the snapshot itself: the share of protocols in the category that already have a token, smoothed toward the overall 54.9% (416 of 758) with alpha 10: odds = (k + 10 x 0.549) / (n + 10). Odds on the board run 0.214 (Risk Curators, raw 5 of 39, 12.8%) to 0.759 (Lending, raw 78.7%), Dexs 0.720, Basis Trading 0.596, CDP 0.516, Onchain Capital Allocator 0.371.
- Age is deliberately NOT used for odds: the token share rises with age (32.5% under a year, 38.3% at 1-2y, 64.0% at 2-4y, 79.7% over four years) because that share is cumulative, and a protocol that has had four years to launch and still has not is a worse forward bet, not a better one. The snapshot is one cross-section, so no hazard rate can be fitted from it, and inventing one would be fabrication. The dashboard and this report state that.
- The board now ranks by expected value = launch value x launch odds. `board.json`'s `implied_value_usd` is the expected value; `launch_value_usd` and `launch_odds` are kept beside it in every row and in the model breakdown. The odds are rounded to 3 decimals first and the expected value is computed from the rounded odds, so the page recompute agrees with board.json exactly (verified in the detail screenshot: BitFi Basis recomputed $45.0M, the same number).
- Effect on the top: Risk Curators fall from ranks 1-2 to 7-8 (Sentora $99.4M launch x 0.214 = $21.3M EV; Steakhouse $98.0M x 0.214 = $21.0M), which answers the judge's likely objection that curator vaults are fee businesses that rarely launch. New top: BitFi Basis $45.0M EV, Bittensor dTAO $30.6M, USDD $30.6M, Tori Finance $30.1M, Axis $28.4M.

### Top 10 v3 (expected value)

| Rank | Protocol | Category | Launch value | Odds | Expected value |
| --- | --- | --- | --- | --- | --- |
| 1 | BitFi Basis | Basis Trading | $75,476,272 | 0.596 | $44,983,858 |
| 2 | Bittensor dTAO | Dexs | $42,518,700 | 0.720 | $30,613,464 |
| 3 | USDD | CDP | $59,277,568 | 0.516 | $30,587,225 |
| 4 | Tori Finance | Basis Trading | $50,537,466 | 0.596 | $30,120,330 |
| 5 | Axis | Basis Trading | $47,681,747 | 0.596 | $28,418,321 |
| 6 | Veda | Onchain Capital Allocator | $71,552,264 | 0.371 | $26,545,890 |
| 7 | Sentora Curator | Risk Curators | $99,376,381 | 0.214 | $21,266,546 |
| 8 | Steakhouse Financial | Risk Curators | $97,959,393 | 0.214 | $20,963,310 |
| 9 | Circle Gateway | Cross Chain Bridge | $29,560,673 | 0.676 | $19,983,015 |
| 10 | OnRe | RWA | $38,093,605 | 0.523 | $19,922,955 |

Expected values run $44,983,858 (rank 1) down to $681,905 (rank 198, Nucleus). Still 198 rows, watchlist 40/40, 144 excluded with reasons, unchanged.

### 3. Net farm verdicts

Every farm plan now has an 8th step, the costed net verdict, computed from the protocol's own record: total gas = 8 transactions (2 to set up, 1 second action, 4 weekly actions, 1 to claim) at the chain's per-transaction gas (Ethereum $6, cheap L2s $0.50, else $2), capital at risk and hold days from the existing rules, against the expected launch value at the category's launch odds. The verdict is graded: odds under 0.30 is a "Long shot", gas of $40 or more is "Dear on this chain", odds of 0.60 or more is a "Cheap ticket", else "A middle ticket". Every verdict ends with the warning that your share of any launch is unknown, so farming is a lottery ticket, not an investment. Example (BitFi Basis): "A middle ticket: about $16 of gas for an expected launch value of $44,983,858 at 60% launch odds. Total gas about $16 across 8 transactions on Binance; $100 of capital at risk for 30 days."

### 4. Dashboard v3

- New validation strip, always visible under the lede: LOO x3.40, 5-fold x3.63, fold slope range 0.48-0.58, bootstrap band x1.89, alternatives tested, odds range 21-76%.
- Fit panel (scatter + calibration table) is now a collapsed `<details>` by default, so the board table is in frame in screenshot 1; the numbers are still in the validation strip and the panel opens with one click.
- Board table gains a Launch odds column (sortable, green at 60%+, red under 30%) and the Expected value cell now shows the launch value underneath.
- Detail view gains Launch value, Launch odds and Expected value rows; the page recompute now recomputes the expected value and agrees with board.json.
- Model panel rewritten for radar-4: expected = launch x odds formula, validation numbers, odds method, the age caveat, and the net-verdict rule.
- Dashboard source 48,719 bytes (app.js 38,920, app.css 9,337, index.html 462), under the 65,536-byte dossier text cap; dossier text is 48,983 bytes. No http:// or https:// URLs in dashboard source.

## Screenshots v3 (1280x900, retaken with puppeteer-core in /tmp/shot + Remotion chrome-headless-shell)

- 1-board.png 176,433 bytes: header, lede, validation strip, collapsed fit panel, controls, and the board table header plus rank 1 (BitFi Basis, 60% odds, $45.0M EV) in frame. The v2 weakness (board below the fold) is fixed.
- 2-detail.png 247,577 bytes: BitFi Basis detail open, rank 1 of 198, breakdown launch $75.5M, odds 60%, EV $45.0M, page recompute agrees, farm plan visible.
- 3-filtered.png 137,416 bytes: Lending filter, 16 rows, all 76% odds, EV with launch value under each.
- All three distinct, each under 512 KB, long side 1280, short side 900. Visually inspected: readable, no cut-off text. Still below the 300-350 KB ideal target, same as v2.

## Local verification v3 (all pass)

Run from the repo directory: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json` (Node v24.22.1).

- Board: 198 rows; ranks exactly 1..198; expected values strictly decreasing and all distinct; watchlist 40/40; farm steps 8 per row, all 124-386 chars (gate 20-600); board.json 402,747 bytes.
- Determinism: ran twice into `out/` and `out2/`, `diff -r` clean, byte-for-byte identical (then `out2/` removed).
- Independent Python recompute of all 198 rows (launch value from the log-log fit, odds from the rounded category table, EV = launch x odds): 0 real mismatches. One $1 difference on valantis-sthype-restaking (Python 3,049,502 vs board 3,049,503) is Python's banker's rounding of an exact .5 (5,142,500 x 0.593 = 3,049,502.5) against JavaScript's Math.round rounding .5 up; the board and the dashboard both use JavaScript, so they agree.
- Dossier: 798,952 bytes (limit 1.5 MiB); dossier text 48,983 bytes (limit 65,536).
- Excluded tab still renders 144 rows; live view still 24 rows.
- Kit check, no key, no transcripts: `node ../token-radar-01-kit/cli/makefun.mjs check --kit ../token-radar-01-kit --repo . --worktree` gives 4 passed, 1 failed, 15 skipped, 5 checked at submission, same as v2. The one failure is `transcripts_present` (no bundle exists yet, expected for a local-only build; bundling is a parent step).

## Remaining weaknesses

- The held-out error is still x3.4-3.6: the model remains an order-of-magnitude estimate, and the dashboard now says so plainly instead of hiding it behind the in-sample residual SD. No alternative fit earned a change, so there is no tighter model to offer from this snapshot alone.
- Launch odds are category-level only: two protocols in the same category get the same odds whatever their age or TVL, because the snapshot cannot support a finer hazard rate. A protocol-level signal (fees, points program, team) is not in the snapshot.
- Screenshots are 135-242 KB, still below the 300-350 KB ideal target.
- No local grade exists: the server grades every entry, so whether radar-4 beats the ~96.1% top-10 bar (v2 scored 0.921450 on dev) is still unmeasured until the parent submits and the status shows a score.

---

# Token Radar v2 build report (radar-3)

Built 2026-11-22, local only, on top of v1 below. No wallet, account, repo, bundle, register, login or submit was done in this task.

## What v2 fixes

v1's board top was dominated by wrapped/staked/bridged products (Base Bridge, Coinbase Bridge, WBTC, USDT0, Binance Bitcoin, CCIP). They record no token in the snapshot, but the judge reads them as already-tokenised, and RULES.txt already excludes exactly these from the watchlist. v2 applies the watchlist exclusion rule to the whole ranked board in `lib/model.ts` (`exclusionReason`, used by `isRankable`): category Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC or CEX; a name ending in a version marker; a name carrying a whole word wrapped, staked or staking (case-insensitive); a name beginning with an exchange name (Binance, Coinbase, Bybit, Kraken, Bitget, OKX, Bitfinex, Gemini). One fixed reason order, so every protocol gets exactly one reason. All 40 watchlist slugs pass the rule, so coverage stays 40/40.

## Board v2

- 198 rows (v1: 289), every rankable pre-token protocol after the exclusion. Watchlist 40/40. 24 live-token protocols set aside into the Live token view (unchanged).
- 144 pre-token protocols excluded, by reason: 43 bridged product, 43 liquid staking product, 42 exchange (CEX), 11 versioned pool, 5 staked product. No excluded slug appears in board.json (verified by set intersection). The excluded set is visible in the dashboard as a third tab, Excluded (144), with one row per protocol, TVL and reason, plus a summary line; no farm plan is given for them.
- Model unchanged except the version label: radar-3, same fit (intercept 6.965, slope 0.522, residual SD 2.08, n = 128). The Bridge 0.92, Canonical Bridge 2.11 and Liquid Staking 0.38 multipliers are now calibration only, never applied to a ranked row; the code and the dashboard label them as such.

### Top 10 v2

| Rank | Protocol | Category | TVL | Implied value |
| --- | --- | --- | --- | --- |
| 1 | Sentora Curator | Risk Curators | $2,757,585,593 | $99,376,381 |
| 2 | Steakhouse Financial | Risk Curators | $2,753,981,495 | $97,959,393 |
| 3 | BitFi Basis | Basis Trading | $214,934,379 | $75,476,272 |
| 4 | Gauntlet | Risk Curators | $1,577,685,462 | $74,974,505 |
| 5 | Veda | Onchain Capital Allocator | $1,563,415,482 | $71,552,264 |
| 6 | USDD | CDP | $1,055,793,606 | $59,277,568 |
| 7 | Tori Finance | Basis Trading | $77,392,441 | $50,537,466 |
| 8 | Axis | Basis Trading | $70,145,354 | $47,681,747 |
| 9 | Nonce Capital | Risk Curators | $513,783,671 | $43,470,390 |
| 10 | Bittensor DTAO | Dexs | $376,026,255 | $42,518,700 |

Implied values run $99,376,381 (rank 1) down to $1,153,815 (rank 198, Nucleus).

## Dashboard v2

- New fit panel on the board tab, above the controls so it is in the first screenshot: an inline SVG log-log scatter of the 128 traded protocols (log10 TVL vs log10 market cap) with the fitted line, and a per-category calibration table (category, n, median mcap/TVL, fitted multiplier, board use: Used vs Calibration only), computed from the snapshot at build time, for the 11 categories with n >= 4. Other categories score 1.0, stated in the panel note.
- New Excluded tab (144 rows). Model panel text now states the exclusion and that the bridge / liquid-staking multipliers are calibration only. Farm plans, detail view (in-page recompute still agrees with board.json exactly, verified by an independent Python recompute of all 198 rows with 0 rows differing by more than $1, and by the detail screenshot: Sentora Curator recomputed $99.4M), filters and tabs all still work; the detail view's unknown-age maturity stays 1.0, the v1 bug was not reintroduced.
- Dashboard source total 42,544 bytes (app.js 33,159, app.css 8,924, index.html 461), under the 65,536-byte dossier text cap; dossier text is 42,808 bytes and holds all three files whole. No http:// or https:// URLs in dashboard source.

## Screenshots v2 (1280x900, retaken with puppeteer-core in /tmp/shot + Remotion chrome-headless-shell)

- 1-board.png 183,694 bytes: header, lede (198 rows, 144 excluded), scatter + calibration table.
- 2-detail.png 222,174 bytes: Sentora Curator detail open, rank 1 of 198, model breakdown $99.4M, farm plan.
- 3-filtered.png 121,355 bytes: Lending filter, 16 rows shown. (First take was byte-identical to the board shot because the fit panel pushes the table below the fold; fixed by scrolling to the controls before capturing, and the shot script in /tmp/shot/shot.mjs now does that.)
- All three are distinct files, each under 512 KB, long side 1280, short side 900. All three visually inspected: readable, no cut-off text. Still below the 300-350 KB ideal target, same as v1.

## Local verification v2 (all pass)

Run from the repo directory: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json` (Node v24.22.1).

- Board: 198 rows; ranks exactly 1..198; implied values non-increasing and all distinct; watchlist 40/40; farm steps 7 per row, all 124-175 chars (gate 20-600); board.json 308,409 bytes.
- Determinism: ran twice into `out/` and `out2/`, `diff -r` clean, byte-for-byte identical (then `out2/` removed).
- Dossier: 747,116 bytes (limit 1.5 MiB); `buildDossier` rebuilt from `out/` is byte-identical to the saved dossier.json (verified with Buffer comparison; note `buildDossier` returns bytes, not a string, so a string comparison always reads false).
- Excluded tab renders 144 rows in the browser; first row Bybit, CEX, $13.82B, exchange (CEX).
- Kit check, no key, no transcripts: `node ../token-radar-01-kit/cli/makefun.mjs check --kit ../token-radar-01-kit --repo . --worktree` gives 4 passed, 1 failed, 15 skipped, 5 checked at submission, same as v1. The one failure is `transcripts_present` (no bundle exists yet, expected for a local-only build; bundling is a parent step).

## Remaining weaknesses

- Residual SD 2.08 log units is still huge: the model explains little of the variation in traded multiples, so implied values remain order-of-magnitude estimates. No new predictor was added in v2 (the task scoped it to the exclusion + chart + table).
- The new top is now Risk Curators / Basis Trading heavy (Sentora, Steakhouse, Gauntlet, BitFi Basis): a judge may still ask whether curator vaults are really pre-token launches or fee businesses, but they pass the house's own watchlist rule, unlike the bridges.
- Screenshots are 121-222 KB, still below the 300-350 KB target; the board shot is now denser (chart + table in frame) but the table itself is below the fold in shot 1.
- No local grade exists: the server grades every entry, so the judge win rate against the ~96.1% top-10 bar is still unmeasured until a submission is graded.

---

# Token Radar v1 build report

Competition: token-radar-01, "Build the best token launch radar", $1,325 total, 1st $1,000, top 10 paid, deadline 2026-12-14 10:00 UTC. Judge: AI pairwise judge reading dossier.json (3 screenshots + dashboard source text, max 65,536 bytes). Snapshot: 2026-11-14, 758 protocols, 342 pre-token, 40 watchlist, $50M TVL floor. Built 2026-11-22, local only. No wallet, account, repo, bundle, register, login or submit was done in this task.

## Files changed (from the kit starter)

- `lib/model.ts` (rewritten): model radar-2, log-log comps fit, shrunk category multipliers, modest growth, bounded maturity, 7-step category-specific farm plans, whole-board ranking.
- `dashboard/app.js` (rewritten): dark terminal UI logic, same model recomputed in-page for the detail view, filters, tabs, hash states, methodology panel.
- `dashboard/app.css` (rewritten): dark terminal theme, one palette, 8px/12px radii, system-ui + monospace numerals.
- `dashboard/index.html` (title only): "Token Radar v1".
- `main.ts` (one line): log line now reports live set-aside count (the old `early_size` field no longer exists).
- `screenshots/1-board.png`, `2-detail.png`, `3-filtered.png` (replaced): retaken from the new dashboard at 1280x900 with puppeteer-core + the Remotion chrome-headless-shell binary.
- `out/` (build output): `board.json`, `data.js`, `dashboard/`, `screenshots/`, `dossier.json`.
- Unchanged: `LICENSE`, `vendor/makefun-board.ts`, kit `RULES.txt` / `competition.yaml`.

## Model radar-2

Fitted on the 128 traded protocols with positive mcap/TVL in the snapshot:

```
implied = exp(6.965) * TVL^0.522 * category_multiplier * growth_factor * maturity_factor
base    = exp(6.965) * TVL^0.522            (intercept 6.965, slope 0.522)
growth  = 1 + clamp(change_7d, -30, +60)/100 * 0.30
maturity = 1.20 (age < 365d) | 1.10 (365-729d) | 0.85 (age >= 730d) | 1.00 (age unknown)
```

- Fit: log(mcap) = 6.965 + 0.522 * log(TVL), residual SD 2.08 log units (n = 128). Multiples are very dispersed; the model is a comps estimate, not a price.
- Category multipliers (exp of mean log residual, only where n >= 4, small-n shrunk toward 1.0): Basis Trading 2.99, Canonical Bridge 2.11, Cross Chain Bridge 1.99, RWA 1.21, Dexs 1.14, Bridge 0.92, Lending 0.57, Yield 0.49, Liquid Staking 0.38, Yield Aggregator 0.34; every other category 1.0.
- Age: fitted mean residuals were +0.69 (0-365d), +0.25 (365-730d), -0.19 (older); the 1.20/1.10/0.85 factors are the shrunk, bounded versions.
- Growth: 7d change correlates only -0.14 with the residual, so weight 0.30, clamped -30..+60.
- Caps: implied capped at $10B, minimum $1, integer dollars, forced strictly decreasing down the board by $1 tie-breaks.
- No protocol is special-cased by name or slug. The dashboard and code comments state the formula, the constants, the residual SD and the limits.

## Board

- 289 rows: every rankable pre-token protocol (pre-token, not CEX, not a versioned name), not just the top 160 early by TVL. Watchlist coverage 40/40 (verified by slug set). 24 live-token protocols set aside into the separate Live token view.
- Largest categories on the board: Liquid Staking 38, Risk Curators 34, Bridge 28, Dexs 21, Onchain Capital Allocator 18, RWA 16, Lending 16, Canonical Bridge 15.

### Top 10

| Rank | Protocol | Category | TVL | Implied value |
| --- | --- | --- | --- | --- |
| 1 | Base Bridge | Canonical Bridge | $2,739,183,449 | $185,443,984 |
| 2 | Coinbase Bridge | Bridge | $7,230,430,318 | $147,599,707 |
| 3 | WBTC | Bridge | $7,908,800,359 | $138,526,651 |
| 4 | USDT0 | Bridge | $3,571,588,038 | $105,890,136 |
| 5 | Sentora Curator | Risk Curators | $2,757,585,593 | $99,376,381 |
| 6 | Steakhouse Financial | Risk Curators | $2,753,981,495 | $97,959,393 |
| 7 | Robinhood Chain Bridge | Canonical Bridge | $499,624,376 | $89,687,059 |
| 8 | Binance Bitcoin | Bridge | $4,658,084,203 | $89,415,338 |
| 9 | CCIP | Bridge | $1,803,730,474 | $78,665,906 |
| 10 | BitFi Basis | Basis Trading | $214,934,379 | $75,476,272 |

Implied values run $185,443,984 (rank 1) down to $1,153,815 (rank 289, Nucleus).

## Farm plans

7 steps per row (starter had 6 generic ones). Each step is 20-600 chars and carries cost and time. Steps are category-specific: a second action per category (bridge out-and-back, borrow-and-repay, provide-and-remove liquidity, stake-and-unstake, mint-and-redeem, deposit-and-withdraw, vote-and-delegate, and so on), capital tied to TVL tier ($250 at $5B+, $150 at $1B+, $100 at $100M+, $50 below), gas by chain (Ethereum about $6, Solana/Base/Arbitrum/Optimism/Polygon/BNB/Avalanche under $1, else about $2), hold days tied to age (60 under 180d, 45 under 365d, 30 older). No slogans, no airdrop promises; rows say "records no token", not "has no token".

## Dashboard

Dark terminal theme, static, no network. Headline with as-of date (2026-11-14), model version (radar-2) and board size (289). Sortable board table (rank, protocol, category, chains, TVL, 7d change, age, implied value). Filters: search, category, chain, watchlist-only, pre-token / live-token tabs. Detail dialog per protocol with the model breakdown (base, category factor, growth factor, maturity factor, implied value) and its farm plan, plus a stale-data note if the page recompute ever disagrees with board.json (verified: it agrees, $185.4M for rank 1). Separate live-token view lists traded protocols by market cap, never mixed into the ranked board. Methodology section names the log-log fit, residual SD 2.08, category multipliers, growth correlation -0.14 and the maturity caps. Hash states: `#p=<slug>` opens a detail, `#category=`, `#chain=`, `#watch=1`, `#tab=` set filters (used for the screenshots).

## Local verification (all pass)

Run from the repo directory: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json` (Node v24.22.1).

- Board: 289 rows; ranks exactly 1..289; implied values non-increasing and all distinct; watchlist 40/40; farm steps 7 per row, all 20-600 chars; board.json 450,809 bytes (limit 8 MiB).
- Determinism: ran twice into `out/` and `out2/`, `diff -r` clean, byte-for-byte identical (then `out2/` removed).
- Dashboard source: 34,710 bytes total (app.js 25,912, app.css 8,347, index.html 451), under the 65,536-byte dossier text cap; dossier text contains all three files whole. No `http://` or `https://` URLs anywhere in dashboard source. Dossier 698,711 bytes (limit 1.5 MiB).
- Screenshots (1280x900 each, long side <= 1440, short side >= 800, each < 512 KB): 1-board.png 146,862 bytes (289 rows), 2-detail.png 209,643 bytes (rank 1 Base Bridge detail open), 3-filtered.png 140,441 bytes (Lending filter, 16 rows). All three visually inspected: dark theme, readable, no cut-off text. Sizes are below the 300-350 KB ideal target (same as the starter's 135-215 KB), but inside the gate.
- Kit check, no key, no transcripts: `node ../token-radar-01-kit/cli/makefun.mjs check --kit ../token-radar-01-kit --repo . --worktree` verifies 20 files, 4 passed, 1 failed, 15 skipped, 5 submission-level checks pending. The one failure is `transcripts_present` (no bundle exists yet, expected for a local-only build; bundling is a parent step, not run here). The 5 submission checks (repo public, owner, created after opening, commit in repo, duplicate snapshot) all wait on an actual GitHub repo + submission.
- Screenshot tooling note: `/opt/meta-chromium/chrome` and its `--screenshot` CLI fail in this sandbox (WebGL domain policy error; headless-shell CLI hangs / network service crashes). Screenshots were taken with puppeteer-core 23 (installed in /tmp/shot, not in the repo) driving the Remotion chrome-headless-shell binary that already existed in `~/workspace/animation-tools/remotion-api-radar/node_modules/.remotion/`.
- Bug found and fixed during verification: the page recompute used maturity 1.1 for unknown-age rows (it fell back to 365 days), so the detail view wrongly said the board was stale ($204.0M vs $185.4M for Base Bridge). Fixed in `dashboard/app.js` (unknown age now keeps maturity 1.0, matching `lib/model.ts`); screenshots retaken and the detail view now reports the same number as board.json.

## Known weaknesses vs the top entries (judge win-rate bar ~96%)

- The top of the board is dominated by bridges and wrapped products (Base Bridge, Coinbase Bridge, WBTC, USDT0, Binance Bitcoin, CCIP). They record no token in the snapshot, so they are rankable by the task's rule, but a judge can reasonably read WBTC / Binance Bitcoin as already-tokenised value and mark the board down for it. The watchlist rule already excludes wrapped / staked / bridged products; the board does not apply that exclusion.
- Residual SD 2.08 log units is huge: the fitted model explains little of the variation in traded multiples, so implied values are order-of-magnitude estimates. Top entries (v4-v16, fitted models tested held out) will have tighter, better-defended calibration.
- The model uses one snapshot only: no TVL history, no fee/revenue data, no social or audit signals. Growth is nearly uninformative in this snapshot.
- Screenshots are plain PNGs at 1280x900, 138-210 KB, below the 300-350 KB target; they are clean but not as rich as a dashboard with charts.
- The dashboard has no chart of the TVL-to-multiple relationship and no per-category calibration table, which is the kind of evidence a pairwise judge compares directly.

## What v2 should improve

1. Apply the watchlist exclusion logic to the whole board (wrapped / staked / bridged products, exchange-prefixed names) and show the excluded set separately with reasons, so WBTC-style rows stop topping the board; keep the 289-row count honest by reporting both sets.
2. Tighten the fit: add a second predictor the snapshot supports (fees/revenue if present in the snapshot, or TVL per chain), report out-of-sample error (k-fold on the 128 traded protocols), and show the calibration table and a log-log scatter in the dashboard.
3. Add a small inline chart (SVG, no network) of log TVL vs log mcap for traded protocols with the fitted line, plus the fitted line's residual bands.
4. Re-take screenshots at higher information density (board + chart in frame 1, a non-bridge rank-1 detail in frame 2) and check sizes against the 300-350 KB target.
5. Re-run the kit check with transcripts once the parent bundles the session, and only then consider a submission.
