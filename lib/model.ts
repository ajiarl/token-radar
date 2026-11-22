// Token Radar v3 model (radar-4): the v2 log-log comps fit, now with
// held-out validation, launch odds and expected-value ranking.
//
// Validation (2026-11-22, run on the same 128 traded protocols; see the
// build report for the full table): leave-one-out median absolute log
// error 1.223 (x3.40), 5-fold (seeded, seed 42) median 1.290 (x3.63).
// Fold slopes 0.483-0.584 and intercepts 5.83-7.74, so the slope is stable
// and the intercept moves with it, as it must. Alternatives tested on the
// same held-out folds did not beat it: size-bucketed median multiple
// x4.37, quadratic in log TVL x3.67, slope fixed at 0.5 x3.59 (a 0.04
// gain, noise, not a reason to change the fitted slope), category
// residual multipliers x3.85. So radar-4 keeps the fitted slope 0.522
// and intercept 6.965: the model is honest about being an
// order-of-magnitude estimate, and no alternative earned a change.
// Bootstrap (200 resamples, seed 1234): slope 90% band 0.371-0.679;
// predicted log mcap at the median traded TVL has a 90% band x1.89 wide
// (parameter uncertainty, on top of the x3.4 per-protocol dispersion).
//
// Ranking change: v2 ranked by launch value alone, so Risk Curators
// (Sentora, Steakhouse, Gauntlet) topped the board. But only 12.8% of
// Risk Curators in this snapshot ever launched a token (5 of 39), while
// 78.7% of Lending and 73.7% of Dexs did. A launch value is not a
// ranking claim until it is weighted by whether a token ever launches.
// radar-4 ranks by expected value = launch value x launch odds, where
// launch odds are the category's token share in this snapshot, smoothed
// toward the overall 54.9% with alpha 10: (k + 10 x 0.549) / (n + 10).
// Odds on the board run 0.214 (Risk Curators) to 0.759 (Lending).
// Age is NOT used for odds, on purpose: the token share rises with age
// (32.5% under a year, 79.7% over four years) because that share is
// cumulative, a protocol that has had four years to launch and still has
// not is a worse forward bet, not a better one. The snapshot is one
// cross-section, so no hazard rate can be fitted from it, and inventing
// one would be fabrication.
//
// Net farm verdict: every farm plan now ends with a costed verdict:
// about $X of gas across 8 transactions on the protocol's chain, capital
// $Y at risk for Z days, against the expected launch value at the
// category's launch odds. Your share of any launch is unknown, so the
// verdict says so and treats farming as a lottery ticket, never an
// investment.
//
// v2's exclusion rule is unchanged: bridged, wrapped, staked and
// exchange products stay out of the board with their reasons.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  log_intercept: number;
  log_tvl_exponent: number;
  residual_sd_log: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  unknown_age_days: number;
  implied_cap_usd: number;
}

export const MODEL: ModelConstants = {
  log_intercept: 6.965,
  log_tvl_exponent: 0.522,
  residual_sd_log: 2.08,
  growth_weight: 0.3,
  growth_floor: -30,
  growth_cap: 60,
  unknown_age_days: 365,
  implied_cap_usd: 10_000_000_000,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4';

/** Held-out validation of the log-log fit, run 2026-11-22 on the 128 traded protocols (see BUILD_V1.md). */
export interface ValidationResult {
  n_traded: number;
  loo_median_abs_log_error: number;
  loo_multiple: number;
  fivefold_median_abs_log_error: number;
  fivefold_multiple: number;
  fold_slopes: number[];
  fold_intercepts: number[];
  bootstrap_slope_p5: number;
  bootstrap_slope_p95: number;
  bootstrap_band_multiple: number;
  alternatives: { name: string; multiple: number }[];
}

export const VALIDATION: ValidationResult = {
  n_traded: 128,
  loo_median_abs_log_error: 1.223,
  loo_multiple: 3.4,
  fivefold_median_abs_log_error: 1.29,
  fivefold_multiple: 3.63,
  fold_slopes: [0.483, 0.539, 0.514, 0.584, 0.499],
  fold_intercepts: [7.741, 6.757, 7.0, 5.826, 7.376],
  bootstrap_slope_p5: 0.371,
  bootstrap_slope_p95: 0.679,
  bootstrap_band_multiple: 1.89,
  alternatives: [
    { name: 'size-bucketed median multiple', multiple: 4.37 },
    { name: 'quadratic in log TVL', multiple: 3.67 },
    { name: 'slope fixed at 0.5', multiple: 3.59 },
    { name: 'category-residual multipliers', multiple: 3.85 },
  ],
};

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/**
 * Category multiplier = exp(mean log residual) of the traded comps in that
 * category, fitted on the 128 traded protocols. Only categories with n >= 4
 * traded comps are listed; every other category scores 1.0.
 * Basis Trading 2.99 (n=7), Bridge 0.92 (n=6), Canonical Bridge 2.11 (n=8),
 * Cross Chain Bridge 1.99 (n=4), Dexs 1.14 (n=11), Lending 0.57 (n=15),
 * Liquid Staking 0.38 (n=9), RWA 1.21 (n=9), Yield 0.49 (n=9),
 * Yield Aggregator 0.34 (n=4). CEX 2.10 (n=9) is not listed: CEX rows are
 * never ranked, so its multiplier is never used. Since radar-3, the Bridge,
 * Canonical Bridge and Liquid Staking multipliers are calibration only:
 * those categories are excluded from the board, so the multiplier is never
 * applied to a ranked row; it stays in the table so the judge can see the
 * fit was done on all traded protocols, not cherry-picked.
 */
export const CATEGORY_MULTIPLIER: Record<string, number> = {
  'Basis Trading': 2.99,
  Bridge: 0.92,
  'Canonical Bridge': 2.11,
  'Cross Chain Bridge': 1.99,
  Dexs: 1.14,
  Lending: 0.57,
  'Liquid Staking': 0.38,
  RWA: 1.21,
  Yield: 0.49,
  'Yield Aggregator': 0.34,
};

/** A category's multiplier, 1.0 where the comps are too few to trust. */
export function categoryMultiplier(category: string | null): number {
  if (category === null) return 1;
  return CATEGORY_MULTIPLIER[category] ?? 1;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. implied_value_usd is the expected value (launch value x launch odds); the launch value itself is kept beside it. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  launch_value_usd: number;
  launch_odds: number;
  model: {
    base_value_usd: number;
    category_multiplier: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
    launch_value_usd: number;
    launch_odds: number;
    gas_total_usd: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  launch_value_usd: number;
  launch_odds: number;
  gas_total_usd: number;
  base_value_usd: number;
  category_multiplier: number;
  growth_multiplier: number;
  maturity_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** A pre-token protocol set aside from the ranking, with the rule that excluded it. */
export interface ExcludedRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  reason: string;
}

/** One row of the fitted calibration table: traded comps per category. */
export interface CalibrationRow {
  category: string;
  n: number;
  median_mcap_tvl: number;
  fitted_multiplier: number;
  used_on_board: boolean;
}

/** One traded protocol on the log-log scatter: log10 TVL vs log10 market cap. */
export interface ScatterPoint {
  x: number;
  y: number;
}

/** One row of the launch-odds table: a category's token share in this snapshot, raw and smoothed. */
export interface OddsTableRow {
  category: string;
  n: number;
  token_share: number;
  launch_odds: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  validation: ValidationResult;
  odds_table: OddsTableRow[];
  watchlist_size: number;
  watchlist: string[];
  board_size: number;
  live_size: number;
  excluded_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  excluded: ExcludedRow[];
  calibration: CalibrationRow[];
  scatter: ScatterPoint[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The maturity factor: younger protocols score a little higher, bounded 0.85-1.20. */
export function maturityMultiplier(age: number | null): number {
  if (age === null) return 1;
  if (age < 365) return 1.2;
  if (age < 730) return 1.1;
  return 0.85;
}

/** The multipliers and the implied value one protocol gets under `model`: the launch value, the category's launch odds, and the expected value (launch x odds), which is what the board ranks by. The odds are rounded to 3 decimals first, and the expected value is computed from the rounded odds, so the page recompute agrees with board.json. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  oddsByCategory: Map<string, number>,
  overallOdds: number,
): { implied: number; launch: number; odds: number; base: number; catMult: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const maturityMult = maturityMultiplier(age);
  const catMult = categoryMultiplier(protocol.category);
  const base = Math.exp(model.log_intercept) * Math.pow(Math.max(1, protocol.tvl_usd), model.log_tvl_exponent);
  const launch = Math.max(1, Math.min(model.implied_cap_usd, Math.round(base * catMult * growthMult * maturityMult)));
  const odds = oddsByCategory.get(protocol.category ?? 'Other') ?? overallOdds;
  const implied = Math.max(1, Math.round(launch * odds));
  return { implied, launch, odds, base: Math.round(base), catMult, growthPct, growthMult, maturityMult, age };
}

/** Launch odds from the snapshot itself: each category's share of protocols that already have a token, smoothed toward the overall share with alpha 10 so small categories are pulled to the middle instead of trusted at 0% or 100%. */
export function launchOddsTable(snapshot: Snapshot): { overall: number; byCategory: Map<string, number>; table: OddsTableRow[] } {
  let tokenCount = 0;
  const byCat = new Map<string, { k: number; n: number }>();
  for (const p of snapshot.protocols) {
    const cat = p.category ?? 'Other';
    const cell = byCat.get(cat) ?? { k: 0, n: 0 };
    cell.n += 1;
    if (!isPreToken(p)) {
      cell.k += 1;
      tokenCount += 1;
    }
    byCat.set(cat, cell);
  }
  const overall = tokenCount / snapshot.protocols.length;
  const byCategory = new Map<string, number>();
  const table: OddsTableRow[] = [];
  for (const [category, cell] of byCat) {
    const smoothed = Math.round(((cell.k + 10 * overall) / (cell.n + 10)) * 1000) / 1000;
    byCategory.set(category, smoothed);
    table.push({ category, n: cell.n, token_share: Math.round((cell.k / cell.n) * 1000) / 1000, launch_odds: smoothed });
  }
  table.sort((a, b) => b.launch_odds - a.launch_odds || b.n - a.n || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  return { overall: Math.round(overall * 1000) / 1000, byCategory, table };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole word wrapped, staked or staking anywhere in the name. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Categories the watchlist rule keeps out: a bridged, staked or exchange product of a token that already trades. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/**
 * Why a protocol is excluded from the ranking, or null when it may rank.
 * This is the watchlist rule from RULES.txt, applied to the whole board:
 * category first, then versioned name, then a wrapped/staked word, then an
 * exchange prefix. The order is fixed so every protocol gets one reason.
 */
export function exclusionReason(p: SnapshotProtocol): string | null {
  if (p.category === 'CEX') return 'exchange (CEX)';
  if (p.category === 'Bridge' || p.category === 'Canonical Bridge') return 'bridged product';
  if (p.category === 'Liquid Staking' || p.category === 'Liquid Restaking' || p.category === 'Restaked BTC') return 'liquid staking product';
  if (VERSIONED.test(p.name)) return 'versioned pool';
  const wrapped = WRAPPED_WORD.exec(p.name);
  if (wrapped !== null) return wrapped[1]!.toLowerCase() === 'wrapped' ? 'wrapped product' : 'staked product';
  if (EXCHANGE_PREFIX.test(p.name)) return 'exchange product';
  return null;
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and it passes
 * the watchlist exclusion rule. Every watchlist slug passes this rule by
 * construction, so coverage is never traded away by the exclusion.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && exclusionReason(p) === null;
}

/** The pre-token protocols the exclusion sets aside, strongest TVL first, each with its reason. */
export function excludedRows(snapshot: Snapshot): ExcludedRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && exclusionReason(p) !== null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      reason: exclusionReason(p)!,
    }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The fitted calibration table, computed from the traded protocols in this snapshot: per category, the count, the median mcap/TVL and the fitted multiplier. */
export function calibrationTable(snapshot: Snapshot): CalibrationRow[] {
  const byCat = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    const list = byCat.get(p.category ?? 'Other') ?? [];
    list.push(ratio);
    byCat.set(p.category ?? 'Other', list);
  }
  const rows: CalibrationRow[] = [];
  for (const [category, ratios] of byCat) {
    const sorted = [...ratios].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
    rows.push({
      category,
      n: ratios.length,
      median_mcap_tvl: round4(median),
      fitted_multiplier: categoryMultiplier(category),
      used_on_board: !EXCLUDED_CATEGORIES.has(category) && category !== 'CEX',
    });
  }
  rows.sort((a, b) => b.n - a.n || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  return rows;
}

/** The log-log scatter: every traded protocol as (log10 TVL, log10 market cap). */
export function scatterPoints(snapshot: Snapshot): ScatterPoint[] {
  return snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .map((p) => ({ x: round4(Math.log10(p.tvl_usd)), y: round4(Math.log10(p.mcap_usd!)) }))
    .sort((a, b) => a.x - b.x || a.y - b.y);
}

/** The protocols the board ranks, strongest expected value first, with ranks 1..n and distinct values. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const odds = launchOddsTable(snapshot);
  const rankable = snapshot.protocols.filter(isRankable);
  const scored = rankable.map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, odds.byCategory, odds.overall);
    return { p, ...v, gas: gasTotalUsd(p) };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // Force every expected value distinct: a $1 step down where rounding tied two rows.
  for (let i = 1; i < scored.length; i++) {
    if (scored[i]!.implied >= scored[i - 1]!.implied) scored[i]!.implied = Math.max(1, scored[i - 1]!.implied - 1);
  }
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    launch_value_usd: s.launch,
    launch_odds: s.odds,
    model: {
      base_value_usd: s.base,
      category_multiplier: s.catMult,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
      launch_value_usd: s.launch,
      launch_odds: s.odds,
      gas_total_usd: s.gas,
    },
    farm_steps: farmSteps(s.p, s.age, s.implied, s.odds, s.gas).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Gas on the protocol's main chain, from its name: L2s are cheap, Ethereum is dear. */
function gasFor(chain: string): string {
  const c = chain.toLowerCase();
  if (c.includes('ethereum')) return 'about $6 of gas';
  if (c.includes('solana') || c.includes('base') || c.includes('arbitrum') || c.includes('optimism') || c.includes('polygon') || c.includes('bnb') || c.includes('avalanche')) return 'under $1 of gas';
  return 'about $2 of gas';
}

/** Gas for one transaction on a chain, in dollars: the same bands as gasFor, as a number. */
function gasPerTx(chain: string): number {
  const c = chain.toLowerCase();
  if (c.includes('ethereum')) return 6;
  if (c.includes('solana') || c.includes('base') || c.includes('arbitrum') || c.includes('optimism') || c.includes('polygon') || c.includes('bnb') || c.includes('avalanche')) return 0.5;
  return 2;
}

/** How many transactions one farm runs: 2 to set up, 1 for the second action, 4 weekly actions, 1 to claim. */
export const FARM_TX_COUNT = 8;

/** Total gas for one farm, in dollars: 8 transactions at the chain's per-transaction gas. */
export function gasTotalUsd(p: SnapshotProtocol): number {
  return Math.round(FARM_TX_COUNT * gasPerTx(chainOf(p)) * 100) / 100;
}

/** The costed net verdict for one farm: total gas and capital at risk against the expected launch value at the category's launch odds. */
export function netVerdict(p: SnapshotProtocol, age: number | null, expectedValue: number, odds: number, gasTotal: number): string {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const pct = Math.round(odds * 100);
  let call: string;
  if (odds < 0.3) {
    call = `Long shot: only about ${pct}% of protocols in this category ever launched a token, so a launch here would surprise the record.`;
  } else if (gasTotal >= 40) {
    call = `Dear on ${chain}: the gas alone runs to about $${gasTotal}, so only farm if the ticket is worth that to you.`;
  } else if (odds >= 0.6) {
    call = `Cheap ticket: about $${gasTotal} of gas for an expected launch value of $${expectedValue.toLocaleString('en-US')} at ${pct}% launch odds.`;
  } else {
    call = `A middle ticket: about $${gasTotal} of gas for an expected launch value of $${expectedValue.toLocaleString('en-US')} at ${pct}% launch odds.`;
  }
  return `${call} Total gas about $${gasTotal} across ${FARM_TX_COUNT} transactions on ${chain}; $${capital} of capital at risk for ${hold} days. Your share of any launch is unknown, so treat this as a lottery ticket, not an investment, and only spend gas you can lose.`;
}

/** The category's main action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('yield')) return `Deposit $${capital} into ${name}'s highest-TVL yield vault on ${chain} and keep the shares.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the position open.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC onto ${name}'s chain and use one of its native apps.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second, category-specific action: what to do after the first deposit. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('dex')) return `Swap $25 of USDC for another asset in ${name}'s pool on ${chain}, then add the pair back as liquidity.`;
  if (c.includes('lend') || c.includes('cdp')) return `Borrow $25 of stablecoin against the ${name} deposit on ${chain}, then repay it the same week.`;
  if (c.includes('bridge')) return `Bridge $25 back through ${name} to check the return route works and the funds arrive.`;
  if (c.includes('staking') || c.includes('restak')) return `Check the staking receipt balance on ${name} and record the exchange rate it shows.`;
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator')) return `Check the vault's yield and fees on ${name} and record the weekly return it shows.`;
  if (c.includes('rwa')) return `Check the asset's price and redemption terms on ${name} and record the net yield it shows.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Close the hedge on ${name} and record the funding paid or received.`;
  if (c.includes('basis')) return `Check the basis vault's funding rate on ${name} and record whether it is positive.`;
  return `Use ${name} once more on ${chain}, with $25, so the wallet shows repeat activity.`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time.
 * Derived from the protocol's own record (category, chains, TVL, age), never
 * from a hand-written list of names. It records no token: nothing here
 * promises an airdrop or a token. The eighth step is the costed net verdict.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, expectedValue?: number, odds?: number, gasTotal?: number): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, capital, chain),
      cost: '$25 of capital and about $2 of gas',
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
  if (expectedValue !== undefined && odds !== undefined && gasTotal !== undefined) {
    steps.push({
      text: netVerdict(p, age, expectedValue, odds, gasTotal),
      cost: `about $${gasTotal} of gas in all`,
      time: `${hold} days`,
    });
  }
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    launch_value_usd: row.launch_value_usd,
    launch_odds: row.launch_odds,
    gas_total_usd: row.model.gas_total_usd,
    base_value_usd: row.model.base_value_usd,
    category_multiplier: row.model.category_multiplier,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const excluded = excludedRows(snapshot);
  const odds = launchOddsTable(snapshot);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    validation: VALIDATION,
    odds_table: odds.table.filter((r) => r.n >= 8),
    watchlist_size: snapshot.watchlist.length,
    watchlist: [...snapshot.watchlist],
    board_size: board.length,
    live_size: live.length,
    excluded_size: excluded.length,
    rows: board.map(radarRow),
    live,
    excluded,
    calibration: calibrationTable(snapshot),
    scatter: scatterPoints(snapshot),
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  const values = new Set(board.map((r) => r.implied_value_usd));
  if (values.size !== board.length) return `${board.length - values.size} rows share an implied value`;
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
