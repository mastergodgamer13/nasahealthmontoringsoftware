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
   *   marks: [{x, text}],           // vertical dashed lines with a label
   *   unit, decimals, aria, width, height
   * }
   */
  function multiChart(opt) {
    var W = opt.width || 640, H = opt.height || 260, L = 46, R = 14, T = 18, B = 32;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'chart', role: 'img', 'aria-label': opt.aria || '' });
    var ys = [];
    opt.series.forEach(function (s) { s.points.forEach(function (p) { ys.push(p.y); }); });
    if (opt.band) { ys.push(opt.band.lo, opt.band.hi); }
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
    if (opt.band) {
      svg.appendChild(svgEl('rect', { x: L, y: Y(opt.band.hi), width: W - L - R, height: Y(opt.band.lo) - Y(opt.band.hi), fill: '#6aa8ff', opacity: 0.13 }));
    }
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

  root.Charts = { multiChart: multiChart, legend: legend, color: color };
})(typeof window !== 'undefined' ? window : globalThis);
