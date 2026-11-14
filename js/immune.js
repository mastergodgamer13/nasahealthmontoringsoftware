/*
 * immune.js — the user's own blood-count values for the immune system region (no DOM).
 * Three analytes, as in the OSD-569 complete blood count: white blood cells, absolute neutrophils, absolute lymphocytes.
 * Time points follow the OSD-569 / OSD-575 files (Osdr.TIMEPOINTS: L-92, L-44, L-3 pre-flight; R+1 ... R+194 post-flight).
 * Laboratory ranges are the ones printed in the OSD-569 file; for these three analytes they are the same for every row
 * (no sex-specific range), so no sex field is needed. They are not clinical thresholds set by this app.
 * Descriptive only: no status labels, no statistics. Not a diagnosis.
 */
(function (root) {
  'use strict';
  var Core = (typeof module !== 'undefined' && module.exports && typeof require === 'function') ? require('./core.js') : root.Core;
  var Osdr = (typeof module !== 'undefined' && module.exports && typeof require === 'function') ? require('./osdr.js') : root.Osdr;
  var TIMEPOINTS = Osdr.TIMEPOINTS, PRE = Osdr.PRE;

  var ANALYTES = {
    wbc:   { unit: '10³/µL',   lo: 3.8, hi: 10.8, decimals: 1 },
    neut:  { unit: 'cells/µL', lo: 1500, hi: 7800, decimals: 0 },
    lymph: { unit: 'cells/µL', lo: 850, hi: 3900, decimals: 0 }
  };
  // typing-error limits only (impossible values); not clinical thresholds and not the lab range
  var LIMITS = { wbc: { min: 0.1, max: 100 }, neut: { min: 10, max: 60000 }, lymph: { min: 10, max: 60000 } };

  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function roundTo(x, d) { var f = Math.pow(10, d); return Math.round(x * f) / f; }
  function groupOf(tp) { return Osdr.groupOf(tp); }
  function flag(a, v) { var r = ANALYTES[a]; return v < r.lo ? 'low' : v > r.hi ? 'high' : null; }

  /** raw: { tp, wbc, neut, lymph } (strings or numbers; each optional, at least one). Same rules as Osdr.validateFlight. */
  function validate(raw) {
    raw = raw || {};
    if (TIMEPOINTS.indexOf(raw.tp) < 0) return { ok: false, codes: [{ code: 'tp' }] };
    var codes = [], rec = { tp: raw.tp }, any = false;
    Object.keys(ANALYTES).forEach(function (a) {
      var s = raw[a];
      if (s === undefined || s === null || String(s).trim() === '') return;
      var x = Number(String(s).trim().replace(',', '.'));
      if (!isFinite(x)) { codes.push({ code: 'notnum', id: a }); return; }
      var L = LIMITS[a];
      if (x < L.min || x > L.max) { codes.push({ code: 'range', id: a, min: L.min, max: L.max }); return; }
      rec[a] = roundTo(x, ANALYTES[a].decimals); any = true;
    });
    if (!codes.length && !any) codes.push({ code: 'empty' });
    return codes.length ? { ok: false, codes: codes } : { ok: true, entry: rec };
  }

  /**
   * Summary of typed-in records (one per time point): pre-flight mean/range from the pre-flight points that have a value;
   * delta = value - pre-flight mean (needs >= 1 pre value, post-flight only); vsPre needs >= 2 pre values.
   */
  function summary(records) {
    var byTp = {};
    (records || []).forEach(function (r) { if (r && groupOf(r.tp)) byTp[r.tp] = r; });
    var tps = TIMEPOINTS.filter(function (tp) { return byTp[tp]; });
    var analytes = {};
    Object.keys(ANALYTES).forEach(function (a) {
      var pre = [];
      TIMEPOINTS.slice(0, PRE).forEach(function (tp) { if (byTp[tp] && isNum(byTp[tp][a])) pre.push(byTp[tp][a]); });
      var n = pre.length, mean = n ? pre.reduce(function (s, x) { return s + x; }, 0) / n : null;
      var lo = n ? Math.min.apply(null, pre) : null, hi = n ? Math.max.apply(null, pre) : null;
      analytes[a] = {
        preN: n, preMean: mean, preMin: lo, preMax: hi,
        points: tps.map(function (tp) {
          var v = isNum(byTp[tp][a]) ? byTp[tp][a] : null, post = groupOf(tp) === 'post';
          return { tp: tp, group: groupOf(tp), value: v, flag: v === null ? null : flag(a, v),
            delta: post && v !== null && mean !== null ? v - mean : null,
            vsPre: post && v !== null && n >= 2 ? (v < lo ? 'below' : v > hi ? 'above' : null) : null };
        })
      };
    });
    return { tps: tps, analytes: analytes };
  }


  var MIN_PRE = 3;
  // prototype reference zones (ok = green = the dataset lab range; watch = yellow; beyond = red). Not a diagnosis.
  var REFERENCE = {
    wbc:   { ok: [3.8, 10.8],   watch: [3.0, 15.0] },
    neut:  { ok: [1500, 7800],  watch: [1000, 12000] },
    lymph: { ok: [850, 3900],   watch: [600, 5000] }
  };

  /**
   * Status of each immune indicator, same statistical convention as the other indicators (core.js):
   * baseline = the user's own pre-flight values (at least MIN_PRE), recent = latest (up to Core.DEFAULTS.recentN) post-flight values,
   * z = (recent mean - baseline mean) / baseline SD; |z| >= watchZ -> watch, >= attentionZ -> attention. Not a clinical threshold.
   * 'nodata' (never treated as 'ok') when the baseline has fewer than MIN_PRE values, there is no post-flight value, or no variation.
   * Returns { per: { wbc: {status, ...}, ... } }.
   */
  function assess(records, cfg) {
    var c = { watchZ: Core.DEFAULTS.watchZ, attentionZ: Core.DEFAULTS.attentionZ, recentN: Core.DEFAULTS.recentN };
    if (cfg) Object.keys(cfg).forEach(function (k) { c[k] = cfg[k]; });
    var sum = summary(records), per = {};
    Object.keys(ANALYTES).forEach(function (a) {
      var pts = sum.analytes[a].points, pre = [], post = [];
      pts.forEach(function (p) { if (p.value === null) return; (p.group === 'pre' ? pre : post).push(p.value); });
      var base = { preN: pre.length, postN: post.length };
      var all = pre.concat(post), latest = all.length ? all[all.length - 1] : null;
      var rs = latest === null ? 'nodata' : Core.zoneOf(REFERENCE[a], latest);
      base.latest = latest; base.rangeStatus = rs;
      if (pre.length < MIN_PRE) { per[a] = Object.assign(base, { status: 'nodata', reasonCode: 'immunePre', reasonParams: { have: pre.length, need: MIN_PRE } }); return; }
      if (!post.length) { per[a] = Object.assign(base, { status: 'nodata', reasonCode: 'immunePost', reasonParams: {} }); return; }
      var mu = Core.mean(pre), sd = Core.sd(pre);
      if (!(sd > 0)) { per[a] = Object.assign(base, { status: 'nodata', reasonCode: 'flat', reasonParams: {} }); return; }
      var recent = post.slice(-c.recentN), rm = Core.mean(recent), z = (rm - mu) / sd, az = Math.abs(z);
      per[a] = Object.assign(base, {
        status: az >= c.attentionZ ? 'attention' : az >= c.watchZ ? 'watch' : 'ok',
        z: z, baseline: { mean: mu, sd: sd, n: pre.length }, recentMean: rm, recentN: recent.length
      });
    });
    Object.keys(per).forEach(function (a) {
      per[a].baselineStatus = per[a].status;
      per[a].status = Core.worstStatus([per[a].baselineStatus, per[a].rangeStatus]);
    });
    return { per: per };
  }
  var api = { REFERENCE: REFERENCE, MIN_PRE: MIN_PRE, assess: assess, TIMEPOINTS: TIMEPOINTS, PRE: PRE, ANALYTES: ANALYTES, LIMITS: LIMITS, flag: flag, validate: validate, summary: summary };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Immune = api;
})(typeof window !== 'undefined' ? window : globalThis);
