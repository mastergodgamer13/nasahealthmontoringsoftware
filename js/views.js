/* views.js — "Pre/post-flight" (dashboard), "Compare users" and "Real data (OSDR)" views. Browser only. All logic is in core.js / osdr.js. */
(function (root) {
  'use strict';

  var sel = { cmpInd: 'hr', analyte: 'glucose', crew: 'C001' };

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  function picker(ctx, items, current, onPick, label) {
    var wrap = el('div', { class: 'picker', role: 'group', 'aria-label': label });
    items.forEach(function (it) {
      var b = el('button', { type: 'button', 'class': 'pick' + (it.id === current ? ' active' : ''), 'aria-pressed': String(it.id === current), text: it.label });
      b.addEventListener('click', function () { onPick(it.id); });
      wrap.appendChild(b);
    });
    return wrap;
  }

  /* ---------- Compare users ---------- */
  function renderCompare(ctx, box) {
    var t = ctx.t, Core = ctx.Core;
    box.innerHTML = '';
    box.appendChild(el('h2', { text: t('cmp.title') }));
    box.appendChild(el('p', { class: 'hint', text: t('cmp.intro') }));
    var users = ctx.store.users();
    if (!users.length) { box.appendChild(el('p', { class: 'empty', text: t('cmp.empty') })); return; }

    var assessed = users.map(function (u) { return { user: u, a: Core.assess(u.entries) }; });
    var head = el('tr', null, [el('th', { scope: 'col', text: t('cmp.indicator') })]);
    assessed.forEach(function (x) {
      head.appendChild(el('th', { scope: 'col' }, [x.user.name, el('div', { class: 'meta', text: t('cmp.readings', { n: x.user.entries.length }) })]));
    });
    var tbody = el('tbody');
    Core.INDICATORS.forEach(function (ind) {
      var tr = el('tr', null, [el('th', { scope: 'row', text: ctx.indLabel(ind) + ' (' + ctx.unitOf(ind) + ')' })]);
      assessed.forEach(function (x) {
        var res = x.a.per[ind.id];
        var latest = res.series.length ? res.series[res.series.length - 1].value : null;
        tr.appendChild(el('td', null, [
          el('div', { class: 'cell-val', text: latest === null ? '—' : ctx.fmt(latest, ind) }),
          ctx.chip(res.status)
        ]));
      });
      tbody.appendChild(tr);
    });
    box.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'cmp' }, [el('thead', null, [head]), tbody])]));

    // overlay chart for one indicator
    box.appendChild(el('h3', { text: t('cmp.chartTitle') }));
    box.appendChild(picker(ctx, Core.INDICATORS.map(function (i) { return { id: i.id, label: ctx.indLabel(i) }; }), sel.cmpInd,
      function (id) { sel.cmpInd = id; renderCompare(ctx, box); }, t('cmp.pick')));
    var ind = Core.getIndicator(sel.cmpInd);
    var series = [], allT = [];
    users.forEach(function (u) {
      var pts = Core.seriesFor(u.entries, ind.id).map(function (p) { var x = Date.parse(p.date + 'T00:00:00Z'); allT.push(x); return { x: x, y: p.value, title: p.date + ': ' + ctx.fmt(p.value, ind) + ' ' + ctx.unitOf(ind) }; });
      series.push({ name: u.name, points: pts });
    });
    if (!allT.length) { box.appendChild(el('p', { class: 'empty', text: '—' })); return; }
    var xMin = Math.min.apply(null, allT), xMax = Math.max.apply(null, allT);
    function d(x) { return new Date(x).toISOString().slice(0, 10); }
    var chart = Charts.multiChart({
      series: series, xMin: xMin, xMax: xMax, unit: ctx.unitOf(ind), decimals: ind.step < 1 ? 1 : 0,
      xTicks: xMax === xMin ? [{ x: xMin, text: d(xMin) }] : [{ x: xMin, text: d(xMin) }, { x: xMax, text: d(xMax) }],
      aria: t('cmp.chartAria', { label: ctx.indLabel(ind) })
    });
    box.appendChild(chart);
    box.appendChild(Charts.legend(users.map(function (u) { return u.name; })));
  }

  /* ---------- Dashboard: typed-in pre-/post-flight values of the selected user ---------- */
  function renderFlight(ctx, box, records) {
    var t = ctx.t, O = ctx.Osdr;
    box.innerHTML = '';
    var sum = O.flightSummary(records);
    if (!sum.tps.length) { box.appendChild(el('p', { class: 'empty', text: t('fl.none') })); return; }
    var names = Object.keys(O.ANALYTES);
    var head = el('tr', null, [el('th', { scope: 'col', text: t('osdr.tp') })]);
    names.forEach(function (a) { head.appendChild(el('th', { scope: 'col', text: t('osdr.a.' + a) + ' (' + O.ANALYTES[a].unit + ')' })); });
    var tbody = el('tbody');
    sum.tps.forEach(function (tp, i) {
      var tr = el('tr', null, [el('th', { scope: 'row' }, [tp, el('div', { class: 'meta', text: t('fl.group.' + O.groupOf(tp)) })])]);
      names.forEach(function (a) {
        var an = O.ANALYTES[a], dd = an.decimals === 0 ? 1 : 2, p = sum.analytes[a].points[i];
        if (p.value === null) { tr.appendChild(el('td', { text: '—' })); return; }
        var kids = [p.value.toFixed(an.decimals)];
        if (p.flag) kids.push(el('span', { class: 'flag ' + p.flag, title: t('osdr.' + p.flag), text: p.flag === 'low' ? ' ▼' : ' ▲' }));
        if (p.delta !== null) kids.push(el('div', { class: 'meta', text: (p.delta >= 0 ? '+' : '') + p.delta.toFixed(dd) }));
        if (p.vsPre) kids.push(el('div', { class: 'meta', text: (p.vsPre === 'below' ? '↓ ' : '↑ ') + t('pp.' + p.vsPre) }));
        tr.appendChild(el('td', null, kids));
      });
      tbody.appendChild(tr);
    });
    var pre = el('tr', { class: 'sumrow' }, [el('th', { scope: 'row', text: t('fl.preMean') })]);
    names.forEach(function (a) {
      var an = O.ANALYTES[a], s = sum.analytes[a];
      pre.appendChild(el('td', null, s.preN ? [s.preMean.toFixed(an.decimals === 0 ? 1 : 2), el('div', { class: 'meta', text: t('fl.n', { n: s.preN, total: O.PRE }) })] : ['—']));
    });
    tbody.appendChild(pre);
    box.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'cmp' }, [el('thead', null, [head]), tbody])]));
    box.appendChild(el('p', { class: 'meta', text: '▼ ' + t('osdr.low') + ' · ▲ ' + t('osdr.high') + ' · ' + t('osdr.delta') + ' (+/−)' }));
    box.appendChild(el('p', { class: 'meta', text: t('fl.note') }));
  }

  /* ---------- Dashboard: pre-flight vs post-flight (real OSDR data, descriptive) ---------- */
  // opts.sub = true: shown inside the "Real data" tab (sub-heading, no repeated badge)
  function renderPrePost(ctx, box, opts) {
    var t = ctx.t, O = ctx.Osdr;
    box.innerHTML = '';
    if (opts && opts.sub) {
      box.appendChild(el('h3', { text: t('pp.title') }));
    } else {
      box.appendChild(el('h2', { text: t('pp.title') }));
      box.appendChild(el('div', { class: 'badge real', text: t('osdr.badge') }));
    }
    box.appendChild(el('p', { class: 'msg', text: t('pp.intro') }));
    box.appendChild(picker(ctx, O.crewIds().map(function (c) { return { id: c, label: c }; }), sel.crew,
      function (id) { sel.crew = id; renderPrePost(ctx, box, opts); }, t('pp.crew')));

    var data = O.prePost(sel.crew);
    var posts = O.TIMEPOINTS.slice(O.PRE);
    var head = el('tr', null, [el('th', { scope: 'col', text: t('osdr.analyte') }), el('th', { scope: 'col', text: t('pp.pre') })]);
    posts.forEach(function (tp) { head.appendChild(el('th', { scope: 'col', text: t('pp.post') + ' ' + tp })); });
    var tbody = el('tbody');
    Object.keys(O.ANALYTES).forEach(function (a) {
      var an = O.ANALYTES[a], d = data[a], dd = an.decimals === 0 ? 1 : 2;
      var tr = el('tr', null, [
        el('th', { scope: 'row', text: t('osdr.a.' + a) + ' (' + an.unit + ')' }),
        el('td', null, [d.preMean.toFixed(dd), el('div', { class: 'meta', text: t('pp.range') + ': ' + d.preMin.toFixed(an.decimals) + '–' + d.preMax.toFixed(an.decimals) })])
      ]);
      d.post.forEach(function (p) {
        var kids = [p.value.toFixed(an.decimals)];
        if (p.flag) kids.push(el('span', { class: 'flag ' + p.flag, title: t('osdr.' + p.flag), text: p.flag === 'low' ? ' ▼' : ' ▲' }));
        kids.push(el('div', { class: 'meta', text: (p.delta >= 0 ? '+' : '') + p.delta.toFixed(dd) }));
        if (p.vsPre) kids.push(el('div', { class: 'meta', text: (p.vsPre === 'below' ? '↓ ' : '↑ ') + t('pp.' + p.vsPre) }));
        tr.appendChild(el('td', null, kids));
      });
      tbody.appendChild(tr);
    });
    box.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'cmp' }, [el('thead', null, [head]), tbody])]));
    box.appendChild(el('p', { class: 'meta', text: '▼ ' + t('osdr.low') + ' · ▲ ' + t('osdr.high') + ' · ' + t('osdr.delta') + ' (+/−)' }));
    box.appendChild(el('p', { class: 'msg', text: t('pp.note') }));
    box.appendChild(el('p', { class: 'meta' }, [t('osdr.source') + ' ', el('a', { href: O.SOURCE_URL, target: '_blank', rel: 'noopener noreferrer', text: t('osdr.link') })]));
  }

  /* ---------- Real data: OSD-635 study information (metadata only, no gene results yet) ---------- */
  function renderOsd635(ctx, box) {
    var t = ctx.t, O = ctx.Osd635, S = O.STUDY;
    box.innerHTML = '';
    box.appendChild(el('h3', { text: t('o6.title') + ': ' + S.id }));
    box.appendChild(el('div', { class: 'badge real', text: t('o6.badge') }));
    box.appendChild(el('p', { class: 'msg', text: S.title }));
    box.appendChild(el('p', { class: 'hint', text: t('o6.what') }));

    var rows = [
      [t('o6.f.cell'), S.cell + ' — ' + S.organism],
      [t('o6.f.design'), t('o6.v.design', { f: O.count('flight'), g: O.count('ground') })],
      [t('o6.f.culture'), t('o6.v.culture', { d: S.cultureDays, c: S.cultureTempC })],
      [t('o6.f.mission'), S.mission + ', ' + S.program + ', ' + S.missionStart + ' – ' + S.missionEnd],
      [t('o6.f.hardware'), S.hardware],
      [t('o6.f.sequencing'), S.platform + ', ' + S.library]
    ];
    var tb = el('tbody');
    rows.forEach(function (r) { tb.appendChild(el('tr', null, [el('th', { scope: 'row', text: r[0] }), el('td', { text: r[1] })])); });
    box.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'cmp' }, [tb])]));

    var head = el('tr', null, ['o6.sample', 'o6.group', 'o6.depth', 'o6.rrna'].map(function (k) { return el('th', { scope: 'col', text: t(k) }); }));
    var body = el('tbody');
    O.SAMPLES.forEach(function (s) {
      body.appendChild(el('tr', null, [
        el('th', { scope: 'row', text: s.id }), el('td', { text: t('o6.g.' + s.group) }),
        el('td', { text: s.readDepth.toLocaleString('en-US') }), el('td', { text: s.rrna.toFixed(2) + ' %' })
      ]));
    });
    box.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'cmp' }, [el('thead', null, [head]), body])]));

    box.appendChild(el('div', { class: 'callout', role: 'note', text: t('o6.pending', { file: S.resultsFile }) }));
    box.appendChild(el('p', { class: 'meta', text: t('o6.stated', { n: S.statedSignificantGenes.toLocaleString('en-US') }) }));
    box.appendChild(el('p', { class: 'meta' }, [t('o6.source', { files: S.sourceFiles.join(', ') }) + ' ', el('a', { href: O.DOI_URL, target: '_blank', rel: 'noopener noreferrer', text: t('o6.paper') })]));
  }

  /* ---------- Real data (OSDR) ---------- */
  function renderOsdr(ctx, box) {
    var t = ctx.t, O = ctx.Osdr;
    box.innerHTML = '';
    box.appendChild(el('h2', { text: t('osdr.title') }));
    box.appendChild(el('div', { class: 'badge real', text: t('osdr.badge') }));
    box.appendChild(el('p', { class: 'msg', text: t('osdr.what') }));

    var an = O.ANALYTES[sel.analyte];
    box.appendChild(picker(ctx, Object.keys(O.ANALYTES).map(function (k) { return { id: k, label: t('osdr.a.' + k) }; }), sel.analyte,
      function (id) { sel.analyte = id; renderOsdr(ctx, box); }, t('osdr.analyte')));
    box.appendChild(el('p', { class: 'hint', text: t('osdr.range', { lo: an.lo, hi: an.hi, unit: an.unit }) }));

    var crew = O.crewIds();
    var series = crew.map(function (c) {
      return { name: c, points: O.summary(c, sel.analyte).points.map(function (p, i) { return { x: i, y: p.value, title: p.tp + ': ' + p.value.toFixed(an.decimals) + ' ' + an.unit }; }) };
    });
    var label = t('osdr.a.' + sel.analyte) + ' (' + an.unit + ')';
    box.appendChild(Charts.multiChart({
      series: series, xMin: 0, xMax: O.TIMEPOINTS.length - 1, band: { lo: an.lo, hi: an.hi }, unit: an.unit, decimals: an.decimals,
      xTicks: O.TIMEPOINTS.map(function (tp, i) { return { x: i, text: tp }; }),
      marks: [{ x: O.PRE - 0.5, text: t('osdr.flight') }],
      aria: t('osdr.chartAria', { label: label })
    }));
    box.appendChild(Charts.legend(crew));

    // table: time points x crew; out-of-range values are marked with a symbol AND text
    var head = el('tr', null, [el('th', { scope: 'col', text: t('osdr.tp') })]);
    crew.forEach(function (c) { head.appendChild(el('th', { scope: 'col', text: c })); });
    var tbody = el('tbody');
    var sums = crew.map(function (c) { return O.summary(c, sel.analyte); });
    O.TIMEPOINTS.forEach(function (tp, i) {
      var tr = el('tr', null, [el('th', { scope: 'row', text: tp })]);
      sums.forEach(function (s) {
        var p = s.points[i], txt = p.value.toFixed(an.decimals);
        var kids = [txt];
        if (p.flag) kids.push(el('span', { class: 'flag ' + p.flag, title: t('osdr.' + p.flag), text: p.flag === 'low' ? ' ▼' : ' ▲' }));
        if (p.delta !== null) kids.push(el('div', { class: 'meta', text: (p.delta >= 0 ? '+' : '') + p.delta.toFixed(an.decimals === 0 ? 1 : 2) }));
        tr.appendChild(el('td', null, kids));
      });
      tbody.appendChild(tr);
    });
    var pre = el('tr', { class: 'sumrow' }, [el('th', { scope: 'row', text: t('osdr.preMean') })]);
    sums.forEach(function (s) { pre.appendChild(el('td', { text: s.preMean.toFixed(an.decimals === 0 ? 1 : 2) })); });
    tbody.appendChild(pre);
    box.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'cmp' }, [el('thead', null, [head]), tbody])]));
    box.appendChild(el('p', { class: 'meta', text: '▼ ' + t('osdr.low') + ' · ▲ ' + t('osdr.high') + ' · ' + t('osdr.delta') + ' (+/−)' }));

    O.outsideAt(sel.analyte, 2).forEach(function (o) {
      box.appendChild(el('div', { class: 'callout', role: 'note', text: t('osdr.out', { tp: o.tp, n: o.n, total: o.total, min: o.min, max: o.max, unit: an.unit }) }));
    });
    var pp = el('div', { class: 'prepost-sub' });
    box.appendChild(pp);
    renderPrePost(ctx, pp, { sub: true });
    var o6 = el('div', { class: 'osd635' });
    box.appendChild(o6);
    renderOsd635(ctx, o6);
    box.appendChild(el('p', { class: 'msg', text: t('osdr.limits') }));
    box.appendChild(el('p', { class: 'meta', text: t('osdr.fileNote') }));
    box.appendChild(el('p', { class: 'meta' }, [t('osdr.source') + ' ', el('a', { href: O.SOURCE_URL, target: '_blank', rel: 'noopener noreferrer', text: t('osdr.link') })]));
  }

  root.Views = { renderCompare: renderCompare, renderOsdr: renderOsdr, renderPrePost: renderPrePost, renderFlight: renderFlight, renderOsd635: renderOsd635 };
})(typeof window !== 'undefined' ? window : globalThis);
