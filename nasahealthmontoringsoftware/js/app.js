/* app.js — UI wiring. All health logic lives in core.js. */
(function () {
  'use strict';

  var ICON = { ok: '✓', watch: '!', attention: '▲', nodata: '–' };
  var t = I18n.t;

  var state = { tab: 'dash', mode: 'demo', region: null, demo: Demo.generate(2026, 30) };
  var store = null; // created in init(), after the language is known

  // localStorage that never throws (blocked storage -> data lives in memory for this page view)
  function safeStorage() {
    var mem = {};
    return {
      getItem: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; } },
      setItem: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }
    };
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function $(id) { return document.getElementById(id); }
  function indLabel(ind) { return t('ind.' + ind.id); }
  function unitOf(ind) { return ind.unit === 'pts' ? t('unit.pts') : ind.unit === 'h' ? t('unit.h') : ind.unit; }
  function fmt(x, ind) { return typeof x === 'number' ? (ind && ind.step < 1 ? x.toFixed(1) : String(Math.round(x * 10) / 10)) : '—'; }

  function entries() { return state.mode === 'demo' ? state.demo : store.entriesOf(store.current()); }

  function chip(status) {
    return el('span', { class: 'chip ' + status }, [ICON[status] + ' ' + t('status.' + status)]);
  }

  /* ---------- charts (plain SVG, no dependencies) ---------- */
  function chart(ind, res) {
    var W = 560, H = 170, L = 38, R = 10, T = 12, B = 22;
    var pts = res.series;
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('class', 'chart');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('chart.aria', { label: indLabel(ind), n: pts.length }));
    if (pts.length < 2) return svg;

    var vals = pts.map(function (p) { return p.value; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var b = res.baseline;
    var bandLo = null, bandHi = null;
    if (b && b.sd > 0) {
      bandLo = b.mean - Core.DEFAULTS.watchZ * b.sd;
      bandHi = b.mean + Core.DEFAULTS.watchZ * b.sd;
      lo = Math.min(lo, bandLo); hi = Math.max(hi, bandHi);
    }
    if (hi === lo) { hi += 1; lo -= 1; }
    var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    function X(i) { return L + (W - L - R) * (i / (pts.length - 1)); }
    function Y(v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); }
    function add(tag, attrs, text) {
      var n = document.createElementNS(svgNS, tag);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      if (text) n.textContent = text;
      svg.appendChild(n); return n;
    }

    if (bandLo !== null) {
      add('rect', { x: L, y: Y(bandHi), width: W - L - R, height: Y(bandLo) - Y(bandHi), fill: '#6aa8ff', opacity: 0.14 });
      add('line', { x1: L, x2: W - R, y1: Y(b.mean), y2: Y(b.mean), stroke: '#6aa8ff', 'stroke-dasharray': '4 4', opacity: 0.7 });
    }
    var bn = Core.DEFAULTS.baselineN;
    if (pts.length > bn) {
      var xd = (X(bn - 1) + X(bn)) / 2;
      add('line', { x1: xd, x2: xd, y1: T, y2: H - B, stroke: '#9aa6c2', 'stroke-dasharray': '2 3' });
      add('text', { x: xd + 4, y: T + 9 }, t('chart.after'));
    }
    add('text', { x: 4, y: Y(hi) + 10 }, fmt(hi - pad, ind));
    add('text', { x: 4, y: Y(lo) - 2 }, fmt(lo + pad, ind));
    add('text', { x: L, y: H - 6 }, t('chart.reading', { n: 1 }));
    add('text', { x: W - R, y: H - 6, 'text-anchor': 'end' }, t('chart.reading', { n: pts.length }));

    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.value).toFixed(1); }).join(' ');
    add('path', { d: d, fill: 'none', stroke: '#e8edf7', 'stroke-width': 1.8 });
    pts.forEach(function (p, i) {
      var c = add('circle', { cx: X(i), cy: Y(p.value), r: 2.6, fill: i < bn ? '#6aa8ff' : '#e8edf7' });
      var t = document.createElementNS(svgNS, 'title');
      t.textContent = p.date + ': ' + fmt(p.value, ind) + ' ' + unitOf(ind);
      c.appendChild(t);
    });
    return svg;
  }

  /* ---------- rendering ---------- */
  var assessment = null;

  function regionStatus(regionId) {
    var def = Content.REGIONS[regionId];
    if (!def.indicators.length) return 'nodata';
    return Core.worstStatus(def.indicators.map(function (id) { return assessment.per[id].status; }));
  }

  function renderOverall() {
    var c = assessment.counts, box = $('overall');
    box.innerHTML = '';
    var line = el('div', null, [chip(assessment.overall), ' ', t('overall.label')]);
    var detail = el('div', { class: 'meta' }, [
      t('overall.counts', { ok: c.ok, watch: c.watch, attention: c.attention, nodata: c.nodata, total: assessment.total }) + ' ' + t('overall.note')
    ]);
    box.appendChild(line); box.appendChild(detail);
  }

  function renderBody() {
    Array.prototype.forEach.call(document.querySelectorAll('#body .region'), function (g) {
      var id = g.getAttribute('data-region');
      g.setAttribute('data-status', regionStatus(id));
      g.classList.toggle('selected', state.region === id);
    });
    var list = $('region-list'); list.innerHTML = '';
    Object.keys(Content.REGIONS).forEach(function (id) {
      var b = el('button', { type: 'button', 'data-region': id, 'aria-pressed': String(state.region === id) }, [
        el('span', { text: t('region.' + id + '.title') }), chip(regionStatus(id))
      ]);
      if (state.region === id) b.className = 'selected';
      b.addEventListener('click', function () { selectRegion(id); });
      list.appendChild(el('li', null, [b]));
    });
  }

  function renderDetail() {
    var box = $('detail'); box.innerHTML = '';
    if (!state.region) { box.appendChild(el('p', { class: 'hint', text: t('detailsHint') })); return; }
    var def = Content.REGIONS[state.region];
    box.appendChild(el('h3', { text: t('region.' + state.region + '.title') }));
    box.appendChild(el('p', { class: 'msg', text: t('region.' + state.region + '.blurb') }));
    box.appendChild(el('div', { class: 'tags' }, def.hazards.map(function (h) { return el('span', { text: t('hazard.' + h) }); })));
    box.appendChild(el('div', { class: 'meta' }, [t('hazardNote') + ' ', el('span', { class: 'draft', text: t('draft') })]));

    def.indicators.forEach(function (id) {
      var ind = Core.getIndicator(id), res = assessment.per[id];
      var wrap = el('div', { class: 'ind' });
      var latest = res.series.length ? res.series[res.series.length - 1].value : null;
      wrap.appendChild(el('div', { class: 'ind-head' }, [
        el('div', null, [el('strong', { text: indLabel(ind) }), ' ', chip(res.status)]),
        el('div', { class: 'val' }, [latest === null ? '—' : fmt(latest, ind), ' ', el('small', { text: unitOf(ind) })])
      ]));
      wrap.appendChild(el('p', { class: 'msg', text: t('msg.' + res.status) }));
      var meta;
      if (res.status === 'nodata') meta = res.reasonCode ? t('reason.' + res.reasonCode, res.reasonParams) : res.reason;
      else {
        meta = t('meta', { mean: fmt(res.baseline.mean, ind), sd: fmt(res.baseline.sd, ind), unit: unitOf(ind), n: res.baseline.n,
          rn: res.recentN, rmean: fmt(res.recentMean, ind), z: res.z.toFixed(1) });
      }
      wrap.appendChild(el('div', { class: 'meta', text: meta }));
      wrap.appendChild(chart(ind, res));
      wrap.appendChild(el('p', { class: 'msg' }, [el('strong', { text: t('why') + ' ' }), t('info.' + id + '.why')]));
      wrap.appendChild(el('p', { class: 'msg' }, [el('strong', { text: t('how') + ' ' }), t('info.' + id + '.how'),
        el('span', { class: 'draft', text: t('draft') })]));
      box.appendChild(wrap);
    });
  }

  function renderBadge() {
    var b = $('source-badge');
    if (state.mode === 'demo') { b.className = 'badge sim'; b.textContent = t('badgeSim'); }
    else {
      var u = store.currentUser();
      b.className = 'badge man';
      b.textContent = u ? t('badgeMan', { user: u.name, n: u.entries.length }) : t('users.none');
    }
    $('btn-demo').classList.toggle('active', state.mode === 'demo');
    $('btn-demo').setAttribute('aria-pressed', String(state.mode === 'demo'));
    $('btn-manual').classList.toggle('active', state.mode === 'manual');
    $('btn-manual').setAttribute('aria-pressed', String(state.mode === 'manual'));
  }

  function applyStatic() {
    document.title = t('docTitle');
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-ph]'), function (n) { n.setAttribute('placeholder', t(n.getAttribute('data-i18n-ph'))); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-aria]'), function (n) { n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria'))); });
    Array.prototype.forEach.call(document.querySelectorAll('#body .region'), function (g) {
      g.setAttribute('aria-label', t('region.' + g.getAttribute('data-region') + '.title'));
    });
    var sel = $('lang'); if (sel) sel.value = I18n.get();
  }

  var viewCtx = null;
  function ctx() {
    if (!viewCtx) viewCtx = { t: t, Core: Core, Osdr: Osdr, store: store, chip: chip, indLabel: indLabel, unitOf: unitOf, fmt: fmt };
    return viewCtx;
  }

  function renderTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (b) {
      var on = b.getAttribute('data-tab') === state.tab;
      b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on));
    });
    ['dash', 'compare', 'osdr'].forEach(function (id) { $('view-' + id).hidden = state.tab !== id; });
  }

  function render() {
    assessment = Core.assess(entries());
    applyStatic(); updateFormLabels();
    renderTabs(); renderUsers();
    renderBadge(); renderOverall(); renderBody(); renderDetail();
    if (state.tab === 'compare') Views.renderCompare(ctx(), $('cmp'));
    if (state.tab === 'osdr') Views.renderOsdr(ctx(), $('osdr'));
  }

  /* ---------- users ---------- */
  function renderUsers() {
    var sel = $('user-select'), users = store.users();
    sel.innerHTML = '';
    users.forEach(function (u) {
      var o = el('option', { value: u.id, text: u.name });
      if (u.id === store.current()) o.selected = true;
      sel.appendChild(o);
    });
    var none = !users.length;
    sel.disabled = none; $('user-remove').disabled = none;
    $('user-none').hidden = !none;
    Array.prototype.forEach.call($('checkin').querySelectorAll('input,button'), function (x) { x.disabled = none; });
    $('clear-manual').disabled = none;
  }

  function userMsg(text, cls) { var m = $('user-msg'); m.className = 'form-msg ' + (cls || ''); m.textContent = text; }

  function selectRegion(id) { state.region = id; renderBody(); renderDetail(); }

  /* ---------- check-in form ---------- */
  function errText(v) {
    if (!v.codes) return v.errors.join(' ');
    return v.codes.map(function (c) {
      var ind = c.id ? Core.getIndicator(c.id) : null;
      return t('err.' + c.code, { label: ind ? indLabel(ind) : '', n: c.n, min: c.min, max: c.max, unit: ind ? unitOf(ind) : '' });
    }).join(' ');
  }
  // relabel the form in place so typed values are not lost when the language changes
  function updateFormLabels() {
    Array.prototype.forEach.call(document.querySelectorAll('#checkin [data-ind]'), function (s) {
      var ind = Core.getIndicator(s.getAttribute('data-ind'));
      s.textContent = indLabel(ind) + ' (' + unitOf(ind) + ')';
    });
  }

  function buildForm() {
    var f = $('checkin'); f.innerHTML = '';
    var today = new Date().toISOString().slice(0, 10);
    f.appendChild(el('label', { class: 'full' }, [el('span', { 'data-i18n': 'fDate', text: t('fDate') }), el('input', { type: 'date', name: 'date', value: today, required: 'required' })]));
    Core.INDICATORS.forEach(function (ind) {
      f.appendChild(el('label', null, [el('span', { 'data-ind': ind.id, text: indLabel(ind) + ' (' + unitOf(ind) + ')' }),
        el('input', { type: 'number', name: ind.id, step: String(ind.step), min: String(ind.min), max: String(ind.max), inputmode: 'decimal' })]));
    });
    f.appendChild(el('button', { type: 'submit', 'data-i18n': 'save', text: t('save') }));
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var raw = {};
      Array.prototype.forEach.call(f.elements, function (inp) { if (inp.name) raw[inp.name] = inp.value; });
      var v = Core.validateEntry(raw), msg = $('form-msg');
      if (!store.current()) { msg.className = 'form-msg err'; msg.textContent = t('users.needUser'); return; }
      if (!v.ok) { msg.className = 'form-msg err'; msg.textContent = errText(v); return; }
      store.saveEntry(store.current(), v.entry); // one entry per date: replaced if it exists
      msg.className = 'form-msg good'; msg.textContent = t('savedFor', { date: v.entry.date });
      state.mode = 'manual'; render();
    });
  }

  function init() {
    I18n.init();
    store = Store.create(safeStorage(), { legacyName: t('users.legacyName') });
    var sel = $('lang');
    I18n.LANGS.forEach(function (l) { sel.appendChild(el('option', { value: l.code, text: l.name })); });
    sel.addEventListener('change', function () { I18n.set(sel.value); $('form-msg').textContent = ''; render(); });
    buildForm();
    $('btn-demo').addEventListener('click', function () { state.mode = 'demo'; render(); });
    $('btn-manual').addEventListener('click', function () { state.mode = 'manual'; render(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); render(); });
    });
    $('user-select').addEventListener('change', function () { store.select($('user-select').value); userMsg(''); state.mode = 'manual'; render(); });
    $('user-add').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var r = store.add($('user-name').value);
      if (!r.ok) { userMsg(t('users.err.' + r.code, { max: r.max }), 'err'); return; }
      $('user-name').value = '';
      userMsg(t('users.added', { user: r.user.name }), 'good');
      state.mode = 'manual'; render();
    });
    $('user-remove').addEventListener('click', function () {
      var u = store.currentUser(); if (!u) return;
      if (window.confirm(t('users.confirmRemove', { user: u.name }))) { store.remove(u.id); userMsg(''); render(); }
    });
    $('clear-manual').addEventListener('click', function () {
      var u = store.currentUser();
      if (!u || !u.entries.length) return;
      if (window.confirm(t('confirmClear', { user: u.name }))) { store.clearEntries(u.id); render(); }
    });
    Array.prototype.forEach.call(document.querySelectorAll('#body .region'), function (g) {
      var id = g.getAttribute('data-region');
      g.addEventListener('click', function () { selectRegion(id); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRegion(id); } });
    });
    state.region = 'mind';
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
