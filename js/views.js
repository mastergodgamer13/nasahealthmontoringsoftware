/* views.js — "Pre/post-flight" (dashboard), "Compare users" and "Real data (OSDR)" views. Browser only. All logic is in core.js / osdr.js. */
(function (root) {
  'use strict';

  var sel = { cmpInd: 'hr', analyte: 'glucose', crew: 'C001', cbc: 'wbc', tool: 'pipeline-transcriptome-de' };

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

  /* ---------- OSD-635 gene results (table is loaded on demand: js/osd635-genes.js) ---------- */
  var genesWaiting = null;
  function loadGenes(ok, fail) {
    if (root.Osd635Genes) { ok(); return; }
    if (genesWaiting) { genesWaiting.push({ ok: ok, fail: fail }); return; }
    genesWaiting = [{ ok: ok, fail: fail }];
    var sc = document.createElement('script');
    sc.src = 'js/osd635-genes.js';
    sc.onload = function () { var w = genesWaiting; genesWaiting = null; w.forEach(function (x) { x.ok(); }); };
    sc.onerror = function () { var w = genesWaiting; genesWaiting = null; w.forEach(function (x) { x.fail(); }); };
    document.head.appendChild(sc);
  }

  function fmtP(p) { return p === null ? '—' : (p < 0.001 ? p.toExponential(2) : p.toFixed(4)); }
  function fmtMean(x) { return x === null ? '—' : x.toFixed(1); }

  function geneTable(ctx, genes, withEnsembl) {
    var t = ctx.t, Ex = ctx.Expression;
    var cols = ['ge.h.gene'].concat(withEnsembl ? ['ge.h.ensembl'] : [], ['ge.h.log2fc', 'ge.h.fc', 'ge.h.padj', 'ge.h.class', 'ge.h.flight', 'ge.h.ground']);
    var head = el('tr', null, cols.map(function (k) { return el('th', { scope: 'col', text: t(k) }); }));
    var body = el('tbody');
    genes.forEach(function (g) {
      var cls = Ex.classify(g.log2fc, g.padj);
      var arrow = cls === 'up' ? '▲ ' : cls === 'down' ? '▼ ' : '';
      var fc = g.log2fc === null ? '—' : Ex.foldChange(g.log2fc).toFixed(2);
      var cells = [el('th', { scope: 'row' }, [g.symbol || g.ensembl, g.name ? el('div', { class: 'meta', text: g.name }) : null])];
      if (withEnsembl) cells.push(el('td', { text: g.ensembl }));
      cells.push(el('td', { text: g.log2fc === null ? '—' : g.log2fc.toFixed(2) }), el('td', { text: fc }), el('td', { text: fmtP(g.padj) }),
        el('td', { text: arrow + t('ge.c.' + cls) }), el('td', { text: fmtMean(g.flightMean) }), el('td', { text: fmtMean(g.groundMean) }));
      body.appendChild(el('tr', null, cells));
    });
    return el('div', { class: 'tablewrap' }, [el('table', { class: 'cmp' }, [el('thead', null, [head]), body])]);
  }

  function renderGenes(ctx, box) {
    var t = ctx.t, O = ctx.Osd635, Ex = ctx.Expression, D = root.Osd635Genes;
    box.innerHTML = '';
    var D0 = Ex.DEFAULTS, a = O.analyze(D);
    box.appendChild(el('h4', { text: t('ge.title') }));
    box.appendChild(el('p', { class: 'msg', text: t('ge.contrast') }));
    box.appendChild(el('p', { class: 'hint', text: t('ge.thresholds', { p: D0.padj, l: D0.log2fc, f: Ex.foldChange(D0.log2fc).toFixed(2) }) }));

    var sb = el('tbody');
    Ex.CLASSES.forEach(function (c) {
      if (c === 'nodata' && !a.counts.nodata) return;
      sb.appendChild(el('tr', null, [el('th', { scope: 'row', text: (c === 'up' ? '▲ ' : c === 'down' ? '▼ ' : '') + t('ge.c.' + c) }), el('td', { text: a.counts[c].toLocaleString('en-US') })]));
    });
    sb.appendChild(el('tr', { class: 'sumrow' }, [el('th', { scope: 'row', text: t('ge.total') }), el('td', { text: a.total.toLocaleString('en-US') })]));
    box.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'cmp' }, [el('thead', null, [el('tr', null, [el('th', { scope: 'col', text: t('ge.h.class') }), el('th', { scope: 'col', text: t('ge.h.count') })])]), sb])]));
    box.appendChild(el('p', { class: 'meta', text: t('ge.stated', { stated: O.STUDY.statedSignificantGenes.toLocaleString('en-US'), n: (a.counts.up + a.counts.down).toLocaleString('en-US') }) }));

    var pts = [], clip = 0, XL = 14, YL = 100;
    D.rows.forEach(function (r) {
      if (r[3] === null || r[4] === null) return;
      var y = r[4] > 0 ? -Math.log10(r[4]) : YL; if (y > YL) clip++;
      pts.push({ x: r[3], y: y, c: Ex.classify(r[3], r[4]) });
    });
    box.appendChild(el('h4', { text: t('ge.volTitle') }));
    box.appendChild(Charts.volcano({ points: pts, xLimit: XL, yLimit: YL, xCut: D0.log2fc, yCut: -Math.log10(D0.padj), xLabel: t('ge.volX'), yLabel: t('ge.volY'), aria: t('ge.volAria', { n: pts.length.toLocaleString('en-US') }) }));
    box.appendChild(Charts.classLegend(['up', 'down', 'below', 'ns'].map(function (c) { return { cls: c, text: t('ge.c.' + c) }; })));
    box.appendChild(el('p', { class: 'meta', text: t('ge.volNote', { y: YL, n: clip }) }));

    box.appendChild(el('h4', { text: t('ge.featured') }));
    box.appendChild(geneTable(ctx, O.bySymbol(D, O.FEATURED), false));

    var lab = el('label', { class: 'genesearch' }, [el('span', { text: t('ge.search') }), el('input', { type: 'search', maxlength: '40', autocomplete: 'off', placeholder: t('ge.searchPh') })]);
    var res = el('div', { 'aria-live': 'polite' });
    box.appendChild(lab); box.appendChild(res);
    lab.querySelector('input').addEventListener('input', function (ev) {
      var q = ev.target.value; res.innerHTML = '';
      if (!q.trim()) return;
      var hits = O.find(D, q, 10);
      res.appendChild(hits.length ? geneTable(ctx, hits, true) : el('p', { class: 'empty', text: t('ge.none') }));
    });

    ['up', 'down'].forEach(function (c) {
      box.appendChild(el('h4', { text: t(c === 'up' ? 'ge.topUp' : 'ge.topDown') }));
      box.appendChild(geneTable(ctx, O.top(D, c, 10), true));
    });
    box.appendChild(el('p', { class: 'meta', text: t('ge.topNote') }));
    box.appendChild(el('p', { class: 'msg', text: t('ge.note') }));
  }

  /* ---------- Real data: OSD-635 study information ---------- */
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

    var gbox = el('div', { class: 'genes' });
    box.appendChild(gbox);
    gbox.appendChild(el('p', { class: 'hint', text: t('ge.loading') }));
    loadGenes(function () { renderGenes(ctx, gbox); }, function () { gbox.innerHTML = ''; gbox.appendChild(el('p', { class: 'callout', role: 'alert', text: t('ge.error') })); });
    box.appendChild(el('p', { class: 'meta' }, [t('o6.source', { files: S.sourceFiles.join(', ') }) + ' ', el('a', { href: O.DOI_URL, target: '_blank', rel: 'noopener noreferrer', text: t('o6.paper') })]));
  }


  /* ---------- OSD-569: blood count + direct RNA-seq gene results (real data) ---------- */
  function renderOsd569(ctx, box) {
    var t = ctx.t, O = ctx.Osd569, Ex = ctx.Expression, S = O.STUDY;
    box.innerHTML = '';
    box.appendChild(el('h3', { text: t('o9.title') }));
    box.appendChild(el('div', { class: 'badge real', text: t('o9.badge') }));
    box.appendChild(el('p', { class: 'msg', text: S.title }));
    box.appendChild(el('p', { class: 'hint', text: t('o9.what') }));
    var rows = [
      [t('o9.f.mission'), t('o9.v.mission', { m: S.mission, s: S.missionStart, e: S.missionEnd })],
      [t('o9.f.crew'), t('o9.v.crew')],
      [t('o9.f.tests'), t('o9.v.tests', { a: S.cbcAnalyzer })],
      [t('o9.f.rna'), t('o9.v.rna', { n: O.NANOPORE.samples, d: S.longRead })]
    ];
    var tb = el('tbody');
    rows.forEach(function (r) { tb.appendChild(el('tr', null, [el('th', { scope: 'row', text: r[0] }), el('td', { text: r[1] })])); });
    box.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'cmp' }, [tb])]));

    // complete blood count, pre-flight vs post-flight, per crew member (shared crew picker)
    box.appendChild(el('h4', { text: t('o9.cbc.title') }));
    box.appendChild(el('p', { class: 'msg', text: t('o9.cbc.intro') }));
    // chart: one CBC analyte over time, one line per crew member, laboratory range(s) as shaded band(s)
    box.appendChild(picker(ctx, O.ANALYTES.map(function (a) { return { id: a.id, label: t('o9.a.' + a.id) }; }), sel.cbc,
      function (id) { sel.cbc = id; renderOsd569(ctx, box); }, t('osdr.analyte')));
    var can = O.analyte(sel.cbc), crewList = O.crewIds(), rg = {}, bands = [];
    crewList.forEach(function (c) {
      var k = O.CREW[c][sel.cbc];
      k.values.forEach(function (v, i) { if (k.lo[i] !== null && k.hi[i] !== null && !rg[k.lo[i] + '–' + k.hi[i]]) { rg[k.lo[i] + '–' + k.hi[i]] = 1; bands.push({ lo: k.lo[i], hi: k.hi[i] }); } });
    });
    box.appendChild(el('p', { class: 'hint', text: t('o9.cbc.range', { r: Object.keys(rg).join('; '), unit: can.unit }) }));
    var clabel = t('o9.a.' + sel.cbc);
    box.appendChild(Charts.multiChart({
      series: crewList.map(function (c) {
        var k = O.CREW[c][sel.cbc], pts = [];
        k.values.forEach(function (v, i) { if (v !== null) pts.push({ x: i, y: v, title: O.TIMEPOINTS[i] + ' (' + c + '): ' + v.toFixed(can.decimals) + ' ' + can.unit }); });
        return { name: c, points: pts };
      }),
      xMin: 0, xMax: O.TIMEPOINTS.length - 1, bands: bands, unit: can.unit, decimals: can.decimals,
      xTicks: O.TIMEPOINTS.map(function (tp, i) { return { x: i, text: tp }; }),
      marks: [{ x: O.PRE - 0.5, text: t('osdr.flight') }],
      aria: t('o9.cbc.chartAria', { label: clabel })
    }));
    box.appendChild(Charts.legend(crewList));
    box.appendChild(picker(ctx, O.crewIds().map(function (c) { return { id: c, label: c }; }), sel.crew,
      function (id) { sel.crew = id; renderOsd569(ctx, box); }, t('pp.crew')));
    var data = O.prePost(sel.crew), posts = O.TIMEPOINTS.slice(O.PRE);
    var head = el('tr', null, [el('th', { scope: 'col', text: t('osdr.analyte') }), el('th', { scope: 'col', text: t('pp.pre') })]);
    posts.forEach(function (tp) { head.appendChild(el('th', { scope: 'col', text: t('pp.post') + ' ' + tp })); });
    var body = el('tbody');
    O.ANALYTES.forEach(function (an) {
      var d = data[an.id], dd = an.decimals + 1;
      var first = d.preMean === null ? '—' : d.preMean.toFixed(dd);
      var tr = el('tr', null, [el('th', { scope: 'row', text: t('o9.a.' + an.id) }),
        el('td', null, [first, d.preN ? el('div', { class: 'meta', text: t('pp.range') + ': ' + d.preMin.toFixed(an.decimals) + '–' + d.preMax.toFixed(an.decimals) + ' (n=' + d.preN + ')' }) : null])]);
      d.post.forEach(function (p) {
        if (p.value === null) { tr.appendChild(el('td', { text: '—' })); return; }
        var kids = [p.value.toFixed(an.decimals)];
        if (p.flag) kids.push(el('span', { class: 'flag ' + p.flag, title: t('osdr.' + p.flag), text: p.flag === 'low' ? ' ▼' : ' ▲' }));
        if (p.delta !== null) kids.push(el('div', { class: 'meta', text: (p.delta >= 0 ? '+' : '') + p.delta.toFixed(dd) }));
        if (p.vsPre) kids.push(el('div', { class: 'meta', text: (p.vsPre === 'below' ? '↓ ' : '↑ ') + t('pp.' + p.vsPre) }));
        tr.appendChild(el('td', null, kids));
      });
      body.appendChild(tr);
    });
    box.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'cmp' }, [el('thead', null, [head]), body])]));
    box.appendChild(el('p', { class: 'meta', text: '▼ ' + t('osdr.low') + ' · ▲ ' + t('osdr.high') + ' · ' + t('osdr.delta') + ' (+/−)' }));
    box.appendChild(el('p', { class: 'msg', text: t('o9.cbc.note') }));
    O.EXCLUDED.forEach(function (x) {
      box.appendChild(el('p', { class: 'meta', text: t('o9.cbc.excl', { crew: x.crew, tp: x.tp, fields: x.fields.map(function (f) { return t('o9.a.' + f); }).join('; ') }) }));
    });

    // gene results: class counts per comparison (cut-offs from expression.js), then the genes that pass both
    box.appendChild(el('h4', { text: t('o9.g.title') }));
    box.appendChild(el('p', { class: 'msg', text: t('o9.g.intro', { n: O.COMPARISONS.length, nd: t('ge.c.nodata') }) }));
    var D = Ex.DEFAULTS;
    box.appendChild(el('p', { class: 'hint', text: t('ge.thresholds', { p: D.padj, l: D.log2fc, f: Ex.foldChange(D.log2fc).toFixed(2) }) }));
    var classes = ['up', 'down', 'below', 'ns', 'nodata'];
    box.appendChild(picker(ctx, O.TOOLS.map(function (k) { return { id: k, label: t('o9.g.tool.' + k) }; }), sel.tool,
      function (id) { sel.tool = id; renderOsd569(ctx, box); }, t('o9.g.toolPick')));
    box.appendChild(Charts.divergingBars({
      rows: O.COMPARISONS.map(function (cmp) { var k = O.classCounts(cmp.id, sel.tool); return { label: cmp.id, down: k.down, up: k.up }; }),
      downText: t('ge.c.down'), upText: t('ge.c.up'), aria: t('o9.g.chartAria', { tool: t('o9.g.tool.' + sel.tool) })
    }));
    box.appendChild(el('p', { class: 'meta', text: t('o9.g.chartNote') }));
    var gh = el('tr', null, [el('th', { scope: 'col', text: t('o9.g.col.cmp') }), el('th', { scope: 'col', text: t('o9.g.col.genes') }), el('th', { scope: 'col', text: '' })]);
    classes.forEach(function (c) { gh.appendChild(el('th', { scope: 'col', text: t('ge.c.' + c) })); });
    var gb = el('tbody');
    O.COMPARISONS.forEach(function (cmp) {
      O.TOOLS.forEach(function (tool, k) {
        var c = O.classCounts(cmp.id, tool), tr = el('tr', null);
        if (k === 0) {
          tr.appendChild(el('th', { scope: 'row', rowspan: String(O.TOOLS.length) }, [cmp.id, el('div', { class: 'meta', text: cmp.cmp })]));
          tr.appendChild(el('td', { rowspan: String(O.TOOLS.length), text: cmp.genes.toLocaleString('en-US') }));
        }
        tr.appendChild(el('td', { text: t('o9.g.tool.' + tool) }));
        classes.forEach(function (cl) { tr.appendChild(el('td', { text: c[cl].toLocaleString('en-US') })); });
        gb.appendChild(tr);
      });
    });
    box.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'cmp' }, [el('thead', null, [gh]), gb])]));
    box.appendChild(el('p', { class: 'msg', text: t('o9.g.note') }));

    var lg = O.listedGenes();
    box.appendChild(el('p', { class: 'hint', text: t('o9.g.listed', { c: O.LISTED.comparison, t: t('o9.g.tool.' + O.LISTED.tool) }) }));
    var lh = el('tr', null, ['o9.g.gene', 'ge.h.log2fc', 'o9.g.fc', 'ge.h.padj', 'ge.h.class'].map(function (k) { return el('th', { scope: 'col', text: t(k) }); }));
    var lb = el('tbody');
    lg.forEach(function (g) {
      lb.appendChild(el('tr', null, [el('th', { scope: 'row', text: g.ensembl }), el('td', { text: (g.log2fc >= 0 ? '+' : '') + g.log2fc.toFixed(2) }),
        el('td', { text: g.fc < 1 ? g.fc.toFixed(3) : g.fc.toFixed(2) }), el('td', { text: g.padj.toExponential(2) }), el('td', { text: t('ge.c.' + g.cls) })]));
    });
    box.appendChild(el('div', { class: 'tablewrap' }, [el('table', { class: 'cmp' }, [el('thead', null, [lh]), lb])]));
    box.appendChild(el('p', { class: 'meta', text: t('o9.g.listedNote') }));
    box.appendChild(el('p', { class: 'meta' }, [t('o9.source') + ' ', el('a', { href: O.DOI_URL, target: '_blank', rel: 'noopener noreferrer', text: t('o9.paper') })]));
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
    var o9 = el('div', { class: 'osd569' });
    box.appendChild(o9);
    renderOsd569(ctx, o9);
    box.appendChild(el('p', { class: 'msg', text: t('osdr.limits') }));
    box.appendChild(el('p', { class: 'meta', text: t('osdr.fileNote') }));
    box.appendChild(el('p', { class: 'meta' }, [t('osdr.source') + ' ', el('a', { href: O.SOURCE_URL, target: '_blank', rel: 'noopener noreferrer', text: t('osdr.link') })]));
  }

  root.Views = { renderCompare: renderCompare, renderOsdr: renderOsdr, renderPrePost: renderPrePost, renderFlight: renderFlight, renderOsd635: renderOsd635, renderOsd569: renderOsd569 };
})(typeof window !== 'undefined' ? window : globalThis);
