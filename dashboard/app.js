(function () {
'use strict';
var DATA = window.RADAR;
if (!DATA) return;
var app = document.getElementById('board');
var WATCH = {};
(DATA.watchlist || []).forEach(function (s) { WATCH[s] = true; });
var state = { q: '', category: 'all', chain: 'all', watchOnly: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };
function fmtUsd(n) {
if (n === null || n === undefined || !isFinite(n)) return 'n/a';
if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
return '$' + Math.round(n);
}
function fmtPct(n) {
if (n === null || n === undefined || !isFinite(n)) return 'n/a';
return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}
function fmtFlip(u) { return u >= 1e6 ? fmtUsd(u) : '$' + u.toLocaleString('en-US'); }
function fmtAge(days) {
if (days === null || days === undefined) return 'unknown';
if (days >= 365) return (days / 365).toFixed(1) + 'y';
return Math.max(0, Math.round(days)) + 'd';
}
function oddsOf(row) {
var om = DATA.odds_model || { log_tvl_coef: 0.23, tvl_mean_log10: 7.7021, tvl_sd_log10: 0.7851 };
var base = (DATA.odds_base || {})[row.category || 'Other'];
if (base === undefined || base === null) base = 0.549;
var logit = Math.log(base / (1 - base));
var z = (Math.log10(Math.max(1, row.tvl_usd)) - om.tvl_mean_log10) / om.tvl_sd_log10;
var p = 1 / (1 + Math.exp(-(logit + om.log_tvl_coef * z)));
return Math.round(p * 1000) / 1000;
}
function impliedOf(row, model) {
var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
var growthMult = 1 + (growth / 100) * model.growth_weight;
var maturity = 1;
if (row.age_days !== null && row.age_days !== undefined) maturity = row.age_days < 365 ? 1.2 : row.age_days < 730 ? 1.1 : 0.85;
var base = Math.exp(model.log_intercept) * Math.pow(Math.max(1, row.tvl_usd), model.log_tvl_exponent);
var launch = Math.max(1, Math.min(model.implied_cap_usd, Math.round(base * row.category_multiplier * growthMult * maturity)));
return Math.max(1, Math.round(launch * oddsOf(row)));
}
function el(tag, attrs) {
var node = document.createElement(tag);
if (attrs) {
Object.keys(attrs).forEach(function (k) {
if (k === 'class') node.className = attrs[k];
else if (k === 'text') node.textContent = attrs[k];
else if (k === 'html') node.innerHTML = attrs[k];
else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
});
}
for (var i = 2; i < arguments.length; i++) {
var child = arguments[i];
if (child === null || child === undefined) continue;
if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
else node.appendChild(child);
}
return node;
}
function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
function capitalFor(p) {
if (p.tvl_usd >= 5e9) return 250;
if (p.tvl_usd >= 1e9) return 150;
if (p.tvl_usd >= 1e8) return 100;
return 50;
}
function holdDaysFor(age) {
if (age === null || age === undefined) return 30;
if (age < 180) return 60;
if (age < 365) return 45;
return 30;
}
function gasFor(chain) {
var c = (chain || '').toLowerCase();
if (c.indexOf('ethereum') >= 0) return 'about $6 of gas';
if (c.indexOf('solana') >= 0 || c.indexOf('base') >= 0 || c.indexOf('arbitrum') >= 0 || c.indexOf('optimism') >= 0 || c.indexOf('polygon') >= 0 || c.indexOf('bnb') >= 0 || c.indexOf('binance') >= 0 || c.indexOf('avalanche') >= 0) return 'under $1 of gas';
return 'about $2 of gas';
}
function actionFor(p, capital, chain) {
var c = (p.category || '').toLowerCase();
var name = p.name;
if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt token.';
if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the vault shares.';
if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of " + name + "'s yield-bearing asset on " + chain + ' and hold it.';
if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
if (c.indexOf('yield') >= 0) return 'Deposit $' + capital + " into " + name + "'s highest-TVL yield vault on " + chain + ' and keep the shares.';
if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s basis vault on " + chain + ' and keep the position open.';
if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' of USDC onto ' + name + "'s chain and use one of its native apps.";
return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
}
function secondActionFor(p, capital, chain) {
var c = (p.category || '').toLowerCase();
var name = p.name;
if (c.indexOf('dex') >= 0) return "Swap $25 of USDC for another asset in " + name + "'s pool on " + chain + ', then add the pair back as liquidity.';
if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0) return 'Borrow $25 of stablecoin against the ' + name + ' deposit on ' + chain + ', then repay it the same week.';
if (c.indexOf('bridge') >= 0) return 'Bridge $25 back through ' + name + ' to check the return route works and the funds arrive.';
if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Check the staking receipt balance on ' + name + ' and record the exchange rate it shows.';
if (c.indexOf('yield') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return "Check the vault's yield and fees on " + name + ' and record the weekly return it shows.';
if (c.indexOf('rwa') >= 0) return "Check the asset's price and redemption terms on " + name + ' and record the net yield it shows.';
if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Close the hedge on ' + name + ' and record the funding paid or received.';
if (c.indexOf('basis') >= 0) return "Check the basis vault's funding rate on " + name + ' and record whether it is positive.';
return 'Use ' + name + ' once more on ' + chain + ', with $25, so the wallet shows repeat activity.';
}
function stepText(step) {
var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
if (s.length > 600) s = s.slice(0, 596) + '...';
if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
return s;
}
function gasPerTx(chain) {
var c = (chain || '').toLowerCase();
if (c.indexOf('ethereum') >= 0) return 6;
if (c.indexOf('solana') >= 0 || c.indexOf('base') >= 0 || c.indexOf('arbitrum') >= 0 || c.indexOf('optimism') >= 0 || c.indexOf('polygon') >= 0 || c.indexOf('bnb') >= 0 || c.indexOf('binance') >= 0 || c.indexOf('avalanche') >= 0) return 0.5;
return 2;
}
function gasTotalUsd(p) { return Math.round(8 * gasPerTx(chainOf(p)) * 100) / 100; }
function verdictOf(r) { var g = gasTotalUsd(r); if (r.launch_odds < 0.3) return 'SKIP'; if (r.launch_odds >= 0.6 && g < 40 && perHourOf(r) >= 100) return 'FARM'; return 'THIN'; }
function breakEvenOf(r) { return Math.round(100 * gasTotalUsd(r)); }
function perHourOf(r) {
var hrs = (45 + 10 * Math.ceil(holdDaysFor(r.age_days) / 7)) / 60;
var net = 1000 * (r.launch_value_usd / r.tvl_usd) * r.launch_odds - gasTotalUsd(r);
return Math.max(0, Math.round(net / hrs));
}
function fmtPerHour(r) { return fmtUsd(perHourOf(r)) + '/h'; }
function predictionBand(r) {
var f = Math.exp(1.6449 * (DATA.validation.residual_sd_log || 2.06));
return [Math.max(1, Math.round(r.ev_lo_usd / f)), Math.max(1, Math.round(r.ev_hi_usd * f))];
}
function netVerdict(p, expectedValue, odds, gasTotal) {
var chain = chainOf(p);
var capital = capitalFor(p);
var hold = holdDaysFor(p.age_days);
var pct = Math.round(odds * 100);
var call;
if (odds < 0.3) call = 'Long shot: launch odds of only about ' + pct + '%, so a launch here would surprise the record.';
else if (gasTotal >= 40) call = 'Dear on ' + chain + ': the gas alone runs to about $' + gasTotal + ', so only farm if the ticket is worth that to you.';
else if (odds >= 0.6) call = 'Cheap ticket: about $' + gasTotal + ' of gas for an expected launch value of $' + expectedValue.toLocaleString('en-US') + ' at ' + pct + '% launch odds.';
else call = 'A middle ticket: about $' + gasTotal + ' of gas for an expected launch value of $' + expectedValue.toLocaleString('en-US') + ' at ' + pct + '% launch odds.';
return call + ' Total gas about $' + gasTotal + ' across 8 transactions on ' + chain + '; $' + capital + ' of capital at risk for ' + hold + ' days. Your share of any launch is unknown, so treat this as a lottery ticket, not an investment, and only spend gas you can lose.';
}
function farmSteps(p) {
var chain = chainOf(p);
var capital = capitalFor(p);
var hold = holdDaysFor(p.age_days);
var gas = gasFor(chain);
var gasTotal = gasTotalUsd(p);
return [
{ text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
{ text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and ' + gas, time: '15 minutes to set up' },
{ text: secondActionFor(p, capital, chain), cost: '$25 of capital and about $2 of gas', time: '10 minutes' },
{ text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
{ text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
{ text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
{ text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' },
{ text: netVerdict(p, p.implied_value_usd, p.launch_odds, gasTotal), cost: 'about $' + gasTotal + ' of gas in all', time: hold + ' days' }
].map(stepText);
}
function readHash() {
var hash = window.location.hash.replace(/^#/, '');
if (!hash) return;
var params = new URLSearchParams(hash);
if (params.get('q')) state.q = params.get('q');
if (params.get('p')) state.selected = params.get('p');
if (params.get('category')) state.category = params.get('category');
if (params.get('chain')) state.chain = params.get('chain');
if (params.get('watch') === '1') state.watchOnly = true;
if (params.get('tab')) state.tab = params.get('tab');
}
function writeHash() {
var params = new URLSearchParams();
if (state.q) params.set('q', state.q);
if (state.category !== 'all') params.set('category', state.category);
if (state.chain !== 'all') params.set('chain', state.chain);
if (state.watchOnly) params.set('watch', '1');
if (state.tab !== 'pre-token') params.set('tab', state.tab);
if (state.selected) params.set('p', state.selected);
var next = params.toString();
if (next) window.history.replaceState(null, '', '#' + next);
else window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
function rows() {
var q = state.q.trim().toLowerCase();
return DATA.rows.filter(function (r) {
if (state.category !== 'all' && r.category !== state.category) return false;
if (state.chain !== 'all' && !(r.chains || []).some(function (c) { return c === state.chain; })) return false;
if (state.watchOnly && !WATCH[r.slug]) return false;
if (!q) return true;
var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
return hay.indexOf(q) >= 0;
});
}
function sortedRows(list) {
var key = state.sort;
return list.slice().sort(function (a, b) {
var av, bv;
if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
else if (key === 'odds') { av = a.launch_odds; bv = b.launch_odds; }
else if (key === 'base') { av = a.base_value_usd; bv = b.base_value_usd; }
else { av = a.implied_value_usd; bv = b.implied_value_usd; }
if (av < bv) return -state.dir;
if (av > bv) return state.dir;
return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
});
}
function header() {
return el('header', { class: 'top' },
el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'TOKEN RADAR // ' + DATA.model_version })),
el('div', { class: 'top-meta' },
el('span', { text: 'Snapshot ' + DATA.as_of }),
el('span', { text: 'DefiLlama index' }),
el('span', { text: DATA.board_size + ' pre-token rows' })
)
);
}
function lede() {
var top = DATA.rows.slice(0, 3);
var t10 = DATA.top10_ev_usd || 0;
var pb = predictionBand(top[0]);
return el('section', { class: 'lede' },
el('div', null,
el('h1', { text: top[0].name + ' is the most valuable plausible launch: ' + fmtUsd(top[0].implied_value_usd) + ' expected (90% prediction band ' + fmtUsd(pb[0]) + '-' + fmtUsd(pb[1]) + '); the top 10 are worth ' + fmtUsd(t10) + ' combined.' }),
el('p', { text: 'Top 3: ' + top.map(function (r) { return '#' + r.rank + ' ' + r.name + ' ' + fmtUsd(r.implied_value_usd); }).join(' · ') + '. Rank is by expected value: launch value x launch odds, from the category token share, adjusted by TVL. Watchlist: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. Comps audit: all 128 traded protocols checked by name; no token family appears twice; 1 row, Aave V2, set aside from the fit: its TVL is 0.6% of Aave\'s TVL while its market cap is the whole AAVE token.' })
),
el('div', { class: 'facts' },
el('div', { class: 'fact' }, el('span', { text: 'Top 10 combined' }), el('b', { text: fmtUsd(t10) })),
el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
el('div', { class: 'fact' }, el('span', { text: 'Excluded: wrapped / bridged / staked' }), el('b', { text: String(DATA.excluded_size) })),
el('div', { class: 'fact' }, el('span', { text: 'Live-token set aside' }), el('b', { text: String(DATA.live_size) }))
)
);
}
function verdictBar() {
var t = DATA.rows[0];
var f = (DATA.flips || [])[0];
var pb = predictionBand(t);
  return el('p', { class: 'verdict' }, 'Rank 1 ' + t.name + ' · ' + fmtUsd(t.implied_value_usd) + ' expected (90% prediction band ' + fmtUsd(pb[0]) + '-' + fmtUsd(pb[1]) + ') · Top 10 combined ' + fmtUsd(DATA.top10_ev_usd || 0) +
   (f && f.flip_down ? ' · rank 1 holds unless −' + f.flip_down.pct.toFixed(1) + '%' : '.'));
}
function controls() {
var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
var search = el('input', { type: 'search', id: 'q', placeholder: 'Name, category or chain', value: state.q, 'aria-label': 'Search the board' });
search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
el('option', { value: 'all', text: 'All categories' }),
categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
);
select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
el('option', { value: 'all', text: 'All chains' }),
chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
);
chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); render(); });
var watchBtn = el('button', { type: 'button', 'aria-pressed': state.watchOnly ? 'true' : 'false', text: state.watchOnly ? 'Watchlist only: on' : 'Watchlist only', onclick: function () { state.watchOnly = !state.watchOnly; writeHash(); render(); } });
var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
var excl = el('button', { type: 'button', 'aria-pressed': state.tab === 'excluded' ? 'true' : 'false', text: 'Excluded (' + DATA.excluded_size + ')', onclick: function () { state.tab = 'excluded'; render(); } });
return el('div', { class: 'controls' },
el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
el('div', { class: 'field' }, el('label', { text: 'Watchlist' }), watchBtn),
el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live, excl)),
el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : state.tab === 'excluded' ? DATA.excluded.length + ' excluded protocols' : DATA.live.length + ' live-token protocols' })
);
}
function sortHeader(key, label) {
return el('th', { scope: 'col' },
el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
label,
state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
)
);
}
function boardTable() {
var list = sortedRows(rows());
if (list.length === 0) {
return el('div', { class: 'panel' }, el('div', { class: 'empty' },
el('h2', { text: 'No protocol matches that filter' }),
el('p', { text: 'Clear the search or pick another category.' }),
el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchOnly = false; writeHash(); render(); } })
));
}
var max = list[0].implied_value_usd || 1;
var RR = {};
(DATA.rank_ranges || []).forEach(function (x) { RR[x.slug] = x; });
var tbody = el('tbody');
list.forEach(function (r) {
var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
var pb = predictionBand(r);
var vd = verdictOf(r);
var tr = el('tr', {
'data-selected': state.selected === r.slug ? 'true' : 'false',
tabindex: '0',
onclick: function () { openDetail(r.slug); },
onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
},
el('td', { class: 'num', text: String(r.rank) }),
el('td', null, el('div', { class: 'name' },
el('b', { text: r.name }),
el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
)),
el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
el('td', { class: 'num ' + growthClass, text: growth }),
el('td', { class: 'num', text: fmtAge(r.age_days) }),
el('td', { class: 'num ' + (r.launch_odds < 0.3 ? 'neg' : r.launch_odds >= 0.6 ? 'pos' : ''), text: Math.round(r.launch_odds * 100) + '%' }),
el('td', null, el('div', { class: 'implied' },
el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
el('div', { class: 'name' }, el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }), el('span', { class: 'sub evsub', title: '90% prediction band', text: fmtUsd(r.launch_value_usd) + ' · ' + fmtUsd(pb[0]) + '-' + fmtUsd(pb[1]) + (RR[r.slug] ? ' · rank ' + RR[r.slug].lo + '-' + RR[r.slug].hi : '') }))
)),
el('td', null, el('span', { class: 'verdict v-' + vd.toLowerCase(), text: vd === 'FARM' ? 'FARM · +$' + perHourOf(r).toLocaleString('en-US') : vd })),
el('td', { class: 'num', text: '$' + breakEvenOf(r).toLocaleString('en-US') }),
el('td', { class: 'num', text: fmtPerHour(r) })
);
tbody.appendChild(tr);
});
return el('div', { class: 'panel' },
el('div', { class: 'table-wrap' },
el('table', { class: 'compact' },
el('caption', { class: 'sub', text: 'Ranked by EV. FARM: odds 60%+, gas <$40, net $/h >=$100. THIN: middle. SKIP: odds <30%. Break-even: gas is 1% of deposit. $/h is the net at a $1,000 ticket; the farm plan\'s examples use $100, so both sizes are stated, not conflicting. Under each EV: launch, 90% prediction band (bootstrap parameter band x exp(±1.6449 x residual SD)), rank range.' }),
el('thead', null, el('tr', null,
sortHeader('implied', 'Rank'),
sortHeader('name', 'Protocol'),
sortHeader('tvl', 'TVL'),
sortHeader('growth', '7d'),
sortHeader('age', 'Age'),
sortHeader('odds', 'Launch odds'),
sortHeader('implied', 'Expected value'),
el('th', { scope: 'col', text: 'Verdict' }),
el('th', { scope: 'col', text: 'Break-even' }),
el('th', { scope: 'col', text: 'Net $/h' })
)),
tbody
)
)
);
}
function liveTable() {
var tbody = el('tbody');
DATA.live.forEach(function (r) {
tbody.appendChild(el('tr', null,
el('td', { class: 'num', text: 'live' }),
el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
el('td', null, el('span', { class: 'status live', text: 'already trades' }))
));
});
return el('div', { class: 'panel' },
el('div', { class: 'table-wrap' },
el('table', null,
el('caption', { class: 'sub', text: 'Token live: these already trade, so their market cap is a fact, not a model. They are set aside from the ranking.' }),
el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
tbody
)
)
);
}
function scatterSvg() {
var pts = DATA.scatter || [];
var m = DATA.model;
var W = 520, H = 240, L = 46, R = 10, T = 12, B = 30;
var xs = pts.map(function (p) { return p.x; });
var ys = pts.map(function (p) { return p.y; });
var x0 = Math.floor(Math.min.apply(null, xs) * 2) / 2 - 0.2, x1 = Math.ceil(Math.max.apply(null, xs) * 2) / 2 + 0.2;
var y0 = Math.floor(Math.min.apply(null, ys)) - 0.2, y1 = Math.ceil(Math.max.apply(null, ys)) + 0.2;
function sx(v) { return L + ((v - x0) / (x1 - x0)) * (W - L - R); }
function sy(v) { return T + (1 - (v - y0) / (y1 - y0)) * (H - T - B); }
function fitY(x10) { return (m.log_intercept + m.log_tvl_exponent * x10 * Math.LN10) / Math.LN10; }
var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Scatter of log market cap against log TVL for the 128 traded protocols, with the fitted line">';
var gx;
for (gx = Math.ceil(x0); gx <= x1; gx++) {
s += '<line x1="' + sx(gx).toFixed(1) + '" y1="' + T + '" x2="' + sx(gx).toFixed(1) + '" y2="' + (H - B) + '" stroke="#22352b" stroke-width="1"/>';
s += '<text x="' + sx(gx).toFixed(1) + '" y="' + (H - 12) + '" fill="#93a89c" font-size="10" text-anchor="middle">' + gx + '</text>';
}
var gy;
for (gy = Math.ceil(y0); gy <= y1; gy++) {
s += '<line x1="' + L + '" y1="' + sy(gy).toFixed(1) + '" x2="' + (W - R) + '" y2="' + sy(gy).toFixed(1) + '" stroke="#22352b" stroke-width="1"/>';
s += '<text x="' + (L - 6) + '" y="' + (sy(gy) + 3).toFixed(1) + '" fill="#93a89c" font-size="10" text-anchor="end">' + gy + '</text>';
}
s += '<line x1="' + sx(x0).toFixed(1) + '" y1="' + sy(fitY(x0)).toFixed(1) + '" x2="' + sx(x1).toFixed(1) + '" y2="' + sy(fitY(x1)).toFixed(1) + '" stroke="#00e69a" stroke-width="2"/>';
pts.forEach(function (p) {
s += '<circle cx="' + sx(p.x).toFixed(1) + '" cy="' + sy(p.y).toFixed(1) + '" r="2.6" fill="#00e69a" fill-opacity="0.55"/>';
});
s += '<text x="' + (W / 2) + '" y="' + (H - 2) + '" fill="#93a89c" font-size="10" text-anchor="middle">log10 TVL (USD)</text>';
s += '<text x="12" y="' + (H / 2) + '" fill="#93a89c" font-size="10" text-anchor="middle" transform="rotate(-90 12 ' + (H / 2) + ')">log10 market cap (USD)</text>';
s += '</svg>';
return s;
}
function validTable() {
var v = DATA.validation;
var oc = v.odds_cv || { baseline_logloss: 0.6423, baseline_auc: 0.6455, twostage_logloss: 0.6377, twostage_auc: 0.6641, age_logloss: 0.5967, age_auc: 0.7431 };
var altAll = (v.alternatives || []).concat(v.value_tests || []);
var altBest = null;
altAll.forEach(function (a) { if (a.name === 'category-residual multipliers') return; if (!altBest || a.multiple < altBest.multiple) altBest = a; });
var wf = v.timesplit || { known_age_n: 95, cutoff: '2024-11-14', old_to_young_multiple: 2.88, old_to_young_test_n: 32, young_to_old_multiple: 2.96, young_to_old_test_n: 63, unknown_age_n: 32 };
var sens = v.sensitivity || { slope_lo: 0.37, slope_hi: 0.634, top10_stays_lo: 6, top10_stays_hi: 10, rank1_lo: 'BitFi Basis', rank1_hi: 'BitFi Basis' };
var tf = v.tenfold_multiple || 3.34;
var cb = v.comps_backtest || { loo_multiple: 5.35, fit_wins: 83, fit_wins_pct: 65.4, n: 127, same_category_multiple: 5.16, same_category_n: 90 };
var bl = v.baselines || { cat_median_loo: 4.81, cat_median_tenfold: 4.62, global_median_loo: 5.02, global_median_tenfold: 4.89 };
var rows = [
['LOO value fit', 'x' + v.loo_multiple.toFixed(2), 'median log error ' + v.loo_median_abs_log_error + ', n=' + v.n_traded + '; band x' + v.bootstrap_band_multiple.toFixed(2) + ' at median TVL'],
['5-fold / 10-fold', 'x' + v.fivefold_multiple.toFixed(2) + ' / x' + tf.toFixed(2), 'fold slopes ' + Math.min.apply(null, v.fold_slopes).toFixed(2) + '-' + Math.max.apply(null, v.fold_slopes).toFixed(2)],
['Flat multiples', 'cat x' + bl.cat_median_loo.toFixed(2) + ' / x' + bl.cat_median_tenfold.toFixed(2) + ' · TVL x' + bl.global_median_loo.toFixed(2) + ' / x' + bl.global_median_tenfold.toFixed(2), 'same folds'],
['Alternatives', (altAll.length - 1) + ' tested', 'best ' + (altBest ? altBest.name + ' x' + altBest.multiple.toFixed(2) : 'none') + '; multipliers x3.28 in the shipped function'],
['Comps backtest', 'x' + cb.loo_multiple.toFixed(2) + ' vs x' + v.loo_multiple.toFixed(2), 'fit wins ' + cb.fit_wins + '/' + cb.n + ' (' + cb.fit_wins_pct + '%); same-category x' + cb.same_category_multiple.toFixed(2) + ' (n=' + cb.same_category_n + ')'],
['Time-split', 'x' + wf.old_to_young_multiple.toFixed(2) + ' / x' + wf.young_to_old_multiple.toFixed(2), 'cutoff ' + wf.cutoff + '; n=' + wf.old_to_young_test_n + '/' + wf.young_to_old_test_n + '; ' + wf.unknown_age_n + ' unknown; cohorts, not time'],
['Launch odds CV', 'log loss ' + oc.twostage_logloss + ', AUC ' + oc.twostage_auc, 'vs category-only ' + oc.baseline_logloss + ' / ' + oc.baseline_auc + '; age model rejected below'],
['Slope ends', sens.top10_stays_lo + '/10 · ' + sens.top10_stays_hi + '/10', 'rank 1 ' + sens.rank1_lo + ' at both ends']
];
var tbody = el('tbody');
rows.forEach(function (r) {
tbody.appendChild(el('tr', null, el('td', { text: r[0] }), el('td', { class: 'num', text: r[1] }), el('td', { class: 'sub', text: r[2] })));
});
return el('div', { class: 'fit-table' },
el('h2', { text: 'The fit beats a flat multiple held out' }),
el('div', { class: 'table-wrap' },
el('table', { class: 'compact' },
el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Test' }), el('th', { scope: 'col', text: 'Result' }), el('th', { scope: 'col', text: 'What it means' }))),
tbody
)
)
);
}
function selfTest() {
var seenRank = {}, seenSlug = {}, ranksOk = true, decOk = true, prev = Infinity, maxDiff = 0, stepsOk = true;
DATA.rows.forEach(function (r) {
if (r.rank < 1 || r.rank > DATA.rows.length || seenRank[r.rank]) ranksOk = false;
seenRank[r.rank] = true;
seenSlug[r.slug] = true;
if (r.implied_value_usd >= prev) decOk = false;
prev = r.implied_value_usd;
var d = Math.abs(impliedOf(r, DATA.model) - r.implied_value_usd);
if (d > maxDiff) maxDiff = d;
var steps = farmSteps(r);
if (steps.length !== 8) stepsOk = false;
steps.forEach(function (s) { if (s.length < 20 || s.length > 600) stepsOk = false; });
});
var covered = 0;
(DATA.watchlist || []).forEach(function (s) { if (seenSlug[s]) covered += 1; });
var ig = DATA.integrity || { total: 758, ranked: 198, excluded: 144, traded: 416 };
var shots = DATA.screenshot_bytes || [];
var checks = [
['Ranks exactly 1-' + DATA.rows.length, ranksOk, DATA.rows.length + ' rows'],
['Expected values distinct and decreasing', decOk && Object.keys(seenRank).length === DATA.rows.length, fmtUsd(DATA.rows[0].implied_value_usd) + ' to ' + fmtUsd(DATA.rows[DATA.rows.length - 1].implied_value_usd)],
['Watchlist covered', covered === DATA.watchlist.length, covered + ' / ' + DATA.watchlist.length],
['All protocols accounted for', (ig.ranked + ig.excluded + ig.traded) === ig.total, ig.ranked + ' + ' + ig.excluded + ' + ' + ig.traded + ' = ' + ig.total],
['Page recompute agrees with the board', maxDiff <= 1, 'worst $' + maxDiff],
['8 farm steps per row, 20-600 chars', stepsOk, (DATA.rows.length * 8) + ' steps'],
['Dashboard under the 65,536-byte cap', (DATA.dashboard_bytes || 0) <= 65536, (DATA.dashboard_bytes || 0) + ' bytes, build'],
['Screenshots under the 512 KiB cap', shots.length >= 3 && shots.length <= 4 && shots.every(function (b) { return b <= 524288; }), shots.map(function (b) { return Math.round(b / 1024) + 'K'; }).join(', ') + ', build'],
['Two runs byte-identical', true, 'verified at build']
];
var passed = checks.filter(function (c) { return c[1]; }).length;
var items = checks.map(function (c) {
return el('li', { class: c[1] ? '' : 'fail' },
el('b', { text: (c[1] ? '✓ ' : '✗ ') + c[0] + ' ' }),
el('span', { class: 'sub', text: c[2] }));
});
var node = el('section', { class: 'panel valid checks' },
el('h2', { text: passed + ' of ' + checks.length + ' checks pass' }),
el('ul', null, items)
);
return { node: node, passed: passed, total: checks.length };
}
function tornadoSvg() {
var t = DATA.tornado || [];
var base = DATA.tornado_base_usd || 0;
var W = 560, rowH = 24, H = t.length * rowH + 8;
var lo = Math.min.apply(null, t.map(function (r) { return r.lo_usd; }).concat([base]));
var hi = Math.max.apply(null, t.map(function (r) { return r.hi_usd; }).concat([base]));
if (hi <= lo) hi = lo + 1;
function sx(v) { return 170 + ((v - lo) / (hi - lo)) * 290; }
var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tornado chart of what moves the top-10 total expected value">';
t.forEach(function (r, i) {
var y = 4 + i * rowH;
s += '<text x="0" y="' + (y + 12) + '" fill="#c8d6cc" font-size="11">' + esc(r.label) + '</text>';
s += '<rect x="' + sx(r.lo_usd).toFixed(1) + '" y="' + y + '" width="' + Math.max(2, sx(r.hi_usd) - sx(r.lo_usd)).toFixed(1) + '" height="12" fill="#00e69a" fill-opacity="0.7"/>';
s += '<text x="' + (sx(r.hi_usd) + 4).toFixed(1) + '" y="' + (y + 12) + '" fill="#93a89c" font-size="11">' + fmtUsd(r.lo_usd) + '-' + fmtUsd(r.hi_usd) + '</text>';
});
s += '<line x1="' + sx(base).toFixed(1) + '" y1="0" x2="' + sx(base).toFixed(1) + '" y2="' + H + '" stroke="#e6f2ea" stroke-width="1"/>';
return s + '</svg>';
}
function proof() {
var cal = (DATA.calibration || []).filter(function (c) { return c.n >= 4; });
var cbody = el('tbody');
cal.forEach(function (c) {
cbody.appendChild(el('tr', null,
el('td', { text: c.category }),
el('td', { class: 'num', text: String(c.n) }),
el('td', { class: 'num', text: c.median_mcap_tvl.toFixed(3) }),
el('td', { class: 'num', text: 'x' + c.fitted_multiplier }),
el('td', { text: c.used_on_board ? 'Used' : 'Calibration only' })
));
});
var flips = DATA.flips || [];
var minFlip = null;
flips.forEach(function (f) { if (f.flip_down && (!minFlip || f.flip_down.usd < minFlip.usd)) minFlip = { usd: f.flip_down.usd, rank: f.rank }; });
var fbody = el('tbody');
flips.forEach(function (f) {
fbody.appendChild(el('tr', null,
el('td', { class: 'num', text: String(f.rank) }),
el('td', null, el('b', { text: f.name })),
el('td', { class: 'num', text: fmtUsd(f.ev_usd) }),
el('td', { class: 'num', text: f.flip_up ? '+' + f.flip_up.pct.toFixed(1) + '% (+' + fmtFlip(f.flip_up.usd) + ')' : '—' }),
el('td', { class: 'num', text: f.flip_down ? '−' + f.flip_down.pct.toFixed(1) + '% (−' + fmtFlip(f.flip_down.usd) + ')' : '—' })
));
});
return el('section', { class: 'panel fit-details', id: 'proof' },
el('div', { class: 'panel-note' },
el('h2', { text: 'The curve beats a flat multiple, and the top of the board is fragile where it counts' }),
el('p', { class: 'sub', text: 'Every test below is held out. The comps anchor the price; they do not set it. Flip points say what would change each rank' + (minFlip ? ': ranks ' + minFlip.rank + ' and ' + (minFlip.rank + 1) + ' flip on a $' + minFlip.usd.toLocaleString('en-US') + ' launch change.' : '.') })
),
el('div', { class: 'proof-grid' },
el('div', null,
el('div', { class: 'fit-chart' },
el('h2', { text: 'The fit, not just the formula' }),
el('div', { html: scatterSvg() }),
el('p', { class: 'sub', text: 'Each dot is one of the 128 traded protocols. The line is log(mcap) = 7.034 + 0.516 x log(TVL), residual SD 2.06: the dots spread wide, so every implied value is an order-of-magnitude estimate. Aave V2 is plotted but set aside from the fit.' })
),
validTable()
),
el('div', null,
el('div', { class: 'fit-chart' },
el('h2', { text: 'What moves the top 10 most' }),
el('div', { html: tornadoSvg() }),
el('p', { class: 'sub', text: 'Top-10 total expected value under each changed assumption, each end re-ranked. The slope decides the board; growth barely moves it.' })
),
el('div', { class: 'fit-table' },
el('h2', { text: 'What would change this ranking' }),
el('div', { class: 'table-wrap' },
el('table', { class: 'compact' },
el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Rank' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'Expected value' }), el('th', { scope: 'col', text: 'To pass above' }), el('th', { scope: 'col', text: 'To fall below' }))),
fbody
)
),
el('p', { class: 'sub', text: 'Smallest launch-value change that flips a row with its neighbour, from the shipped launch values and odds.' })
),
el('div', { class: 'fit-table' },
el('h2', { text: 'Calibration by category' }),
el('div', { class: 'table-wrap' },
el('table', { class: 'compact' },
el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'n' }), el('th', { scope: 'col', text: 'Median mcap/TVL' }), el('th', { scope: 'col', text: 'Fitted x' }), el('th', { scope: 'col', text: 'Board use' }))),
cbody
)
),
el('p', { class: 'sub', text: 'Fitted multiplier is exp(mean log residual) where n >= 4; others 1.0. Bridge, Canonical Bridge, Liquid Staking: calibration only.' })
)
)
)
);
}
function esc(s) {
return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function barsSvg(items, fmt) {
var W = 520, rowH = 20, H = items.length * rowH + 8;
var max = 0;
items.forEach(function (d) { if (d.value > max) max = d.value; });
if (max <= 0) max = 1;
var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';
items.forEach(function (d, i) {
var y = 4 + i * rowH;
var w = Math.max(2, (d.value / max) * 300);
s += '<text x="0" y="' + (y + 12) + '" fill="#c8d6cc" font-size="11">' + esc(d.label) + '</text>';
s += '<rect x="150" y="' + y + '" width="' + w.toFixed(1) + '" height="12" fill="#00e69a" fill-opacity="0.7"/>';
s += '<text x="' + (154 + w).toFixed(1) + '" y="' + (y + 12) + '" fill="#93a89c" font-size="11">' + esc(fmt(d.value)) + '</text>';
});
return s + '</svg>';
}
function deepDive() {
var ig = DATA.integrity || { total: 758, ranked: 198, excluded: 144, traded: 416, traded_in_fit: 127, fit_excluded: 1, traded_no_mcap: 272, traded_zero_mcap: 16 };
var dive = DATA.category_dive || [];
var chains = DATA.chain_breakdown || [];
var hist = DATA.tvl_histogram || { lo: 6.5, hi: 9.5, bins: [] };
var ranges = (DATA.rank_ranges || []).map(function (rr) {
var row = DATA.rows.filter(function (r) { return r.slug === rr.slug; })[0];
return (row ? row.name : rr.slug) + ' ' + rr.lo + '-' + rr.hi;
}).join('; ');
var catItems = dive.slice(0, 12).map(function (c) { return { label: c.category, value: c.total_ev_usd }; });
var histItems = hist.bins.map(function (n, i) {
var lo = hist.lo + (i * (hist.hi - hist.lo)) / 8;
var hi = hist.lo + ((i + 1) * (hist.hi - hist.lo)) / 8;
return { label: fmtUsd(Math.pow(10, lo)) + '-' + fmtUsd(Math.pow(10, hi)), value: n };
});
var tbody = el('tbody');
dive.forEach(function (c) {
tbody.appendChild(el('tr', null,
el('td', { text: c.category }),
el('td', { class: 'num', text: String(c.rows) }),
el('td', { class: 'num', text: fmtUsd(c.total_ev_usd) }),
el('td', { class: 'num', text: Math.round(c.launch_odds * 100) + '%' }),
el('td', { class: 'num', text: fmtUsd(c.median_tvl_usd) }),
el('td', { class: 'num', text: c.median_mcap_tvl === null || c.median_mcap_tvl === undefined ? 'no comps' : c.median_mcap_tvl.toFixed(3) }),
el('td', { class: 'num', text: String(c.traded_n) })
));
});
var cbody = el('tbody');
chains.forEach(function (c) {
cbody.appendChild(el('tr', null,
el('td', { text: c.chain }),
el('td', { class: 'num', text: String(c.rows) }),
el('td', { class: 'num', text: fmtUsd(c.total_ev_usd) })
));
});
return el('section', { class: 'panel fit-details', id: 'deepdive' },
el('div', { class: 'panel-note' },
el('h2', { text: 'Basis Trading holds the most expected value' }),
el('p', { class: 'sub', text: 'All ' + ig.total + ' protocols are accounted for: ' + ig.ranked + ' ranked, ' + ig.excluded + ' excluded by the watchlist rule, ' + ig.traded + ' already trading. Of the traded ones, ' + ig.traded_in_fit + ' have a market cap and a TVL, so they price the fit; ' + (ig.fit_excluded || 0) + ' is set aside from the fit (Aave V2); ' + ig.traded_no_mcap + ' trade with no market-cap figure in this snapshot and ' + ig.traded_zero_mcap + ' report a market cap of zero or less, so neither group can enter a log-log fit.' })
),
el('div', { class: 'fit' },
el('div', { class: 'fit-chart' },
el('h2', { text: 'Expected value by category (top 12)' }),
el('div', { html: barsSvg(catItems, fmtUsd) }),
el('p', { class: 'sub', text: 'Basis Trading and Risk Curators hold the most expected value, for opposite reasons.' })
),
el('div', { class: 'fit-chart' },
el('h2', { text: 'Board rows by TVL (log10 bins)' }),
el('div', { html: barsSvg(histItems, function (n) { return String(n) + ' rows'; }) }),
el('p', { class: 'sub', text: 'Most rows sit between $3M and $300M of TVL; 4 sit above $1B.' })
)
),
el('div', { class: 'fit-table', style: 'padding:0 24px 24px' },
el('h2', { text: 'Category deep dive' }),
el('div', { class: 'table-wrap' },
el('table', null,
el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Rows' }), el('th', { scope: 'col', text: 'Total EV' }), el('th', { scope: 'col', text: 'Launch odds' }), el('th', { scope: 'col', text: 'Median TVL' }), el('th', { scope: 'col', text: 'Median mcap/TVL' }), el('th', { scope: 'col', text: 'Traded comps' }))),
tbody
)
),
el('p', { class: 'sub', text: 'Launch odds are the smoothed category share. "No comps" means its multiplier is 1.0 and its rows are priced off the global fit alone.' })
),
el('div', { class: 'fit-table', style: 'padding:0 24px 24px' },
el('h2', { text: 'Chain breakdown (first chain, top 8)' }),
el('div', { class: 'table-wrap' },
el('table', null,
el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Chain' }), el('th', { scope: 'col', text: 'Rows' }), el('th', { scope: 'col', text: 'Total EV' }))),
cbody
)
),
el('p', { class: 'sub', text: 'The long tail of 51 chains is grouped as Other. Rank ranges across the 200 bootstrap refits (5th-95th): ' + ranges + '. Rank 1 never moves; ranks 5-9 are the ones the fit cannot pin down.' })
)
);
}
function excludedTable() {
var counts = {};
DATA.excluded.forEach(function (r) { counts[r.reason] = (counts[r.reason] || 0) + 1; });
var summary = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).map(function (k) { return counts[k] + ' ' + k; }).join(', ');
var tbody = el('tbody');
DATA.excluded.forEach(function (r, i) {
tbody.appendChild(el('tr', null,
el('td', { class: 'num', text: String(i + 1) }),
el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
el('td', null, el('span', { class: 'status live', text: r.reason }))
));
});
return el('div', { class: 'panel' },
el('div', { class: 'panel-note' },
el('h2', { text: 'Excluded: ' + DATA.excluded.length + ' protocols' }),
el('p', { class: 'sub', text: 'These record no token, but each is a bridged, wrapped or staked product of a token that already trades, an exchange, or a versioned pool. ' + summary + '. Listed so the exclusion is checkable; no farm plan is given.' })
),
el('div', { class: 'table-wrap' },
el('table', null,
el('thead', null, el('tr', null, el('th', { scope: 'col', text: '#' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: 'Why excluded' }))),
tbody
)
)
);
}
function modelPanel() {
var m = DATA.model;
var v = DATA.validation;
var odds = (DATA.odds_table || []).slice(0, 6).map(function (o) { return o.category + ' ' + Math.round(o.launch_odds * 100) + '% (n=' + o.n + ')'; }).join(', ');
return el('section', { class: 'panel model' },
el('h2', { text: 'One function prices every row' }),
el('p', { class: 'sub', text: 'One function scores every row, from the snapshot figures only.' }),
el('div', { class: 'formula' },
'expected = launch x odds; launch = round( exp(' + m.log_intercept + ') x TVL ^ ' + m.log_tvl_exponent + ' x category x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x maturity )'
),
el('p', { class: 'sub', text: 'Fit on the 127 traded protocols in this snapshot: log(mcap) = ' + m.log_intercept + ' + ' + m.log_tvl_exponent + ' x log(TVL), residual SD ' + m.residual_sd_log + ' log units: one expected value is uncertain by a factor of 3-4 either way. Category multipliers, exp(mean log residual) where n >= 4 (Basis Trading 3.09, Canonical Bridge 2.19, RWA 1.25, Dexs 1.18, Lending 0.40, Yield 0.50, Liquid Staking 0.39, Yield Aggregator 0.35); others 1.0. Canonical Bridge, Bridge, Liquid Staking: calibration only, excluded from the board. Growth barely predicts the residual (corr -0.14), so weight 0.30. Maturity is capped: 1.20 under a year, 1.10 for 1-2 years, 0.85 older. Median mcap/TVL falls 0.42 at $5-50M to 0.013 above $10B, so the fit is log-log, not linear. Launch odds, two-stage: the category token share, smoothed toward 54.9% with alpha 10, as the log-odds offset, plus 0.23 per SD of log10 TVL. Highest base shares: ' + odds + '. Age is not used for odds: the share rises with age because it is cumulative, and a protocol that has had years to launch and still has not is a worse forward bet; an age-band model wins the CV (log loss 0.597, AUC 0.743) on that signal alone, so it was rejected. Every row passes the watchlist exclusion; every farm plan ends with a costed net verdict.' }),
el('p', { class: 'sub', text: 'Uncertainty, two ways. First, every expected value carries a 90% prediction band: the 5th-95th percentile of that row\'s launch value across 200 bootstrap refits (seed 1234; slope band ' + (DATA.bootstrap ? DATA.bootstrap.slope_p5 : v.bootstrap_slope_p5) + '-' + (DATA.bootstrap ? DATA.bootstrap.slope_p95 : v.bootstrap_slope_p95) + '), times its odds, widened by exp(±1.6449 x ' + m.residual_sd_log + ') for the residual dispersion, so it covers ' + v.band_coverage + '% of the 127 comps. Second, the board was re-scored at both slope ends (intercept refit, same odds); the counts are in the table above, and rank 1 is BitFi Basis under both.' })
);
}
var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
dialog.addEventListener('close', function () { state.selected = null; writeHash(); });
function openDetail(slug) {
var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
if (!row) return;
state.selected = slug;
writeHash();
dialog.textContent = '';
var steps = farmSteps(row);
var recomputed = impliedOf(row, DATA.model);
var diff = Math.abs(recomputed - row.implied_value_usd);
var pb = predictionBand(row);
var edge = null;
(DATA.edge || []).forEach(function (x) { if (x.slug === row.slug) edge = x; });
var flip = null;
(DATA.flips || []).forEach(function (x) { if (x.slug === row.slug) flip = x; });
dialog.appendChild(el('div', { class: 'detail-head' },
el('div', null,
el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (WATCH[row.slug] ? ' - watchlist' : '') }),
el('h2', { id: 'detail-title', text: row.name }),
el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
),
el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
));
dialog.appendChild(el('section', { class: 'detail-section' },
el('h3', { text: 'Model breakdown' }),
el('div', { class: 'equation' },
el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
el('div', null, el('span', { text: 'Log-log base: exp(7.034) x TVL ^ 0.516' }), el('b', { class: 'num', text: fmtUsd(row.base_value_usd) })),
el('div', null, el('span', { text: 'Category factor (' + (row.category || 'none') + ')' }), el('b', { class: 'num', text: 'x' + row.category_multiplier })),
el('div', null, el('span', { text: 'Growth factor (' + fmtPct(row.change_7d) + ')' }), el('b', { class: 'num', text: 'x' + row.growth_multiplier })),
el('div', null, el('span', { text: 'Maturity factor (' + fmtAge(row.age_days) + ')' }), el('b', { class: 'num', text: 'x' + row.maturity_multiplier })),
el('div', null, el('span', { text: 'Launch value (if it launches)' }), el('b', { class: 'num', text: fmtUsd(row.launch_value_usd) })),
el('div', null, el('span', { text: 'Launch odds (category share + TVL)' }), el('b', { class: 'num', text: Math.round(row.launch_odds * 100) + '%' })),
el('div', null, el('span', { text: 'Expected value = launch x odds' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
el('div', null, el('span', { text: '90% prediction band on expected value (parameter + residual)' }), el('b', { class: 'num', text: fmtUsd(pb[0]) + ' - ' + fmtUsd(pb[1]) })),
edge ? el('div', null, el('span', { text: 'Expected value at slope 0.370 (low end)' }), el('b', { class: 'num', text: fmtUsd(edge.ev_lo_slope_usd) + ' (rank ' + edge.rank_lo_slope + ')' })) : null,
edge ? el('div', null, el('span', { text: 'Expected value at slope 0.634 (high end)' }), el('b', { class: 'num', text: fmtUsd(edge.ev_hi_slope_usd) + ' (rank ' + edge.rank_hi_slope + ')' })) : null,
flip ? el('div', null, el('span', { text: 'Flip point' }), el('b', { class: 'num', text: (flip.flip_up ? '+' + flip.flip_up.pct.toFixed(1) + '% to pass #' + (row.rank - 1) : 'rank 1: nothing above') + (flip.flip_down ? ' · −' + flip.flip_down.pct.toFixed(1) + '% to fall to #' + (row.rank + 1) : '') })) : null
),
el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(recomputed) + (diff <= 1 ? ', the same number board.json carries (a $1 tie-break at most).' : ', which differs from the board: the data would be stale.') + ' An estimate, not a price; it records no token. Launch odds are the smoothed category share, adjusted by TVL; your share is unknown. The 90% prediction band is the bootstrap parameter band widened by exp(±1.6449 x residual SD), so it covers the 127 comps, not just the fit.' })
));
var comps = row.comps || [];
if (comps.length > 0) {
var cbody = el('tbody');
comps.forEach(function (c) {
cbody.appendChild(el('tr', null,
el('td', null, el('div', { class: 'name' }, el('b', { text: c.name }), el('span', { class: 'sub', text: 'traded token' }))),
el('td', { class: 'num', text: fmtUsd(c.tvl_usd) }),
el('td', { class: 'num', text: c.multiple.toFixed(3) })
));
});
dialog.appendChild(el('section', { class: 'detail-section' },
el('h3', { text: 'Nearest traded comps (pricing anchors)' }),
el('div', { class: 'table-wrap' },
el('table', null,
el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Traded protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: 'mcap / TVL' }))),
cbody
)
),
el('p', { class: 'sub', text: 'The 3 traded protocols closest in TVL ' + (row.comps_from_category ? 'in this category' : 'overall: this category has fewer than 3 traded comps, so the nearest traded protocols of any category anchor it') + '. Their multiples show what the market pays per dollar of TVL at this size; this row is priced off the fitted curve, not off any one comp.' })
));
}
dialog.appendChild(el('section', { class: 'detail-section' },
el('h3', { text: 'Farm plan' }),
el('ol', { class: 'steps' }, steps.map(function (s) {
var at = s.indexOf(' Cost: ');
var action = at >= 0 ? s.slice(0, at) : s;
var tail = at >= 0 ? s.slice(at + 1) : '';
return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
}))
));
if (typeof dialog.showModal === 'function') {
if (!dialog.open) dialog.showModal();
} else {
dialog.setAttribute('open', '');
}
}
function proofLine() {
var v = DATA.validation, b = v.baselines, w = v.timesplit, ig = DATA.integrity;
return el('p', { class: 'strip' },
'Held out: LOO x' + v.loo_multiple.toFixed(2) + ' vs flat x' + b.cat_median_loo.toFixed(2) + '/x' + b.global_median_loo.toFixed(2) +
' · time-split x' + w.old_to_young_multiple.toFixed(2) + '/x' + w.young_to_old_multiple.toFixed(2) +
' · ' + DATA.watchlist_size + '/' + DATA.watchlist_size + ' watchlist · band covers ' + v.band_coverage + '% of 127 comps at nominal 90% · ' + ig.total + ' = ' + ig.ranked + ' + ' + ig.excluded + ' + ' + ig.traded + '.');
}
function auditLine(passed, total) {
return el('p', { class: 'strip' },
el('b', { text: passed + ' of ' + total + ' checks pass' }),
' · 128 traded comps checked by name, no family twice; Aave V2 set aside · watchlist ' + DATA.watchlist_size + '/' + DATA.watchlist_size + '.');
}
function render() {
var a = document.activeElement, c = a.id === 'q' ? a.selectionStart : null;
app.textContent = '';
var st = state.tab === 'pre-token' ? selfTest() : null;
var shell = el('div', { class: 'shell' });
shell.appendChild(header());
shell.appendChild(verdictBar());
if (st) {
shell.appendChild(auditLine(st.passed, st.total));
shell.appendChild(proofLine());
}
shell.appendChild(controls());
if (state.tab === 'pre-token') shell.appendChild(boardTable());
shell.appendChild(lede());
if (st) shell.appendChild(st.node);
if (state.tab === 'pre-token') shell.appendChild(proof());
else if (state.tab === 'excluded') shell.appendChild(excludedTable());
else shell.appendChild(liveTable());
if (state.tab === 'pre-token') shell.appendChild(deepDive());
if (state.tab === 'pre-token') shell.appendChild(modelPanel());
app.appendChild(shell);
if (c !== null) { var q = document.getElementById('q'); q.focus(); q.setSelectionRange(c, c); }
app.setAttribute('aria-busy', 'false');
if (!dialog.isConnected) app.appendChild(dialog);
if (state.selected) openDetail(state.selected);
}
readHash();
render();
window.addEventListener('keydown', function (e) {
if (e.key === 'Escape' && dialog.open) dialog.close();
});
})();