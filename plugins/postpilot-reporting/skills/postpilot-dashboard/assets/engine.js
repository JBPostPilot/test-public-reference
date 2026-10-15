dash.loader('sheet', {
  description: 'Turns the Google Sheets values grid into one row per campaign per send date, with numbers typed.',
  fn: ({ answer }) => {
    let a = typeof answer === 'string' ? JSON.parse(answer) : answer;
    if (a && Array.isArray(a.content) && a.content[0] && typeof a.content[0].text === 'string') a = JSON.parse(a.content[0].text);
    if (!a || a.error) throw new Error((a && a.error && (a.error.message || JSON.stringify(a.error))) || 'Empty answer from Google Sheets');
    const values = a.values || (a.valueRanges && a.valueRanges[0] && a.valueRanges[0].values);
    if (!Array.isArray(values) || values.length < 2) throw new Error('The sheet returned no rows. Top-level keys: ' + Object.keys(a).join(', '));
    const head = values[0].map((h) => String(h).trim());
    const numeric = new Set(['impressions', 'clicks', 'spend', 'conversions', 'revenue', 'iroas']);
    const rows = values.slice(1).filter((v) => v && v.length && v[0]).map((v) => Object.fromEntries(head.map((h, i) => {
      const cell = v[i] == null ? '' : String(v[i]).trim();
      if (numeric.has(h)) return [h, cell === '' ? null : Number(cell.replace(/[$,]/g, ''))];
      return [h, cell];
    })));
    return { columns: head, rows };
  },
});

dash.calc('campaign_stats', {
  title: 'Campaign results',
  description: 'One row per campaign: lifetime spend and postcards, final-results ROAS, CPA, AOV and conversion rate (sends 48+ days old), iROAS and iRevenue, run rate, and saturation signals.',
  inputs: ['sheet'],
  fn: (sheet) => {
    const rows = sheet.filter((r) => r.date && r.campaign_id);
    const asOf = rows.reduce((m, r) => (r.date > m ? r.date : m), '');
    const ms = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    const cut = iso(ms(asOf) - 48 * 864e5);
    const monthEnd = (m) => iso(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0));
    const addMonths = (m, k) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1)); return d.toISOString().slice(0, 7); };
    const runMonths = [addMonths(asOf.slice(0, 7), -3), addMonths(asOf.slice(0, 7), -2), addMonths(asOf.slice(0, 7), -1)];
    const short = (name) => {
      const segs = String(name).split('|').map((s) => s.trim()).filter(Boolean);
      let days = null; let code = null;
      const keep = segs.filter((s) => { const l = s.match(/^LOD\s*=?\s*(\d+)/i); if (l) { days = l[1]; return false; } return !/^NO\s*=/i.test(s) && !/^POSTPILOT$/i.test(s); });
      if (keep.length > 1 && /^[A-Z0-9]{4,}$/.test(keep[keep.length - 1])) code = keep.pop();
      segs.forEach((s) => { const d = s.match(/Subscribed\s+(\d+)\s+days?\s+ago/i); if (d) days = d[1]; });
      let base = keep[0] || String(name);
      if (keep.length > 1 && base.length <= 12) base += ' ' + keep[1];
      if (base.length > 36) base = base.replace(/\s*\([^)]*\)/g, '').trim();
      return base + (days ? ', ' + days + ' days' : '') + (code ? ' (' + code + ')' : '');
    };
    const by = new Map();
    rows.forEach((r) => { const k = String(r.campaign_id); if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
    const out = [];
    by.forEach((rs, id) => {
      rs.sort((a, b) => a.date.localeCompare(b.date));
      const sum = (arr, f) => arr.reduce((a, r) => a + (Number(r[f]) || 0), 0);
      const fin = rs.filter((r) => r.date <= cut);
      const months = {};
      rs.forEach((r) => { const m = r.date.slice(0, 7); months[m] = months[m] || { pc: 0, sp: 0, o: 0, rv: 0 }; months[m].pc += Number(r.impressions) || 0; months[m].sp += Number(r.spend) || 0; months[m].o += Number(r.conversions) || 0; months[m].rv += Number(r.revenue) || 0; });
      const mk = Object.keys(months).sort();
      const finalMonths = mk.filter((m) => monthEnd(m) <= cut);
      const recentM = finalMonths.slice(-3); const baseM = finalMonths.slice(-9, -3);
      const agg = (ks) => ks.reduce((a, m) => ({ pc: a.pc + months[m].pc, o: a.o + months[m].o }), { pc: 0, o: 0 });
      const rec = agg(recentM); const bas = agg(baseM);
      const lastSend = rs[rs.length - 1].date; const firstSend = rs[0].date;
      const active = ms(asOf) - ms(lastSend) <= 30 * 864e5;
      const spend = sum(rs, 'spend'); const postcards = sum(rs, 'impressions');
      const fs = sum(fin, 'spend'); const fp = sum(fin, 'impressions'); const fo = sum(fin, 'conversions'); const fr = sum(fin, 'revenue');
      const iroasRow = rs.find((r) => r.iroas != null && !isNaN(r.iroas));
      const iroas = iroasRow ? Number(iroasRow.iroas) : null;
      const runSpend = runMonths.reduce((a, m) => a + (months[m] ? months[m].sp : 0), 0) / 3;
      const trimmed = mk.length > 1 && months[mk[mk.length - 1]].sp < 0.5 * months[mk[mk.length - 2]].sp ? mk.slice(0, -1) : mk;
      const lastActive = trimmed.slice(-3);
      const priorMonthly = lastActive.reduce((a, m) => a + months[m].sp, 0) / Math.max(1, lastActive.length);
      const alwaysOn = mk.length >= 4;
      const recentPc = recentM.length ? rec.pc / recentM.length : null; const basePc = baseM.length ? bas.pc / baseM.length : null;
      const recentCvr = rec.pc ? rec.o / rec.pc * 100 : null; const baseCvr = bas.pc ? bas.o / bas.pc * 100 : null;
      const saturating = !!(alwaysOn && active && baseM.length >= 3 && recentCvr != null && baseCvr && recentCvr < 0.75 * baseCvr && recentPc > 1.25 * basePc);
      out.push({
        campaign_id: id, campaign: rs[rs.length - 1].campaign_name, short_name: short(rs[rs.length - 1].campaign_name), category: rs[0].tactic || 'Other',
        status: active ? 'Running' : 'Finished', first_send: firstSend, last_send: lastSend, send_months: mk.length, always_on: alwaysOn,
        postcards, spend, final_postcards: fp, final_spend: fs, orders: fo, revenue: fr,
        roas: fs ? fr / fs : null, cpa: fo ? fs / fo : null, aov: fo ? fr / fo : null, conversion_rate: fp ? fo / fp * 100 : null,
        cost_per_postcard: postcards ? spend / postcards : null,
        iroas, irpr: iroas != null && postcards ? iroas * spend / postcards : null, irevenue: iroas != null ? iroas * spend : null,
        roas_to_iroas: iroas && fs ? (fr / fs) / iroas : null,
        current_monthly: active ? runSpend : 0, prior_monthly: priorMonthly,
        two_windows: ms(cut) - ms(firstSend) >= 48 * 864e5,
        recent_cvr: recentCvr, base_cvr: baseCvr, recent_postcards_month: recentPc, base_postcards_month: basePc, saturating,
      });
    });
    const total = out.reduce((a, r) => a + r.spend, 0);
    out.forEach((r) => { r.spend_share = total ? r.spend / total * 100 : 0; });
    return out.sort((a, b) => b.spend - a.spend);
  },
});

dash.calc('account', {
  title: 'Account summary',
  description: 'Account totals on final results (sends 48+ days old), postcards still collecting orders, spend-weighted iROAS across measured campaigns, and monthly run rate.',
  inputs: ['sheet', 'campaign_stats'],
  fn: (sheet, campaign_stats) => {
    const rows = sheet.filter((r) => r.date && r.campaign_id);
    const asOf = rows.reduce((m, r) => (r.date > m ? r.date : m), '');
    const first = rows.reduce((m, r) => (!m || r.date < m ? r.date : m), '');
    const ms = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    const cut = iso(ms(asOf) - 48 * 864e5); const newCut = iso(ms(asOf) - 14 * 864e5);
    const addMonths = (m, k) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1)).toISOString().slice(0, 7);
    const sum = (arr, f) => arr.reduce((a, r) => a + (Number(r[f]) || 0), 0);
    const fin = rows.filter((r) => r.date <= cut); const fly = rows.filter((r) => r.date > cut);
    const am = asOf.slice(0, 7);
    const spendIn = (ks) => rows.filter((r) => ks.includes(r.date.slice(0, 7))).reduce((a, r) => a + (Number(r.spend) || 0), 0) / 3;
    const recent = spendIn([addMonths(am, -3), addMonths(am, -2), addMonths(am, -1)]);
    const prior = spendIn([addMonths(am, -6), addMonths(am, -5), addMonths(am, -4)]);
    const meas = campaign_stats.filter((c) => c.iroas != null);
    const mSpend = meas.reduce((a, c) => a + c.spend, 0); const total = campaign_stats.reduce((a, c) => a + c.spend, 0);
    const iRev = meas.reduce((a, c) => a + c.irevenue, 0);
    const ir = meas.map((c) => c.iroas).sort((a, b) => a - b);
    const prosp = campaign_stats.filter((c) => c.category === 'Prospecting').reduce((a, c) => a + c.spend, 0);
    const yr = +asOf.slice(0, 4); const nov = (+asOf.slice(5, 7) >= 11 ? yr : yr - 1) + '-11';
    const bfcm = rows.filter((r) => r.date.slice(0, 7) === nov).reduce((a, r) => a + (Number(r.spend) || 0), 0);
    const fs = sum(fin, 'spend'); const fr = sum(fin, 'revenue'); const fo = sum(fin, 'conversions'); const fp = sum(fin, 'impressions');
    return [{
      as_of: asOf, final_through: cut, first_send: first, last_send: asOf, rows_read: rows.length, campaigns: campaign_stats.length,
      postcards: fp, spend: fs, orders: fo, revenue: fr, roas: fs ? fr / fs : null, cpa: fo ? fs / fo : null, aov: fo ? fr / fo : null, conversion_rate: fp ? fo / fp * 100 : null,
      in_flight_spend: sum(fly, 'spend'), in_flight_postcards: sum(fly, 'impressions'), new_spend: sum(rows.filter((r) => r.date > newCut), 'spend'),
      measured_campaigns: meas.length, measured_spend: mSpend, measured_share: total ? mSpend / total * 100 : 0,
      weighted_iroas: mSpend ? iRev / mSpend : null, irevenue: iRev,
      iroas_min: ir.length ? ir[0] : null, iroas_median: ir.length ? (ir.length % 2 ? ir[(ir.length - 1) / 2] : (ir[ir.length / 2 - 1] + ir[ir.length / 2]) / 2) : null, iroas_max: ir.length ? ir[ir.length - 1] : null,
      run_rate: recent, prior_run_rate: prior, run_rate_change: prior ? (recent - prior) / prior * 100 : null,
      run_window: addMonths(am, -3) + ' to ' + addMonths(am, -1),
      prospecting_share: total ? prosp / total * 100 : 0, bfcm_month: nov, bfcm_spend: bfcm,
    }];
  },
});

dash.calc('monthly', {
  title: 'Results by send month',
  description: 'Postcards, spend, orders, revenue and ROAS by send month, share of spend with an iROAS, and whether the month is final.',
  inputs: ['sheet'],
  fn: (sheet) => {
    const rows = sheet.filter((r) => r.date && r.campaign_id);
    const asOf = rows.reduce((m, r) => (r.date > m ? r.date : m), '');
    const ms = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const cut = new Date(ms(asOf) - 48 * 864e5).toISOString().slice(0, 10);
    const measured = new Set(rows.filter((r) => r.iroas != null).map((r) => String(r.campaign_id)));
    const m = {};
    rows.forEach((r) => { const k = r.date.slice(0, 7); m[k] = m[k] || { month: k, postcards: 0, spend: 0, orders: 0, revenue: 0, mspend: 0 }; const x = m[k]; x.postcards += Number(r.impressions) || 0; x.spend += Number(r.spend) || 0; x.orders += Number(r.conversions) || 0; x.revenue += Number(r.revenue) || 0; if (measured.has(String(r.campaign_id))) x.mspend += Number(r.spend) || 0; });
    return Object.values(m).sort((a, b) => a.month.localeCompare(b.month)).map((x) => {
      const end = new Date(Date.UTC(+x.month.slice(0, 4), +x.month.slice(5, 7), 0)).toISOString().slice(0, 10);
      const status = end <= cut ? 'Final' : (x.month + '-01' <= cut ? 'Partly final' : 'Still collecting orders');
      return { month: x.month, postcards: x.postcards, spend: x.spend, orders: x.orders, revenue: x.revenue, roas: x.spend ? x.revenue / x.spend : null, iroas_coverage: x.spend ? x.mspend / x.spend * 100 : 0, status };
    });
  },
});

dash.calc('categories', {
  title: 'Results by category',
  description: 'Final results by campaign category with spend-weighted iROAS over each category\'s measured campaigns.',
  inputs: ['campaign_stats'],
  fn: (campaign_stats) => {
    const desc = { Retention: 'Existing customers: winback, loyalty, one-time customer sends', Retargeting: 'Subscribers and cart abandoners who have not bought yet', Prospecting: 'New customers who have never bought', Other: 'No category set' };
    const g = {};
    campaign_stats.forEach((c) => { const k = c.category; g[k] = g[k] || { category: k, description: desc[k] || '', postcards: 0, spend: 0, orders: 0, revenue: 0, mspend: 0, irev: 0, measured: 0, campaigns: 0, lifetime: 0 }; const x = g[k]; x.postcards += c.final_postcards; x.spend += c.final_spend; x.orders += c.orders; x.revenue += c.revenue; x.campaigns += 1; x.lifetime += c.spend; if (c.iroas != null) { x.mspend += c.spend; x.irev += c.irevenue; x.measured += 1; } });
    return Object.values(g).map((x) => ({ category: x.category, description: x.description, campaigns: x.campaigns, postcards: x.postcards, spend: x.spend, orders: x.orders, revenue: x.revenue, roas: x.spend ? x.revenue / x.spend : null, cpa: x.orders ? x.spend / x.orders : null, weighted_iroas: x.mspend ? x.irev / x.mspend : null, measured_campaigns: x.measured, lifetime_spend: x.lifetime })).sort((a, b) => b.spend - a.spend);
  },
});

dash.calc('always_on', {
  title: 'Always-on campaigns by month',
  description: 'Conversion rate (orders per postcard) by final send month for campaigns that mailed in four or more months and are still running or ran recently.',
  inputs: ['sheet', 'campaign_stats'],
  fn: (sheet, campaign_stats) => {
    const rows = sheet.filter((r) => r.date && r.campaign_id);
    const asOf = rows.reduce((m, r) => (r.date > m ? r.date : m), '');
    const ms = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const cut = new Date(ms(asOf) - 48 * 864e5).toISOString().slice(0, 10);
    const keep = new Map(campaign_stats.filter((c) => c.send_months >= 3 && ms(asOf) - ms(c.last_send) <= 75 * 864e5).map((c) => [c.campaign_id, c.short_name]));
    const g = {};
    rows.forEach((r) => {
      const id = String(r.campaign_id); if (!keep.has(id)) return;
      const m = r.date.slice(0, 7); const end = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10);
      if (end > cut) return;
      const k = m + '|' + id; g[k] = g[k] || { month: m, campaign_id: id, campaign: keep.get(id), postcards: 0, orders: 0 };
      g[k].postcards += Number(r.impressions) || 0; g[k].orders += Number(r.conversions) || 0;
    });
    return Object.values(g).map((x) => ({ ...x, conversion_rate: x.postcards ? x.orders / x.postcards * 100 : null })).sort((a, b) => a.month.localeCompare(b.month));
  },
});

dash.calc('plan', {
  title: 'Monthly budget plan',
  description: 'Proposed monthly spend per campaign from the reporting rules: grow measured campaigns with iROAS of 2.0+ by 50% (restarting stopped ones), make a one-time measured winner monthly, redirect half of the weakest large unmeasured campaign to the top grower, hold the rest. Projected iRevenue assumes current iROAS.',
  inputs: ['campaign_stats', 'account'],
  fn: (campaign_stats, account) => {
    const acct = account[0] || {};
    const r0 = (v) => Math.round(v || 0);
    const lines = [];
    const grow = campaign_stats.filter((c) => c.iroas != null && c.iroas >= 1 && c.final_spend >= 1000 && c.final_postcards >= 1000 && !c.saturating).sort((a, b) => b.iroas - a.iroas);
    grow.forEach((c) => {
      const recurring = c.send_months >= 2;
      const base = recurring ? (c.current_monthly || c.prior_monthly) : 0;
      const mult = c.iroas >= 2 ? 1.5 : 1.2;
      const proposed = recurring ? base * mult : c.spend;
      lines.push({ campaign_id: c.campaign_id, line: c.short_name, kind: 'grow', change: recurring ? (c.current_monthly ? 'Grow' : 'Restart and grow') : 'Make monthly', current_monthly: r0(c.current_monthly), proposed_monthly: r0(proposed), iroas: c.iroas, category: c.category });
    });
    const src = campaign_stats.filter((c) => c.status === 'Running' && c.iroas == null && c.final_postcards >= 1000 && c.roas != null && acct.roas && c.roas < acct.roas / 2 && c.current_monthly > 0).sort((a, b) => b.current_monthly - a.current_monthly)[0];
    const dest = src ? (lines.find((l) => l.category === src.category && l.change !== 'Make monthly') || lines.find((l) => l.change !== 'Make monthly')) : null;
    if (src && dest) {
      const amt = r0(src.current_monthly / 2);
      dest.proposed_monthly += amt; dest.redirect_in = amt; dest.redirect_from = src.short_name;
      lines.push({ campaign_id: src.campaign_id, line: src.short_name, kind: 'redirect', change: 'Redirect half to ' + dest.line + '; add control group', current_monthly: r0(src.current_monthly), proposed_monthly: r0(src.current_monthly) - amt, iroas: null, category: src.category, redirect_out: amt });
    }
    const topGrow = lines.find((l) => l.kind === 'grow' && l.change !== 'Make monthly');
    campaign_stats.filter((c) => c.status === 'Running' && c.iroas != null && c.iroas < 1 && c.final_postcards >= 1000 && c.two_windows && c.current_monthly > 0 && !lines.find((l) => l.campaign_id === c.campaign_id)).forEach((c) => {
      const amt = r0(c.current_monthly / 2);
      if (topGrow) {
        topGrow.proposed_monthly += amt; topGrow.redirect_in = (topGrow.redirect_in || 0) + amt; topGrow.redirect_from = topGrow.redirect_from ? topGrow.redirect_from + ' and ' + c.short_name : c.short_name;
        lines.push({ campaign_id: c.campaign_id, line: c.short_name, kind: 'redirect', change: 'Redirect half to ' + topGrow.line + '; refocus the rest', current_monthly: r0(c.current_monthly), proposed_monthly: r0(c.current_monthly) - amt, iroas: c.iroas, category: c.category, redirect_out: amt });
      } else {
        lines.push({ campaign_id: c.campaign_id, line: c.short_name, kind: 'reduce', change: 'Reduce by half; refocus the rest', current_monthly: r0(c.current_monthly), proposed_monthly: r0(c.current_monthly) - amt, iroas: c.iroas, category: c.category });
      }
    });
    campaign_stats.filter((c) => c.status === 'Running' && !lines.find((l) => l.campaign_id === c.campaign_id) && c.current_monthly > 0 && c.send_months >= 2).forEach((c) => {
      lines.push({ campaign_id: c.campaign_id, line: c.short_name, kind: c.saturating ? 'improve' : 'hold', change: c.saturating ? 'Hold; test offer' : (c.iroas == null ? 'Hold; add control group' : (c.iroas < 1 ? 'Hold; refocus on best segment' : 'Hold')), current_monthly: r0(c.current_monthly), proposed_monthly: r0(c.current_monthly), iroas: c.iroas, category: c.category });
    });
    const order = { grow: 0, redirect: 1, reduce: 2, improve: 3, hold: 4 };
    return lines.map((l) => ({ ...l, projected_irevenue: l.iroas != null ? r0(l.proposed_monthly * l.iroas) : null, current_irevenue: l.iroas != null ? r0(l.current_monthly * l.iroas) : null })).sort((a, b) => order[a.kind] - order[b.kind] || b.proposed_monthly - a.proposed_monthly);
  },
});

dash.calc('plan_totals', {
  title: 'Budget plan totals',
  description: 'Current and proposed monthly spend and projected iRevenue across the budget plan.',
  inputs: ['plan'],
  fn: (plan) => {
    const current = plan.reduce((a, r) => a + (r.current_monthly || 0), 0);
    const proposed = plan.reduce((a, r) => a + (r.proposed_monthly || 0), 0);
    const projected_irevenue = plan.reduce((a, r) => a + (r.projected_irevenue || 0), 0);
    const current_irevenue = plan.reduce((a, r) => a + (r.current_irevenue || 0), 0);
    return [{ current, proposed, change: proposed - current, change_pct: current ? (proposed - current) / current * 100 : null, projected_irevenue, current_irevenue }];
  },
});

dash.calc('recommendations', {
  title: 'Recommendations',
  description: 'Three to five recommendations generated from your numbers with iROAS-first rules: grow what is proven, measure what is not, redirect or reduce what is below break-even.',
  inputs: ['campaign_stats', 'account', 'plan'],
  fn: (campaign_stats, account, plan) => {
    const a = account[0] || {};
    const $ = (v) => '$' + Math.round(v).toLocaleString('en-US');
    const x2 = (v) => Number(v).toFixed(2);
    const n = (v) => Math.round(v).toLocaleString('en-US');
    const day = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const recs = [];
    const best = campaign_stats.filter((c) => c.iroas != null).sort((p, q) => q.iroas - p.iroas)[0];
    plan.filter((l) => l.kind === 'grow').forEach((l) => {
      const c = campaign_stats.find((k) => k.campaign_id === l.campaign_id); if (!c) return;
      const isBest = best && best.campaign_id === c.campaign_id;
      const finite = c.category !== 'Prospecting' ? ' This audience is limited in size, so iROAS will likely ease as volume grows; keep the control group on to track it.' : '';
      const conf = c.final_postcards >= 1000 ? 'High' : 'Low';
      const gain = (l.proposed_monthly - l.current_monthly) * c.iroas;
      if (l.change === 'Make monthly') {
        const gap = c.category === 'Prospecting' && a.prospecting_share < 10 ? ' Prospecting is ' + Math.round(a.prospecting_share) + '% of your spend, your biggest category gap.' : '';
        recs.push({ kind: 'Grow', upside: gain, title: 'Make ' + c.short_name + ' a monthly program', campaign: c.campaign,
          why: 'Its ' + x2(c.iroas) + ' iROAS came from a single send of ' + n(c.postcards) + ' postcards.' + gap,
          action: 'Mail about ' + n(c.postcards) + ' postcards a month (around ' + $(l.proposed_monthly) + ') with a control group from the first send.',
          expected: 'About ' + $(l.projected_irevenue) + ' a month in iRevenue. It still breaks even if iROAS falls to 1.00.',
          confidence: conf + (c.orders < 50 ? ' (the result rests on ' + n(c.orders) + ' orders, so the first review will firm it up)' : '') });
      } else if (l.change === 'Restart and grow') {
        recs.push({ kind: 'Grow', upside: gain, title: 'Restart ' + c.short_name + ' and grow it', campaign: c.campaign,
          why: 'Its ' + x2(c.iroas) + ' iROAS on ' + n(c.postcards) + ' postcards is ' + (isBest ? 'the best in your account' : 'well above break-even') + '. It last sent on ' + day(c.last_send) + '.',
          action: 'If you stopped it on purpose (for example, the audience ran low), look for a comparable audience. Otherwise restart it at its earlier ' + $(c.prior_monthly) + ' a month and grow it to about ' + $(l.proposed_monthly) + ' a month' + (l.redirect_in ? ', including ' + $(l.redirect_in) + ' redirected from ' + l.redirect_from : '') + '.',
          expected: 'About ' + $(l.projected_irevenue) + ' a month in iRevenue.' + finite,
          confidence: conf });
      } else {
        recs.push({ kind: 'Grow', upside: gain, title: 'Grow ' + c.short_name, campaign: c.campaign,
          why: 'Its ' + x2(c.iroas) + ' iROAS on ' + n(c.postcards) + ' postcards pays for itself several times over.',
          action: 'Raise it from about ' + $(l.current_monthly) + ' to ' + $(l.proposed_monthly) + ' a month' + (l.redirect_in ? ', including ' + $(l.redirect_in) + ' redirected from ' + l.redirect_from : '') + ', with the control group kept on.',
          expected: 'iRevenue rises from about ' + $(l.current_irevenue) + ' to ' + $(l.projected_irevenue) + ' a month.' + finite,
          confidence: conf });
      }
    });
    const oneTime = campaign_stats.filter((c) => c.status === 'Finished' && c.send_months <= 2 && c.iroas == null && c.final_postcards >= 1000 && a.roas && c.roas > a.roas).sort((p, q) => q.roas - p.roas).slice(0, 4);
    if (oneTime.length) {
      const lo = Math.min(...oneTime.map((c) => c.roas)); const hi = Math.max(...oneTime.map((c) => c.roas));
      const small = campaign_stats.filter((c) => c.iroas == null && c.final_postcards > 0 && c.final_postcards < 1000 && c.roas > hi).sort((p, q) => q.roas - p.roas)[0];
      const bf = a.bfcm_spend > 0 ? ' Last November you spent ' + $(a.bfcm_spend) + ' on mail.' : '';
      recs.push({ kind: 'Grow + measure', upside: 0.5 * oneTime.reduce((s, c) => s + c.spend, 0), title: 'Repeat your strongest one-time customer sends, with control groups', campaign: oneTime.map((c) => c.short_name).join('; '),
        why: 'These one-time sends earned ' + Math.round(lo) + ' to ' + Math.round(hi) + ' ROAS, well above your ' + x2(a.roas) + ' account average, but none had a control group.' + bf,
        action: 'Rerun these segments at their earlier volume, holding back 20% of each audience as a control group.',
        expected: 'The control group turns that ROAS into a measured iROAS, the proof needed before spending more on these sends.',
        confidence: 'Medium (ROAS only, on 1,000+ postcards each)' + (small ? '. ' + small.short_name + ' shows ' + Math.round(small.roas) + ' ROAS on fewer than 1,000 postcards, so treat it as directional' : '') });
    }
    if (a.measured_share < 50) {
      const um = campaign_stats.filter((c) => c.status === 'Running' && c.iroas == null).sort((p, q) => q.final_spend - p.final_spend).slice(0, 3);
      if (um.length) {
        const s = um.reduce((t, c) => t + c.final_spend, 0); const pct = a.spend ? s / a.spend * 100 : 0;
        const red = plan.find((l) => l.kind === 'redirect'); const rc = red && campaign_stats.find((c) => c.campaign_id === red.campaign_id);
        recs.push({ kind: 'Measure', upside: 0.25 * s / 12, title: 'Add control groups to your biggest unmeasured campaigns', campaign: um.map((c) => c.short_name).join('; '),
          why: 'Together they account for ' + $(s) + ' of final spend (about ' + Math.round(pct) + '%), and none has an iROAS yet.' + (rc ? ' ' + rc.short_name + ' has ' + x2(rc.roas) + ' ROAS, under half your account average.' : ''),
          action: 'Turn on control groups for ' + (um.length > 1 ? 'all ' + (['', 'one', 'two', 'three'][um.length]) : 'it') + '.' + (rc ? ' Test a variation of ' + rc.short_name + ' (for example, a later send timing) against the current version at the same total budget.' : ''),
          expected: 'An iROAS for about ' + Math.round(pct) + '% more of your spend, which shows where the next dollar should go.',
          confidence: 'Medium' });
      }
    }
    campaign_stats.filter((c) => c.saturating).forEach((c) => {
      recs.push({ kind: 'Improve', upside: 0, title: 'Hold ' + c.short_name + ' steady while testing the offer', campaign: c.campaign,
        why: (c.iroas != null ? 'A ' + x2(c.iroas) + ' iROAS is ' + (c.iroas >= 1 ? 'profitable' : 'below break-even') + '. But w' : 'W') + 'hen its volume rose to about ' + n(c.recent_postcards_month) + ' postcards a month (from ' + n(c.base_postcards_month) + '), its conversion rate fell from ' + c.base_cvr.toFixed(1) + '% to ' + c.recent_cvr.toFixed(1) + '%, a sign the audience is getting saturated.',
        action: 'Test a smaller discount or a tighter audience against the current version on the same budget.',
        expected: 'Same spend, with a read on whether a leaner offer keeps or improves iROAS.',
        confidence: c.iroas != null && c.final_postcards >= 1000 ? 'High' : 'Medium' });
    });
    if (!campaign_stats.some((c) => c.category === 'Prospecting')) {
      recs.push({ kind: 'Grow', upside: 0.15 * a.run_rate, title: 'Add a Prospecting campaign', campaign: 'New customers',
        why: 'Every campaign so far mails people who already know you.', action: 'Start a Prospecting campaign at about ' + $(0.15 * a.run_rate) + ' a month with a control group from day one.',
        expected: 'A measured iROAS on new-customer acquisition within one 48-day window.', confidence: 'Low' });
    }
    plan.filter((l) => l.kind === 'redirect' || l.kind === 'reduce').forEach((l) => {
      const c = campaign_stats.find((k) => k.campaign_id === l.campaign_id); if (!c || c.iroas == null) return;
      const isReduce = l.kind === 'reduce';
      recs.push({ kind: isReduce ? 'Reduce' : 'Redirect', upside: isReduce ? 0 : (l.redirect_out || 0) * 0.5, title: (isReduce ? 'Reduce ' : 'Redirect part of ') + c.short_name, campaign: c.campaign,
        why: 'Its ' + x2(c.iroas) + ' iROAS on ' + n(c.final_postcards) + ' postcards with final results means it brings in less new revenue than it costs, and that has held for more than one 48-day window.',
        action: (isReduce ? 'Cut its monthly spend by about ' + $(l.current_monthly - l.proposed_monthly) : 'Move about ' + $(l.redirect_out) + ' a month to your strongest measured campaign') + ', and refocus what remains on its best-responding customers (recent or higher-value buyers), keeping the control group on.',
        expected: isReduce ? 'Lower spend on a campaign that is not paying for itself, while the refocused version shows whether it can.' : 'The same total budget working at a higher iROAS.',
        confidence: 'High' });
    });
    const kOrder = { Grow: 0, 'Grow + measure': 1, Redirect: 2, Measure: 3, Improve: 4, Reduce: 5 };
    return recs.sort((p, q) => (kOrder[p.kind] - kOrder[q.kind]) || (q.upside - p.upside)).slice(0, 5).map((r, i) => ({ rank: i + 1, ...r }));
  },
});

