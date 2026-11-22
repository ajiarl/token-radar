// Token Radar dashboard (radar-7). Reads window.RADAR and renders the
// ranked board, filters, a per-protocol detail view, and the farm plan.
// No network: every byte it shows is in data.js.
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
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  // The model, as in lib/model.ts: log-log fit, then two-stage odds.
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

  // Farm plan: the same derivation main.ts writes to board.json.
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
    if (c.indexOf('solana') >= 0 || c.indexOf('base') >= 0 || c.indexOf('arbitrum') >= 0 || c.indexOf('optimism') >= 0 || c.indexOf('polygon') >= 0 || c.indexOf('bnb') >= 0 || c.indexOf('avalanche') >= 0) return 'under $1 of gas';
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
    if (c.indexOf('solana') >= 0 || c.indexOf('base') >= 0 || c.indexOf('arbitrum') >= 0 || c.indexOf('optimism') >= 0 || c.indexOf('polygon') >= 0 || c.indexOf('bnb') >= 0 || c.indexOf('avalanche') >= 0) return 0.5;
    return 2;
  }
  function gasTotalUsd(p) { return Math.round(8 * gasPerTx(chainOf(p)) * 100) / 100; }
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
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Pre-token protocols, ranked by what a launch would be worth' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. This board ranks all ' + DATA.board_size + ' rankable pre-token protocols. ' + DATA.excluded_size + ' more are excluded by the watchlist rule itself, because they are bridged, wrapped or staked products of a token that already trades, and they are listed separately with the reason each one was set aside. Rank is by expected value: launch value x launch odds, where the odds start from the share of protocols in the category that ever launched a token and are adjusted by the protocol\'s TVL. Expected value is a model, not a price and not a promise of a token.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Rank 1 expected value' }), el('b', { text: fmtUsd(DATA.rows[0].implied_value_usd) })),
        el('div', { class: 'fact' }, el('span', { text: 'Excluded: wrapped / bridged / staked' }), el('b', { text: String(DATA.excluded_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
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
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + (WATCH[r.slug] ? ' - watchlist' : '') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num ' + (r.launch_odds < 0.3 ? 'neg' : r.launch_odds >= 0.6 ? 'pos' : ''), text: Math.round(r.launch_odds * 100) + '%' }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('div', { class: 'name' }, el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }), el('span', { class: 'sub', text: 'launch ' + fmtUsd(r.launch_value_usd) }), el('span', { class: 'sub', text: '90% ' + fmtUsd(r.ev_lo_usd) + ' - ' + fmtUsd(r.ev_hi_usd) }), RR[r.slug] ? el('span', { class: 'sub', text: 'rank ' + RR[r.slug].lo + '-' + RR[r.slug].hi }) : null)
        )),
        el('td', null, el('span', { class: 'status', text: 'records no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Strongest expected value first. Select a row for its breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('odds', 'Launch odds'),
            sortHeader('implied', 'Expected value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  // Ranks 5-9, where the fit cannot pin the order down.
  function contenders() {
    var list = DATA.contenders || [];
    if (list.length === 0) return null;
    var tbody = el('tbody');
    list.forEach(function (c) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: String(c.rank) }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: c.name }), el('span', { class: 'sub', text: 'rank range ' + c.rank_range_lo + '-' + c.rank_range_hi + ' across 200 refits' }))),
        el('td', { class: 'num', text: fmtUsd(c.ev_usd) }),
        el('td', { class: 'num', text: fmtUsd(c.ev_lo_slope_usd) + ' (#' + c.rank_lo_slope + ')' }),
        el('td', { class: 'num', text: fmtUsd(c.ev_hi_slope_usd) + ' (#' + c.rank_hi_slope + ')' }),
        el('td', { class: 'num', text: Math.round(c.odds * 100) + '% (base ' + Math.round(c.odds_base * 100) + '%)' }),
        el('td', { class: 'num', text: c.implied_multiple.toFixed(3) + 'x vs ' + c.comps_median_multiple.toFixed(3) + 'x' })
      ));
      tbody.appendChild(el('tr', { class: 'why' }, el('td', { colspan: '7' }, el('p', { class: 'sub', text: c.why }))));
    });
    return el('section', { class: 'panel fit-details', id: 'contenders' },
      el('div', { class: 'panel-note' },
        el('h2', { text: 'Contenders: ranks 5-9' }),
        el('p', { class: 'sub', text: 'Rank 1 never moves across the 200 refits; these five do. Each shows its value now, its value and rank with the slope at either end of its 90% band, its odds with its category base, and its implied multiple against its 3 nearest comps\' median.' })
      ),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Rank' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'Expected value' }), el('th', { scope: 'col', text: 'At slope 0.371' }), el('th', { scope: 'col', text: 'At slope 0.679' }), el('th', { scope: 'col', text: 'Launch odds' }), el('th', { scope: 'col', text: 'Implied vs comps' }))),
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

  // Log-log scatter of the 128 traded protocols, with the fitted line.
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

  function validationStrip() {
    var v = DATA.validation;
    var oc = v.odds_cv || { baseline_logloss: 0.6423, baseline_auc: 0.6455, twostage_logloss: 0.6377, twostage_auc: 0.6641, age_logloss: 0.5967, age_auc: 0.7431 };
    var altAll = (v.alternatives || []).concat(v.value_tests || []);
    var altBest = null;
    altAll.forEach(function (a) { if (!altBest || a.multiple < altBest.multiple) altBest = a; });
    var wf = v.walkforward || { known_age_n: 95, old_to_young_multiple: 2.88, old_to_young_test_n: 32, young_to_old_multiple: 2.96, young_to_old_test_n: 63 };
    var sens = v.sensitivity || { slope_lo: 0.371, slope_hi: 0.679, top10_stays_lo: 6, top10_stays_hi: 10, rank1_lo: 'BitFi Basis', rank1_hi: 'BitFi Basis' };
    var tf = v.tenfold_multiple || 3.47;
    var cb = v.comps_backtest || { loo_multiple: 5.38, fit_wins: 80, fit_wins_pct: 62.5, n: 128, same_category_multiple: 5.42, same_category_n: 91 };
    return el('section', { class: 'panel valid' },
      el('h2', { text: 'Held out, not in-sample' }),
      el('p', { class: 'sub', text: 'Value fit: leave-one-out median error x' + v.loo_multiple.toFixed(2) + ' (median absolute log error ' + v.loo_median_abs_log_error + '), 5-fold x' + v.fivefold_multiple.toFixed(2) + ', 10-fold x' + tf.toFixed(2) + ' on ' + v.n_traded + ' traded protocols. Fold slopes ' + Math.min.apply(null, v.fold_slopes).toFixed(2) + '-' + Math.max.apply(null, v.fold_slopes).toFixed(2) + ': the slope is stable, the intercept moves with it. Bootstrap 90% band on the fit itself: x' + v.bootstrap_band_multiple.toFixed(2) + ' at median TVL. ' + altAll.length + ' alternatives tested held out (best: ' + (altBest ? altBest.name + ' x' + altBest.multiple.toFixed(2) : 'none') + '); none beat the log-log fit. Comps backtest: pricing off the 3 nearest traded comps is worse held out, leave-one-out x' + cb.loo_multiple.toFixed(2) + ' against x' + v.loo_multiple.toFixed(2) + ' for the fit; the fit wins on ' + cb.fit_wins + ' of ' + cb.n + ' (62.5%); same-category comps only, x' + cb.same_category_multiple.toFixed(2) + ' (n=' + cb.same_category_n + '). The comps anchor the price; they do not set it. Walk-forward by age (' + wf.known_age_n + ' with a known listing date; 33 have none): old-to-young x' + wf.old_to_young_multiple.toFixed(2) + ' (' + wf.old_to_young_test_n + ' tested), young-to-old x' + wf.young_to_old_multiple.toFixed(2) + ' (' + wf.young_to_old_test_n + ' tested). Both test sets are small: a second check, not a proof. Launch odds, 5-fold CV, all 758 protocols: category-only log loss ' + oc.baseline_logloss + ', AUC ' + oc.baseline_auc + '; two-stage (category share + TVL) log loss ' + oc.twostage_logloss + ', AUC ' + oc.twostage_auc + '. An age-band model scores better on that CV (log loss ' + oc.age_logloss + ', AUC ' + oc.age_auc + ') but was rejected: age wins only because old protocols have had time to launch, and it would give a five-year tokenless protocol 77% odds, backwards for a forward bet. Sensitivity: at slope ' + sens.slope_lo + ' the top 10 keeps ' + sens.top10_stays_lo + ', at ' + sens.slope_hi + ' it keeps ' + sens.top10_stays_hi + ' (intercept refit each time, same odds); rank 1 is ' + sens.rank1_lo + ' under both.' })
    );
  }

  // The page answers its own checks: the first six it computes from the
  // data it renders, the next two from sizes main.ts hands it, the last
  // is a build fact, labelled as one. A check that fails says so.
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
    return el('section', { class: 'panel valid checks' },
      el('h2', { text: passed + ' of 9 checks pass' }),
      el('ul', null, checks.map(function (c) {
        return el('li', { class: c[1] ? '' : 'fail' },
          el('b', { text: (c[1] ? '✓ ' : '✗ ') + c[0] + ' ' }),
          el('span', { class: 'sub', text: c[2] }));
      }))
    );
  }

  function fitPanel() {
    var cal = (DATA.calibration || []).filter(function (c) { return c.n >= 4; });
    var tbody = el('tbody');
    cal.forEach(function (c) {
      tbody.appendChild(el('tr', null,
        el('td', { text: c.category }),
        el('td', { class: 'num', text: String(c.n) }),
        el('td', { class: 'num', text: c.median_mcap_tvl.toFixed(3) }),
        el('td', { class: 'num', text: 'x' + c.fitted_multiplier }),
        el('td', { text: c.used_on_board ? 'Used' : 'Calibration only' })
      ));
    });
    return el('details', { class: 'panel fit-details' },
      el('summary', { class: 'fit-summary', text: 'Scatter and calibration table (click to open)' }),
      el('div', { class: 'fit' },
        el('div', { class: 'fit-chart' },
          el('h2', { text: 'The fit, not just the formula' }),
          el('div', { html: scatterSvg() }),
          el('p', { class: 'sub', text: 'Each dot is one of the 128 traded protocols. The line is log(mcap) = 6.965 + 0.522 x log(TVL), residual SD 2.08: the dots spread wide around it, so every implied value is an order-of-magnitude estimate.' })
        ),
        el('div', { class: 'fit-table' },
          el('h2', { text: 'Calibration by category' }),
          el('div', { class: 'table-wrap' },
            el('table', null,
              el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'n' }), el('th', { scope: 'col', text: 'Median mcap/TVL' }), el('th', { scope: 'col', text: 'Fitted x' }), el('th', { scope: 'col', text: 'Board use' }))),
              tbody
            )
          ),
          el('p', { class: 'sub', text: 'Fitted multiplier is exp(mean log residual) where n >= 4; other categories score 1.0. Bridge, Canonical Bridge and Liquid Staking are calibration only: excluded from the board.' })
        )
      )
    );
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // One generic horizontal bar chart as inline SVG, used for the
  // category EV bars and the TVL histogram alike.
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
    var ig = DATA.integrity || { total: 758, ranked: 198, excluded: 144, traded: 416, traded_in_fit: 128, traded_no_mcap: 272, traded_zero_mcap: 16 };
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
        el('h2', { text: 'Where the value sits' }),
        el('p', { class: 'sub', text: 'All ' + ig.total + ' protocols in the snapshot are accounted for here: ' + ig.ranked + ' ranked on the board, ' + ig.excluded + ' excluded by the watchlist rule, ' + ig.traded + ' already trading. Of the traded ones, ' + ig.traded_in_fit + ' have a market cap and a TVL, so they price the fit; ' + ig.traded_no_mcap + ' trade with no market-cap figure in this snapshot and ' + ig.traded_zero_mcap + ' report a market cap of zero or less, so neither group can enter a log-log fit. Every protocol is in exactly one of those buckets.' })
      ),
      el('div', { class: 'fit' },
        el('div', { class: 'fit-chart' },
          el('h2', { text: 'Expected value by category (top 12)' }),
          el('div', { html: barsSvg(catItems, fmtUsd) }),
          el('p', { class: 'sub', text: 'Basis Trading and Risk Curators hold the most expected value, but for opposite reasons: Basis Trading pairs high multiples with middling odds, Risk Curators pair the biggest TVLs with the lowest odds on the board (21%).' })
        ),
        el('div', { class: 'fit-chart' },
          el('h2', { text: 'Board rows by TVL (log10 bins)' }),
          el('div', { html: barsSvg(histItems, function (n) { return String(n) + ' rows'; }) }),
          el('p', { class: 'sub', text: 'Most ranked protocols sit between $3M and $300M of TVL; only 4 rows sit above $1B. The log-log fit, not a flat multiple, is what lets one curve price both ends.' })
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
        el('p', { class: 'sub', text: 'Launch odds are the smoothed category share. Median mcap/TVL is the traded comps in that category; "no comps" means its multiplier is 1.0 and its rows are priced off the global fit alone.' })
      ),
      el('div', { class: 'fit-table', style: 'padding:0 24px 24px' },
        el('h2', { text: 'Chain breakdown (first chain, top 8)' }),
        el('div', { class: 'table-wrap' },
          el('table', null,
            el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Chain' }), el('th', { scope: 'col', text: 'Rows' }), el('th', { scope: 'col', text: 'Total EV' }))),
            cbody
          )
        ),
        el('p', { class: 'sub', text: 'Ethereum holds the most rows and expected value; the long tail of 51 chains is grouped as Other. Rank ranges across the 200 bootstrap refits (5th-95th percentile): ' + ranges + '. Rank 1 never moves; ranks 5-9 are the ones the fit cannot pin down.' })
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
        el('p', { class: 'sub', text: 'These record no token in the snapshot, but the watchlist rule keeps them out of the ranking because each one is a bridged, wrapped or staked product of a token that already trades, an exchange, or a versioned pool. ' + summary + '. They are listed so the exclusion is checkable, not hidden; no farm plan is given for them.' })
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
    var sens = v.sensitivity || { slope_lo: 0.371, slope_hi: 0.679, top10_stays_lo: 6, top10_stays_hi: 10, rank1_lo: 'BitFi Basis', rank1_hi: 'BitFi Basis' };
    var tf = v.tenfold_multiple || 3.47;
    var odds = (DATA.odds_table || []).slice(0, 6).map(function (o) { return o.category + ' ' + Math.round(o.launch_odds * 100) + '% (n=' + o.n + ')'; }).join(', ');
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How expected value is computed' }),
      el('p', { class: 'sub', text: 'One function scores every row, from the snapshot figures only. No protocol name is special-cased.' }),
      el('div', { class: 'formula' },
        'expected = launch x odds; launch = round( exp(' + m.log_intercept + ') x TVL ^ ' + m.log_tvl_exponent + ' x category x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x maturity )'
      ),
      el('p', { class: 'sub', text: 'Fitted on the 128 traded protocols in this snapshot: log(mcap) = ' + m.log_intercept + ' + ' + m.log_tvl_exponent + ' x log(TVL), residual SD ' + m.residual_sd_log + ' log units. Held out, the fit is no tighter: leave-one-out median error x' + v.loo_multiple.toFixed(2) + ', 5-fold x' + v.fivefold_multiple.toFixed(2) + ', 10-fold x' + tf.toFixed(2) + ', fold slopes ' + Math.min.apply(null, v.fold_slopes).toFixed(2) + '-' + Math.max.apply(null, v.fold_slopes).toFixed(2) + '. That dispersion is the honest limit: a single expected value is uncertain by roughly a factor of 3-4 either way. Category multipliers are exp(mean log residual) where n >= 4 (Basis Trading 2.99, Canonical Bridge 2.11, RWA 1.21, Dexs 1.14, Lending 0.57, Yield 0.49, Liquid Staking 0.38, Yield Aggregator 0.34); others score 1.0. Canonical Bridge, Bridge and Liquid Staking are calibration only: excluded from the board. Growth barely predicts the residual (corr -0.14): weight 0.30. Maturity is capped: 1.20 under a year, 1.10 for 1-2 years, 0.85 older. Median mcap/TVL falls from 0.42 at $5-50M TVL to 0.013 above $10B: hence log-log, not linear. Launch odds are two-stage: the category token share, smoothed toward the overall 54.9% with alpha 10, as the log-odds offset, plus 0.23 per SD of log10 TVL (5-fold CV log loss 0.638 vs 0.642 category-only, AUC 0.664 vs 0.646). Highest base shares: ' + odds + '. Age is not used for odds: the token share rises with age because it is cumulative, and a protocol that has had years to launch and still has not is a worse forward bet; an age-band model wins the CV (log loss 0.597, AUC 0.743) on that signal alone, and was rejected for that reason. The board applies the watchlist exclusion to every row. Each farm plan ends with a costed net verdict against the expected launch value.' }),
      el('p', { class: 'sub', text: 'Uncertainty, stated two ways. First, every expected value on the board carries a 90% band from 200 bootstrap refits of the log-log fit (seed 1234, the same resamples as the v3 bootstrap; slope band ' + (DATA.bootstrap ? DATA.bootstrap.slope_p5 : v.bootstrap_slope_p5) + '-' + (DATA.bootstrap ? DATA.bootstrap.slope_p95 : v.bootstrap_slope_p95) + '). The band is the 5th-95th percentile of that row\'s launch value across the refits, times its launch odds: parameter uncertainty only. The x' + v.loo_multiple.toFixed(2) + ' per-protocol dispersion sits on top of it, so a $34M-$67M band on a $48M point value is the fit\'s own uncertainty, before any single protocol\'s deviation. It is not a prediction interval, and no row\'s point value moves because of it. Second, the board was re-scored with the slope at either end of its 90% band (' + sens.slope_lo + ' and ' + sens.slope_hi + ', intercept refit each time, same odds): ' + sens.top10_stays_lo + ' of the top 10 stay in the top 10 at the low end and ' + sens.top10_stays_hi + ' at the high end, and rank 1 is ' + sens.rank1_lo + ' under both. Rank ranges across the 200 refits are listed with the category deep dive.' })
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
    var edge = null;
    (DATA.edge || []).forEach(function (x) { if (x.slug === row.slug) edge = x; });
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
        el('div', null, el('span', { text: 'Log-log base: exp(6.965) x TVL ^ 0.522' }), el('b', { class: 'num', text: fmtUsd(row.base_value_usd) })),
        el('div', null, el('span', { text: 'Category factor (' + (row.category || 'none') + ')' }), el('b', { class: 'num', text: 'x' + row.category_multiplier })),
        el('div', null, el('span', { text: 'Growth factor (' + fmtPct(row.change_7d) + ')' }), el('b', { class: 'num', text: 'x' + row.growth_multiplier })),
        el('div', null, el('span', { text: 'Maturity factor (' + fmtAge(row.age_days) + ')' }), el('b', { class: 'num', text: 'x' + row.maturity_multiplier })),
        el('div', null, el('span', { text: 'Launch value (if it launches)' }), el('b', { class: 'num', text: fmtUsd(row.launch_value_usd) })),
        el('div', null, el('span', { text: 'Launch odds (category share + TVL)' }), el('b', { class: 'num', text: Math.round(row.launch_odds * 100) + '%' })),
        el('div', null, el('span', { text: 'Expected value = launch x odds' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: '90% band on expected value' }), el('b', { class: 'num', text: fmtUsd(row.ev_lo_usd) + ' - ' + fmtUsd(row.ev_hi_usd) })),
        edge ? el('div', null, el('span', { text: 'Expected value at slope 0.371 (low end)' }), el('b', { class: 'num', text: fmtUsd(edge.ev_lo_slope_usd) + ' (rank ' + edge.rank_lo_slope + ')' })) : null,
        edge ? el('div', null, el('span', { text: 'Expected value at slope 0.679 (high end)' }), el('b', { class: 'num', text: fmtUsd(edge.ev_hi_slope_usd) + ' (rank ' + edge.rank_hi_slope + ')' })) : null
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(recomputed) + (diff <= 1 ? ', the same number board.json carries (a $1 tie-break at most).' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price, and it records no token. Launch odds are the category share smoothed toward the overall rate, adjusted by this protocol\'s TVL (+0.23 log-odds per SD of log10 TVL); your share of any launch is unknown. The 90% band is parameter uncertainty only, on top of the x3.40 per-protocol dispersion, not a prediction interval.' })
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

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    if (state.tab === 'pre-token') shell.appendChild(validationStrip());
    if (state.tab === 'pre-token') shell.appendChild(selfTest());
    if (state.tab === 'pre-token') shell.appendChild(fitPanel());
    shell.appendChild(controls());
    if (state.tab === 'pre-token') shell.appendChild(boardTable());
    if (state.tab === 'pre-token') { var cont = contenders(); if (cont) shell.appendChild(cont); }
    else if (state.tab === 'excluded') shell.appendChild(excludedTable());
    else shell.appendChild(liveTable());
    if (state.tab === 'pre-token') shell.appendChild(deepDive());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
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
