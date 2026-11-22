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
