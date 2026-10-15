window.P = (function () {
  const nf = (v) => v == null || isNaN(v);
  const F = {
    int: (v) => nf(v) ? '—' : d3.format(',.0f')(v),
    money: (v) => nf(v) ? '—' : (Math.abs(v) >= 1000 ? '$' + d3.format(',.0f')(v) : '$' + d3.format(',.2f')(v)),
    money0: (v) => nf(v) ? '—' : '$' + d3.format(',.0f')(v),
    moneyC: (v) => nf(v) ? '—' : (Math.abs(v) >= 1e6 ? '$' + d3.format('.2f')(v / 1e6) + 'M' : Math.abs(v) >= 1e4 ? '$' + d3.format('.1f')(v / 1e3) + 'K' : '$' + d3.format(',.0f')(v)),
    ratio: (v) => nf(v) ? '—' : d3.format(',.2f')(v),
    pct: (v) => nf(v) ? '—' : d3.format('.0f')(v) + '%',
    pct1: (v) => nf(v) ? '—' : d3.format('.1f')(v) + '%',
    signedPct: (v) => nf(v) ? '—' : (v >= 0 ? '+' : '−') + d3.format('.0f')(Math.abs(v)) + '%',
    signedMoney: (v) => nf(v) ? '—' : (v >= 0 ? '+' : '−') + '$' + d3.format(',.0f')(Math.abs(v)),
    day: (s) => s ? d3.utcFormat('%b %-d, %Y')(new Date(s + 'T00:00:00Z')) : '—',
    dayShort: (s) => s ? d3.utcFormat('%b %-d')(new Date(s + 'T00:00:00Z')) : '—',
    mon: (s) => d3.utcFormat("%b '%y")(new Date(s + '-01T00:00:00Z')),
    monLong: (s) => d3.utcFormat('%B %Y')(new Date(s + '-01T00:00:00Z')),
    text: (v) => v == null ? '—' : String(v),
  };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const mark = (e, src, field, where) => { e.dataset.source = src; if (field) e.dataset.field = field; if (where) e.dataset.where = where; return e; };
  const fail = (box) => { box.replaceChildren(el('div', 'fail', 'Failed to load')); };
  const ok = (id) => dash.data(id).status === 'ok';
  const st = (id) => dash.data(id).status;
  const animate = (i, w) => { if (window.__ppDrawn) { i.style.width = w; return; } i.style.width = '0'; requestAnimationFrame(() => requestAnimationFrame(() => { i.style.width = w; })); };
  const fill = (scope, src, fmts) => {
    const d = dash.data(src);
    scope.querySelectorAll('[data-source="' + src + '"][data-field]').forEach((e) => {
      if (e.dataset.where) return;
      if (d.status === 'ok' && d.data[+(e.dataset.row || 0)]) { const f = e.dataset.field; e.textContent = (fmts[f] || F.text)(d.data[+(e.dataset.row || 0)][f]); e.classList.remove('dash-skeleton'); }
      else if (d.status !== 'loading') { e.textContent = '—'; e.classList.remove('dash-skeleton'); }
    });
  };
  const tip = (box) => { let t = box.querySelector(':scope > .tip'); if (!t) { t = el('div', 'tip'); t.hidden = true; box.appendChild(t); } return t; };
  const showTip = (box, t, ev, title, lines) => {
    t.replaceChildren(el('div', 'd', title));
    lines.forEach(([c, l, v]) => { const r = el('div'); if (c) { const s = el('span', 'tsw'); s.style.background = c; r.appendChild(s); } r.appendChild(document.createTextNode(l + '  ')); r.appendChild(el('b', null, v)); t.appendChild(r); });
    t.hidden = false; const [x, y] = d3.pointer(ev, box); const bw = box.clientWidth; const tw = t.offsetWidth;
    t.style.left = Math.max(0, Math.min(x + 14, bw - tw)) + 'px'; t.style.top = Math.max(0, y - t.offsetHeight - 10) + 'px';
  };
  const measure = (svg, s) => { const t = svg.append('text').attr('class', 'm').style('font-size', '11px').text(s); const w = t.node().getComputedTextLength(); t.remove(); return w; };

  function spark(box, rows, key, color) {
    box.replaceChildren();
    if (!rows.length) return;
    const W = Math.max(120, box.clientWidth); const H = 34;
    const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'none').attr('width', '100%').attr('height', H);
    const x = d3.scaleLinear([0, rows.length - 1], [1, W - 4]);
    const y = d3.scaleLinear([0, d3.max(rows, (r) => r[key]) || 1], [H - 2, 3]);
    const lastFinal = rows.map((r) => r.status === 'Final').lastIndexOf(true);
    const ln = d3.line().x((_, i) => x(i)).y((r) => y(r[key]));
    const ar = d3.area().x((_, i) => x(i)).y0(H).y1((r) => y(r[key]));
    svg.append('path').datum(rows.slice(0, lastFinal + 1)).attr('d', ar).style('fill', color).style('opacity', 0.12);
    svg.append('path').datum(rows.slice(0, lastFinal + 1)).attr('d', ln).style('fill', 'none').style('stroke', color).style('stroke-width', 1.75).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round').attr('vector-effect', 'non-scaling-stroke');
    svg.append('path').datum(rows.slice(lastFinal)).attr('d', ln).style('fill', 'none').style('stroke', color).style('stroke-width', 1.5).style('stroke-dasharray', '3 3').style('opacity', 0.6).attr('vector-effect', 'non-scaling-stroke');
    const li = Math.max(0, lastFinal);
    svg.append('circle').attr('cx', x(li)).attr('cy', y(rows[li][key])).attr('r', 3).style('fill', color);
  }

  function axisStyle(g) { g.attr('class', 'axis').attr('font-size', null).attr('font-family', null); g.select('.domain').remove(); return g; }
  function every(arr, W, px) { const n = Math.max(1, Math.ceil(arr.length / Math.max(3, Math.floor(W / px)))); return arr.filter((_, i) => i % n === 0); }

  function monthlyBars(box, rows) {
    box.querySelectorAll('svg').forEach((n) => n.remove());
    const W = Math.max(280, box.clientWidth); const H = 280; const mb = 28; const mt = 18;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const y = d3.scaleLinear([0, (d3.max(rows, (r) => r.spend) || 1) * 1.08], [H - mb, mt]).nice();
    const ml = measure(svg, F.moneyC(y.domain()[1])) + 14;
    const x = d3.scaleBand(rows.map((r) => r.month), [ml, W - 4]).padding(0.3);
    svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(y).ticks(4).tickFormat((v) => F.moneyC(v)).tickSize(-(W - ml - 4)).tickPadding(8)).call(axisStyle);
    svg.append('g').attr('transform', `translate(0,${H - mb})`).call(d3.axisBottom(x).tickValues(every(rows.map((r) => r.month), W, 62)).tickFormat(F.mon).tickSize(0).tickPadding(10)).call(axisStyle);
    const firstNon = rows.findIndex((r) => r.status !== 'Final');
    if (firstNon >= 0) {
      const x0 = x(rows[firstNon].month) - x.step() * x.paddingInner() / 2;
      svg.append('rect').attr('x', x0).attr('y', mt - 10).attr('width', W - 4 - x0).attr('height', H - mb - mt + 10).style('fill', 'var(--line)').style('opacity', 0.55).attr('rx', 4);
      svg.append('text').attr('x', W - 8).attr('y', mt - 0).attr('text-anchor', 'end').style('fill', 'var(--muted)').style('font-size', '10px').style('letter-spacing', '.08em').text('STILL COLLECTING ORDERS');
    }
    const bars = svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.month)).attr('width', x.bandwidth()).attr('rx', Math.min(4, x.bandwidth() / 2))
      .style('fill', (r) => r.status === 'Final' ? 'var(--blue)' : 'var(--faint)');
    if (window.__ppDrawn) bars.attr('y', (r) => y(r.spend)).attr('height', (r) => y(0) - y(r.spend));
    else bars.attr('y', y(0)).attr('height', 0).transition().duration(700).delay((_, i) => i * 18).ease(d3.easeCubicOut).attr('y', (r) => y(r.spend)).attr('height', (r) => y(0) - y(r.spend));
    const t = tip(box);
    svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.month) - x.step() * x.paddingInner() / 2).attr('width', x.step()).attr('y', 0).attr('height', H).style('fill', 'transparent')
      .on('mousemove', (ev, r) => showTip(box, t, ev, F.monLong(r.month) + ' · ' + r.status, [[null, 'Spend', F.money(r.spend)], [null, 'Postcards', F.int(r.postcards)], [null, 'ROAS', F.ratio(r.roas)], [null, 'Spend with an iROAS', F.pct(r.iroas_coverage)]]))
      .on('mouseleave', () => { t.hidden = true; });
  }

  function roasLine(box, rows) {
    box.querySelectorAll('svg').forEach((n) => n.remove());
    const W = Math.max(280, box.clientWidth); const H = 280; const mb = 28; const mt = 18;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const y = d3.scaleLinear([0, (d3.max(rows, (r) => r.roas) || 1) * 1.1], [H - mb, mt]).nice();
    const ml = measure(svg, F.int(y.domain()[1])) + 14;
    const x = d3.scalePoint(rows.map((r) => r.month), [ml + 8, W - 10]);
    svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('~s')).tickSize(-(W - ml - 4)).tickPadding(8)).call(axisStyle);
    svg.append('g').attr('transform', `translate(0,${H - mb})`).call(d3.axisBottom(x).tickValues(every(rows.map((r) => r.month), W, 62)).tickFormat(F.mon).tickSize(0).tickPadding(10)).call(axisStyle);
    const lastFinal = rows.map((r) => r.status === 'Final').lastIndexOf(true);
    const ln = d3.line().x((r) => x(r.month)).y((r) => y(r.roas));
    const ar = d3.area().x((r) => x(r.month)).y0(y(0)).y1((r) => y(r.roas));
    const id = 'g' + Math.random().toString(36).slice(2, 8);
    const gr = svg.append('defs').append('linearGradient').attr('id', id).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
    [[0, .28], [.5, .08], [1, 0]].forEach(([o, a]) => gr.append('stop').attr('offset', o).style('stop-color', 'var(--navy)').style('stop-opacity', a));
    svg.append('path').datum(rows.slice(0, lastFinal + 1)).attr('d', ar).style('fill', `url(#${id})`);
    svg.append('path').datum(rows.slice(0, lastFinal + 1)).attr('d', ln).style('fill', 'none').style('stroke', 'var(--navy)').style('stroke-width', 2.25).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
    svg.append('path').datum(rows.slice(lastFinal)).attr('d', ln).style('fill', 'none').style('stroke', 'var(--navy)').style('stroke-width', 2).style('stroke-dasharray', '4 4').style('opacity', .6);
    svg.append('g').selectAll('circle').data(rows).join('circle').attr('cx', (r) => x(r.month)).attr('cy', (r) => y(r.roas)).attr('r', 3.5)
      .style('fill', (r) => r.status === 'Final' ? 'var(--navy)' : 'var(--card)').style('stroke', 'var(--navy)').style('stroke-width', 1.5);
    const t = tip(box); const step = rows.length > 1 ? x(rows[1].month) - x(rows[0].month) : W;
    svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.month) - step / 2).attr('width', step).attr('y', 0).attr('height', H).style('fill', 'transparent')
      .on('mousemove', (ev, r) => showTip(box, t, ev, F.monLong(r.month) + ' · ' + r.status, [[null, 'ROAS', F.ratio(r.roas)], [null, 'Revenue', F.money(r.revenue)], [null, 'Orders', F.int(r.orders)]]))
      .on('mouseleave', () => { t.hidden = true; });
  }

  const palette = ['var(--blue)', 'var(--navy)', '#9b8cd9', '#e0a458', '#7fbf9b', '#d77fa1'];
  function alwaysOn(box, legend, rows, focusId) {
    box.querySelectorAll('svg').forEach((n) => n.remove()); legend.replaceChildren();
    if (!rows.length) return;
    const ids = Array.from(new Set(rows.map((r) => r.campaign_id)));
    const color = (id) => id === focusId ? 'var(--ink)' : palette[ids.filter((i) => i !== focusId).indexOf(id) % palette.length];
    const series = ids.map((id) => [id, rows.filter((r) => r.campaign_id === id).sort((a, b) => a.month.localeCompare(b.month))]);
    series.forEach(([id, rs]) => { const s = el('span'); const i = el('i'); i.style.background = color(id); if (id === focusId) i.style.height = '4px'; s.append(i, document.createTextNode(rs[0].campaign)); legend.appendChild(s); });
    const months = Array.from(new Set(rows.map((r) => r.month))).sort();
    const W = Math.max(280, box.clientWidth); const H = 280; const mb = 28; const mt = 14;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const y = d3.scaleLinear([0, (d3.max(rows, (r) => r.conversion_rate) || 1) * 1.1], [H - mb, mt]).nice();
    const ml = measure(svg, y.domain()[1] + '%') + 14;
    const x = d3.scalePoint(months, [ml + 8, W - 10]);
    svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(y).ticks(4).tickFormat((v) => v + '%').tickSize(-(W - ml - 4)).tickPadding(8)).call(axisStyle);
    svg.append('g').attr('transform', `translate(0,${H - mb})`).call(d3.axisBottom(x).tickValues(every(months, W, 62)).tickFormat(F.mon).tickSize(0).tickPadding(10)).call(axisStyle);
    const ln = d3.line().x((r) => x(r.month)).y((r) => y(r.conversion_rate));
    series.sort((a, b) => (a[0] === focusId) - (b[0] === focusId)).forEach(([id, rs]) => {
      const f = id === focusId;
      svg.append('path').datum(rs).attr('d', ln).style('fill', 'none').style('stroke', color(id)).style('stroke-width', f ? 3 : 1.75).style('opacity', f || !focusId ? 1 : .75).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
      svg.append('g').selectAll('circle').data(rs).join('circle').attr('cx', (r) => x(r.month)).attr('cy', (r) => y(r.conversion_rate)).attr('r', f ? 3.5 : 2.5).style('fill', color(id));
    });
    const t = tip(box); const step = months.length > 1 ? x(months[1]) - x(months[0]) : W;
    const rule = svg.append('line').attr('y1', mt).attr('y2', H - mb).style('stroke', 'var(--line2)').style('opacity', 0);
    svg.append('g').selectAll('rect').data(months).join('rect').attr('x', (m) => x(m) - step / 2).attr('width', step).attr('y', 0).attr('height', H).style('fill', 'transparent')
      .on('mousemove', (ev, m) => { rule.attr('x1', x(m)).attr('x2', x(m)).style('opacity', 1); showTip(box, t, ev, F.monLong(m), series.map(([id, rs]) => { const r = rs.find((q) => q.month === m); return r ? [color(id), r.campaign, F.pct1(r.conversion_rate)] : null; }).filter(Boolean)); })
      .on('mouseleave', () => { t.hidden = true; rule.style('opacity', 0); });
  }

  function lift(box, camps) {
    box.replaceChildren();
    const rows = camps.filter((c) => c.iroas != null).sort((a, b) => b.iroas - a.iroas);
    if (!rows.length) { box.appendChild(el('p', 'note', 'No campaign has run with a control group yet, so there is no iROAS to show. Adding one to your largest campaign is the first step.')); return; }
    const max = d3.max(rows, (r) => r.roas || 0) || 1;
    rows.forEach((c) => {
      const w = 'campaign_id=' + encodeURIComponent(c.campaign_id);
      const row = el('div', 'row');
      const nm = el('div', 'nm'); nm.appendChild(mark(el('span', null, c.short_name), 'campaign_stats', 'short_name', w)); nm.appendChild(el('small', null, c.category + ' · ' + F.int(c.postcards) + ' postcards'));
      const bars = el('div', 'bars');
      const br = el('div', 'bar r'); const ir = el('i'); br.appendChild(ir);
      const bl1 = el('div', 'bl'); bl1.append(el('span', null, 'ROAS'), mark(el('span', 'num', F.ratio(c.roas)), 'campaign_stats', 'roas', w));
      const bi = el('div', 'bar i'); const ii = el('i'); bi.appendChild(ii);
      const bl2 = el('div', 'bl'); bl2.append(el('span', null, 'iROAS · ' + (c.roas_to_iroas ? d3.format('.1f')(c.roas_to_iroas) + '× lower than ROAS' : '')), (() => { const s = el('span', 'num'); s.appendChild(mark(el('span', null, F.money(c.irpr)), 'campaign_stats', 'irpr', w)); s.appendChild(document.createTextNode(' iRPR')); return s; })());
      bars.append(bl1, br, bi, bl2);
      const big = el('div', 'bv'); big.appendChild(mark(el('span', null, F.ratio(c.iroas)), 'campaign_stats', 'iroas', w));
      const sm = el('small'); sm.appendChild(mark(el('span', null, F.money(c.irevenue)), 'campaign_stats', 'irevenue', w)); sm.appendChild(document.createTextNode(' iRevenue')); big.appendChild(sm);
      row.append(nm, bars, big); box.appendChild(row);
      animate(ir, (c.roas / max * 100).toFixed(2) + '%'); animate(ii, Math.max(0.8, c.iroas / max * 100).toFixed(2) + '%');
    });
  }

  const confBars = (txt) => { const s = String(txt || ''); const lv = s.startsWith('High') ? 3 : s.startsWith('Medium') ? 2 : 1; const i = el('i'); for (let k = 1; k <= 3; k++) i.appendChild(el('b', k <= lv ? 'on' : '')); return i; };
  function recs(box, data) {
    box.replaceChildren();
    data.forEach((r, idx) => {
      const w = 'rank=' + r.rank;
      const art = el('article', 'rec' + (idx === 0 ? ' first' : '')); art.id = 'rec-' + r.rank;
      const left = el('div'); left.style.display = 'grid'; left.style.gap = '16px'; left.style.alignContent = 'start';
      left.appendChild(mark(el('div', 'rk', String(r.rank).padStart(2, '0')), 'recommendations', 'rank', w));
      const meta = el('div', 'meta');
      meta.appendChild(mark(el('span', 'kind' + (r.kind === 'Improve' || r.kind === 'Redirect' || r.kind === 'Reduce' ? ' improve' : ''), r.kind), 'recommendations', 'kind', w));
      const cf = el('span', 'conf'); cf.appendChild(confBars(r.confidence)); cf.appendChild(el('span', null, String(r.confidence).split(' (')[0].split('.')[0] + ' confidence')); meta.appendChild(cf);
      left.appendChild(meta);
      left.appendChild(mark(el('h3', 't', r.title), 'recommendations', 'title', w));
      const right = el('div'); right.style.display = 'grid'; right.style.gap = '16px'; right.style.alignContent = 'start';
      const cols = el('div', 'cols');
      [['Why', 'why'], ['What to do', 'action'], ['Expected', 'expected']].forEach(([l, f]) => { const d = el('div'); d.appendChild(el('span', 'clbl', l)); d.appendChild(mark(el('p', null, r[f]), 'recommendations', f, w)); cols.appendChild(d); });
      right.appendChild(cols);
      if (/[(.]/.test(String(r.confidence).slice(4))) right.appendChild(mark(el('p', 'note', r.confidence), 'recommendations', 'confidence', w));
      art.append(left, right); box.appendChild(art);
    });
  }

  function planRows(box, plan) {
    box.replaceChildren();
    const max = d3.max(plan, (l) => Math.max(l.current_monthly, l.proposed_monthly)) || 1;
    plan.forEach((l) => {
      const w = 'campaign_id=' + encodeURIComponent(l.campaign_id);
      const row = el('div', 'pl-row');
      const nm = el('div', 'nm'); nm.appendChild(mark(el('span', null, l.line), 'plan', 'line', w)); nm.appendChild(mark(el('small', null, l.change), 'plan', 'change', w));
      const bars = el('div', 'pl-bars');
      const mk = (cls, v, f, lab) => { const b = el('div', 'pl-bar ' + cls); const tr = el('div', 'tr'); const i = el('i'); tr.appendChild(i); b.title = ''; const s = el('span'); s.appendChild(mark(el('span', null, lab), 'plan', f, w)); if (cls === 'c') s.appendChild(document.createTextNode(' now')); b.append(tr, s); animate(i, (v / max * 100).toFixed(2) + '%'); return b; };
      bars.appendChild(mk('c', l.current_monthly, 'current_monthly', F.money0(l.current_monthly)));
      bars.appendChild(mk('p' + (l.proposed_monthly < l.current_monthly ? ' down' : ''), l.proposed_monthly, 'proposed_monthly', F.money0(l.proposed_monthly)));
      row.append(nm, bars); box.appendChild(row);
    });
  }

  function cats(box, rows) {
    box.replaceChildren();
    const tot = d3.sum(rows, (r) => r.spend) || 1;
    rows.forEach((c) => {
      const w = 'category=' + encodeURIComponent(c.category);
      const card = el('div', 'card cat');
      card.appendChild(mark(el('p', 'ao-name', c.category), 'categories', 'category', w));
      const big = el('div', 'cv'); big.appendChild(mark(el('span', null, F.money(c.spend)), 'categories', 'spend', w)); card.appendChild(big);
      const shr = el('div', 'muted'); shr.style.fontSize = '.8125rem'; shr.style.marginTop = '6px'; shr.textContent = F.pct(c.spend / tot * 100) + ' of final spend'; card.appendChild(shr);
      const sh = el('div', 'share'); const i = el('i'); sh.appendChild(i); card.appendChild(sh); animate(i, (c.spend / tot * 100).toFixed(2) + '%');
      const dl = el('dl');
      [['ROAS', 'roas', F.ratio, ''], ['CPA', 'cpa', F.money, ''], ['iROAS', 'weighted_iroas', F.ratio, 'ir']].forEach(([l, f, fm, cls]) => { const d = el('div'); d.appendChild(el('dt', null, l)); d.appendChild(mark(el('dd', cls, fm(c[f])), 'categories', f, w)); dl.appendChild(d); });
      card.appendChild(dl);
      card.appendChild(mark(el('p', 'desc', c.description), 'categories', 'description', w));
      box.appendChild(card);
    });
  }

  function aoGrid(box, rows, stats) {
    box.replaceChildren();
    if (!rows.length) { box.appendChild(el('p', 'muted', 'No campaign has mailed in three or more months yet.')); return; }
    const ids = Array.from(new Set(rows.map((r) => r.campaign_id)));
    const months = Array.from(new Set(rows.map((r) => r.month))).sort();
    const ymax = (d3.max(rows, (r) => r.conversion_rate) || 1) * 1.1;
    ids.forEach((id) => {
      const rs = rows.filter((r) => r.campaign_id === id).sort((a, b) => a.month.localeCompare(b.month));
      const c = stats.find((k) => k.campaign_id === id) || {};
      const w = 'campaign_id=' + encodeURIComponent(id);
      const card = el('div', 'ao-item' + (c.saturating ? ' sat' : ''));
      card.appendChild(mark(el('p', 'ao-name', rs[0].campaign), 'campaign_stats', 'short_name', w));
      if (c.saturating) card.appendChild(el('p', 'ao-flag', 'Saturating'));
      const last = rs[rs.length - 1];
      const v = el('p', 'ao-v'); v.appendChild(mark(el('span', null, F.pct1(last.conversion_rate)), 'always_on', 'conversion_rate', 'month=' + last.month + '&campaign_id=' + encodeURIComponent(id))); card.appendChild(v);
      const stt = el('p', 'ao-stat'); stt.textContent = 'Conversion in ' + F.monLong(last.month) + ' · ' + F.int(last.postcards) + ' postcards'; card.appendChild(stt);
      const ch = el('div', 'ao-chart'); card.appendChild(ch); box.appendChild(card);
      const W = Math.max(200, ch.clientWidth || 240); const H = 120; const mb = 18;
      const svg = d3.select(ch).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
      const x = d3.scalePoint(months, [4, W - 6]); const y = d3.scaleLinear([0, ymax], [H - mb, 6]);
      y.ticks(2).forEach((t) => svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', y(t)).attr('y2', y(t)).style('stroke', 'var(--grid)'));
      const ln = d3.line().x((r) => x(r.month)).y((r) => y(r.conversion_rate));
      const ar = d3.area().x((r) => x(r.month)).y0(y(0)).y1((r) => y(r.conversion_rate));
      const col = c.saturating ? 'var(--warn)' : 'var(--navy)';
      svg.append('path').datum(rs).attr('d', ar).style('fill', col).style('opacity', .08);
      svg.append('path').datum(rs).attr('d', ln).style('fill', 'none').style('stroke', col).style('stroke-width', 2).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
      svg.append('circle').attr('cx', x(last.month)).attr('cy', y(last.conversion_rate)).attr('r', 3.5).style('fill', col);
      svg.append('text').attr('x', 0).attr('y', H - 2).style('fill', 'var(--muted)').style('font-size', '10px').text(F.mon(months[0]));
      svg.append('text').attr('x', W).attr('y', H - 2).attr('text-anchor', 'end').style('fill', 'var(--muted)').style('font-size', '10px').text(F.mon(months[months.length - 1]));
      const t = tip(ch); const step = months.length > 1 ? x(months[1]) - x(months[0]) : W;
      svg.append('g').selectAll('rect').data(rs).join('rect').attr('x', (r) => x(r.month) - step / 2).attr('width', step).attr('y', 0).attr('height', H).style('fill', 'transparent')
        .on('mousemove', (ev, r) => showTip(ch, t, ev, F.monLong(r.month), [[null, 'Conversion', F.pct1(r.conversion_rate)], [null, 'Postcards', F.int(r.postcards)], [null, 'Orders', F.int(r.orders)]]))
        .on('mouseleave', () => { t.hidden = true; });
    });
  }

  function sortable(table, state, draw) {
    table.querySelectorAll('th[data-k] button').forEach((b) => b.addEventListener('click', () => {
      const th = b.closest('th'); const k = th.dataset.k;
      if (state.key === k) state.dir = state.dir === 'descending' ? 'ascending' : 'descending'; else { state.key = k; state.dir = th.classList.contains('r') ? 'descending' : 'ascending'; }
      table.querySelectorAll('th[data-k]').forEach((t) => t.removeAttribute('aria-sort')); th.setAttribute('aria-sort', state.dir); draw();
    }));
  }
  const cmp = (state) => (a, b) => { let x = a[state.key], y = b[state.key]; const numeric = typeof x === 'number' || typeof y === 'number'; if (numeric) { x = x == null ? -Infinity : x; y = y == null ? -Infinity : y; return state.dir === 'ascending' ? x - y : y - x; } return state.dir === 'ascending' ? String(x ?? '').localeCompare(String(y ?? '')) : String(y ?? '').localeCompare(String(x ?? '')); };

  return { F, el, mark, fail, ok, st, fill, spark, monthlyBars, roasLine, alwaysOn, aoGrid, lift, recs, planRows, cats, sortable, cmp, animate };
})();

