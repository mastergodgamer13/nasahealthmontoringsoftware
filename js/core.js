/*
 * core.js — pure logic (no DOM). Works in the browser (window.Core) and Node (require).
 *
 * IMPORTANT SCIENTIFIC NOTE
 * The status levels computed here are STATISTICAL DEVIATIONS from a person's OWN baseline.
 * They are NOT clinical thresholds and NOT diagnoses. The z-score cut-offs below are
 * configurable statistical conventions chosen for the prototype, not medical reference values.
 * The "input sanity limits" (min/max) only reject physically implausible typing errors.
 */
(function (root) {
  'use strict';

  var STATUS_ORDER = { nodata: 0, ok: 1, watch: 2, attention: 3 };

  var DEFAULTS = {
    baselineN: 7,     // first N valid readings define the personal baseline
    recentN: 3,       // latest N readings after the baseline are compared to it
    watchZ: 2,        // |z| >= 2  -> "watch"      (statistical convention, configurable)
    attentionZ: 3     // |z| >= 3  -> "attention"  (statistical convention, configurable)
  };

  // Input sanity limits only reject impossible entries (typos). They are not clinical ranges.
  var INDICATORS = [
    { id: 'hr',      label: 'Resting heart rate',   unit: 'bpm',   min: 20,  max: 250, step: 1,   region: 'heart' },
    { id: 'sys',     label: 'Systolic pressure',    unit: 'mmHg',  min: 40,  max: 300, step: 1,   region: 'heart' },
    { id: 'dia',     label: 'Diastolic pressure',   unit: 'mmHg',  min: 20,  max: 200, step: 1,   region: 'heart' },
    { id: 'glucose', label: 'Blood glucose',        unit: 'mg/dL', min: 10,  max: 800, step: 1,   region: 'metabolism' },
    { id: 'temp',    label: 'Body temperature',     unit: '°C',    min: 25,  max: 45,  step: 0.1, region: 'whole' },
    { id: 'sleep',   label: 'Sleep duration',       unit: 'h',     min: 0,   max: 24,  step: 0.1, region: 'mind' },
    { id: 'mood',    label: 'Mood (self-rating 1–5)', unit: 'pts', min: 1,   max: 5,   step: 1,   region: 'mind', integer: true }
  ];

  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  function mean(a) {
    if (!a.length) return NaN;
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
  }

  // Sample standard deviation (n-1). Needs n >= 2.
  function sd(a) {
    if (a.length < 2) return NaN;
    var m = mean(a), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (a.length - 1));
  }

  function getIndicator(id) {
    for (var i = 0; i < INDICATORS.length; i++) if (INDICATORS[i].id === id) return INDICATORS[i];
    return null;
  }

  /** Validate one raw check-in. Missing indicator values are allowed; invalid ones are errors. */
  function validateEntry(raw) {
    var errors = [];
    var codes = []; // language-independent error descriptors for the UI: {code, id, ...}
    function fail(text, descriptor) { errors.push(text); codes.push(descriptor); }
    var entry = { date: null };
    if (!raw || typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
      fail('A valid date (YYYY-MM-DD) is required.', { code: 'date' });
    } else {
      entry.date = raw.date;
    }
    var count = 0;
    INDICATORS.forEach(function (ind) {
      var v = raw ? raw[ind.id] : undefined;
      if (v === undefined || v === null || v === '') return; // missing is allowed
      var n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
      if (!isNum(n)) { fail(ind.label + ': not a number.', { code: 'notnum', id: ind.id }); return; }
      if (n < ind.min || n > ind.max) {
        fail(ind.label + ': ' + n + ' is outside the input sanity limits (' + ind.min + '–' + ind.max + ' ' + ind.unit + ').',
          { code: 'range', id: ind.id, n: n, min: ind.min, max: ind.max });
        return;
      }
      if (ind.integer && Math.floor(n) !== n) { fail(ind.label + ': must be a whole number.', { code: 'integer', id: ind.id }); return; }
      entry[ind.id] = n;
      count++;
    });
    if (count === 0) fail('Enter at least one measurement.', { code: 'empty' });
    if (isNum(entry.sys) && isNum(entry.dia) && entry.dia >= entry.sys) {
      fail('Diastolic pressure must be lower than systolic pressure.', { code: 'bp' });
    }
    return { ok: errors.length === 0, errors: errors, codes: codes, entry: errors.length === 0 ? entry : null };
  }

  /** Time-ordered list of valid values for one indicator: [{date, value}] */
  function seriesFor(entries, id) {
    return entries
      .filter(function (e) { return isNum(e[id]); })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; })
      .map(function (e) { return { date: e.date, value: e[id] }; });
  }

  /**
   * Compare the most recent readings with the personal baseline.
   * Returns status in {nodata, ok, watch, attention}. 'nodata' is never treated as 'ok'.
   */
  function computeStatus(values, cfg) {
    var c = {};
    Object.keys(DEFAULTS).forEach(function (k) { c[k] = DEFAULTS[k]; });
    if (cfg) Object.keys(cfg).forEach(function (k) { c[k] = cfg[k]; });

    var v = values.filter(isNum);
    if (v.length < c.baselineN) {
      return { status: 'nodata', reason: 'Collecting baseline: ' + v.length + '/' + c.baselineN + ' readings.',
        reasonCode: 'collecting', reasonParams: { have: v.length, need: c.baselineN }, n: v.length };
    }
    var base = v.slice(0, c.baselineN);
    var mu = mean(base), s = sd(base);
    var after = v.slice(c.baselineN);
    if (after.length === 0) {
      return { status: 'nodata', reason: 'Baseline complete; no readings after the baseline yet.', reasonCode: 'baselineDone',
        n: v.length, baseline: { mean: mu, sd: s, n: base.length } };
    }
    if (!(s > 0)) {
      return { status: 'nodata', reason: 'Baseline shows no variation; deviation cannot be estimated.', reasonCode: 'flat',
        n: v.length, baseline: { mean: mu, sd: s, n: base.length } };
    }
    var recent = after.slice(-c.recentN);
    var rm = mean(recent);
    var z = (rm - mu) / s;
    var az = Math.abs(z);
    var status = az >= c.attentionZ ? 'attention' : az >= c.watchZ ? 'watch' : 'ok';
    return {
      status: status, z: z, n: v.length,
      baseline: { mean: mu, sd: s, n: base.length },
      recentMean: rm, recentN: recent.length, latest: v[v.length - 1]
    };
  }

  /** Worst status among a list; 'nodata' only if every item is 'nodata'. */
  function worstStatus(statuses) {
    var worst = 'nodata';
    statuses.forEach(function (s) {
      if (s !== 'nodata' && STATUS_ORDER[s] > STATUS_ORDER[worst]) worst = s;
    });
    return worst;
  }

  /** Status of every indicator + overall summary (explicitly counts missing data). */
  function assess(entries, cfg) {
    var per = {};
    INDICATORS.forEach(function (ind) {
      var series = seriesFor(entries, ind.id);
      var res = computeStatus(series.map(function (p) { return p.value; }), cfg);
      res.series = series;
      per[ind.id] = res;
    });
    var all = INDICATORS.map(function (i) { return per[i.id].status; });
    var counts = { nodata: 0, ok: 0, watch: 0, attention: 0 };
    all.forEach(function (s) { counts[s]++; });
    return { per: per, overall: worstStatus(all), counts: counts, total: INDICATORS.length };
  }

  var api = {
    DEFAULTS: DEFAULTS, INDICATORS: INDICATORS, STATUS_ORDER: STATUS_ORDER,
    mean: mean, sd: sd, getIndicator: getIndicator, validateEntry: validateEntry,
    seriesFor: seriesFor, computeStatus: computeStatus, worstStatus: worstStatus, assess: assess
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
