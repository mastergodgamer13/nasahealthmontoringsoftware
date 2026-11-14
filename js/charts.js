/*
 * charts.js — multi-series SVG line chart (no dependencies, browser only).
 * Series are told apart by color AND by legend/title text; series 9+ also use dashed lines.
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var PALETTE = ['#5ab4ff', '#ffb347', '#3ddc97', '#f4e04d', '#e58bd1', '#ff7f6e', '#a99cff', '#d9e2f2', '#2ec4b6', '#c3a86b', '#7bd88f', '#ff9fc2'];

  function color(i) { return PALETTE[i % PALETTE.length]; }

  function svgEl(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function fmtNum(x, dec) { return Number(x).toFixed(dec === undefined ? 1 : dec); }

  /**
   * opt: {
   *   series: [{ name, points: [{x, y, title}] }],
   *   xMin, xMax, xTicks: [{x, text}],
   *   band: {lo, hi} | null,        // shaded reference band
   *   bands: [{lo, hi}],            // several reference bands (e.g. different lab ranges)
   *   marks: [{x, text}],           // vertical dashed lines with a label
   *   unit, decimals, aria, width, height
   * }
   */
  function multiChart(opt) {
    var W = opt.width || 640, H = opt.height || 260, L = 46, R = 14, T = 18, B = 32;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'chart', role: 'img', 'aria-label': opt.aria || '' });
    var ys = [];
    opt.series.forEach(function (s) { s.points.forEach(function (p) { ys.push(p.y); }); });
    var bands = opt.bands || (opt.band ? [opt.band] : []);
    bands.forEach(function (b) { ys.push(b.lo, b.hi); });
    if (!ys.length) return svg;
    var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
    if (hi === lo) { hi += 1; lo -= 1; }
    var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    var xMin = opt.xMin, xMax = opt.xMax;
    if (xMax === xMin) { xMax += 1; xMin -= 1; }
    function X(v) { return L + (W - L - R) * ((v - xMin) / (xMax - xMin)); }
    function Y(v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); }

    // horizontal grid + y labels
    for (var g = 0; g <= 4; g++) {
      var gv = lo + (hi - lo) * (g / 4), gy = Y(gv);
      svg.appendChild(svgEl('line', { x1: L, x2: W - R, y1: gy, y2: gy, stroke: '#2b3860', 'stroke-width': 1, opacity: 0.6 }));
      svg.appendChild(svgEl('text', { x: L - 6, y: gy + 3, 'text-anchor': 'end' }, fmtNum(gv, opt.decimals)));
    }
    bands.forEach(function (b) {
      svg.appendChild(svgEl('rect', { x: L, y: Y(b.hi), width: W - L - R, height: Y(b.lo) - Y(b.hi), fill: '#6aa8ff', opacity: bands.length > 1 ? 0.09 : 0.13 }));
    });
    (opt.marks || []).forEach(function (m) {
      svg.appendChild(svgEl('line', { x1: X(m.x), x2: X(m.x), y1: T, y2: H - B, stroke: '#9aa6c2', 'stroke-dasharray': '3 3' }));
      svg.appendChild(svgEl('text', { x: X(m.x) + 4, y: T + 9 }, m.text));
    });
    (opt.xTicks || []).forEach(function (tk) {
      svg.appendChild(svgEl('text', { x: X(tk.x), y: H - 12, 'text-anchor': 'middle' }, tk.text));
    });
    opt.series.forEach(function (s, i) {
      if (!s.points.length) return;
      var c = color(i), dash = i >= PALETTE.length - 4 ? '5 3' : '';
      var d = s.points.map(function (p, k) { return (k ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ');
      var pa = { d: d, fill: 'none', stroke: c, 'stroke-width': 2 };
      if (dash) pa['stroke-dasharray'] = dash;
      svg.appendChild(svgEl('path', pa));
      s.points.forEach(function (p) {
        var dot = svgEl('circle', { cx: X(p.x), cy: Y(p.y), r: 3.4, fill: c, stroke: '#101830', 'stroke-width': 1 });
        dot.appendChild(svgEl('title', {}, s.name + ': ' + (p.title || fmtNum(p.y, opt.decimals) + (opt.unit ? ' ' + opt.unit : ''))));
        svg.appendChild(dot);
      });
    });
    return svg;
  }

  function legend(names) {
    var box = document.createElement('div');
    box.className = 'legend';
    names.forEach(function (n, i) {
      var item = document.createElement('span');
      var sw = document.createElement('i');
      sw.style.background = color(i);
      item.appendChild(sw);
      item.appendChild(document.createTextNode(n));
      box.appendChild(item);
    });
    return box;
  }


  var CLS_COLOR = { up: '#ff7f6e', down: '#5ab4ff', below: '#f4e04d', ns: '#5b6a8c' };

  /**
   * Volcano plot on a canvas (22k points are too many for SVG).
   * opt: { points: [{x, y, c}] (c = 'up'|'down'|'below'|'ns'), xLimit, yLimit (clip), xCut, yCut, xLabel, yLabel, aria }
   * Points beyond the limits are drawn on the edge. Returns the canvas (and draws nothing if canvas is unsupported).
   */
  function volcano(opt) {
    var W = 640, H = 340, L = 50, R = 14, T = 14, B = 40;
    var cv = document.createElement('canvas');
    cv.className = 'chart volcano'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', opt.aria || '');
    var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return cv;
    ctx.scale(dpr, dpr);
    var xl = opt.xLimit, yl = opt.yLimit;
    function X(v) { return L + (W - L - R) * ((Math.max(-xl, Math.min(xl, v)) + xl) / (2 * xl)); }
    function Y(v) { return T + (H - T - B) * (1 - Math.max(0, Math.min(yl, v)) / yl); }
    ctx.fillStyle = '#0a0f18'; ctx.fillRect(0, 0, W, H);
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#9aa6c2'; ctx.strokeStyle = '#2b3860'; ctx.lineWidth = 1;
    var i, v;
    for (i = 0; i <= 4; i++) { v = yl * i / 4; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(W - R, Y(v)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(String(Math.round(v)), L - 6, Y(v) + 3); }
    for (i = -4; i <= 4; i++) { v = xl * i / 4; ctx.textAlign = 'center'; ctx.fillText(v.toFixed(0), X(v), H - B + 14); }
    ctx.textAlign = 'center'; ctx.fillText(opt.xLabel || '', L + (W - L - R) / 2, H - 6);
    ctx.save(); ctx.translate(12, T + (H - T - B) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(opt.yLabel || '', 0, 0); ctx.restore();
    ['ns', 'below', 'down', 'up'].forEach(function (cls) { // significant classes drawn last, on top
      ctx.fillStyle = CLS_COLOR[cls]; ctx.globalAlpha = cls === 'ns' ? 0.45 : 0.9;
      opt.points.forEach(function (p) { if (p.c === cls) ctx.fillRect(X(p.x) - 1, Y(p.y) - 1, 2, 2); });
    });
    ctx.globalAlpha = 1; ctx.strokeStyle = '#9aa6c2'; ctx.setLineDash([4, 3]);
    [-opt.xCut, opt.xCut].forEach(function (x) { ctx.beginPath(); ctx.moveTo(X(x), T); ctx.lineTo(X(x), H - B); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(L, Y(opt.yCut)); ctx.lineTo(W - R, Y(opt.yCut)); ctx.stroke(); ctx.setLineDash([]);
    return cv;
  }

  /**
   * Diverging bar chart (SVG): for each row, a bar to the left (down) and to the right (up). Labels with the numbers.
   * opt: { rows: [{label, down, up}], downText, upText, aria }
   */
  function divergingBars(opt) {
    var rowH = 20, W = 640, L = 150, R = 20, T = 22, H = T + opt.rows.length * rowH + 10;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'chart', role: 'img', 'aria-label': opt.aria || '' });
    var m = 1; opt.rows.forEach(function (r) { m = Math.max(m, r.down, r.up); });
    var mid = L + (W - L - R) / 2, half = (W - L - R) / 2 - 24;
    svg.appendChild(svgEl('line', { x1: mid, x2: mid, y1: T - 6, y2: H - 6, stroke: '#9aa6c2' }));
    svg.appendChild(svgEl('text', { x: mid - 6, y: 12, 'text-anchor': 'end' }, '◀ ' + opt.downText));
    svg.appendChild(svgEl('text', { x: mid + 6, y: 12 }, opt.upText + ' ▶'));
    opt.rows.forEach(function (r, i) {
      var y = T + i * rowH, dw = half * r.down / m, uw = half * r.up / m;
      svg.appendChild(svgEl('text', { x: L - 8, y: y + 12, 'text-anchor': 'end' }, r.label));
      if (r.down) svg.appendChild(svgEl('rect', { x: mid - dw, y: y + 2, width: dw, height: rowH - 6, fill: CLS_COLOR.down }));
      if (r.up) svg.appendChild(svgEl('rect', { x: mid, y: y + 2, width: uw, height: rowH - 6, fill: CLS_COLOR.up }));
      svg.appendChild(svgEl('text', { x: mid - dw - 4, y: y + 12, 'text-anchor': 'end' }, String(r.down)));
      svg.appendChild(svgEl('text', { x: mid + uw + 4, y: y + 12 }, String(r.up)));
    });
    return svg;
  }

  function classLegend(items) { // items: [{cls, text}]
    var box = document.createElement('div'); box.className = 'legend';
    items.forEach(function (it) { var s = document.createElement('span'), sw = document.createElement('i'); sw.style.background = CLS_COLOR[it.cls]; s.appendChild(sw); s.appendChild(document.createTextNode(it.text)); box.appendChild(s); });
    return box;
  }

  root.Charts = { multiChart: multiChart, legend: legend, color: color, volcano: volcano, divergingBars: divergingBars, classLegend: classLegend, CLS_COLOR: CLS_COLOR };
})(typeof window !== 'undefined' ? window : globalThis);
