/*
 * osdr.js — REAL data from NASA's Open Science Data Repository, study OSD-575
 * (SpaceX Inspiration4 blood serum: Comprehensive Metabolic Panel, four crew members).
 *
 * Source file: LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv
 * https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager&file=LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv
 *
 * Values were copied unchanged from that file (checked on 2026-11-10). Only four analytes are included here,
 * the ones whose laboratory reference range is identical in every row of the file. The ranges are the
 * laboratory's, exactly as printed in the file; this app does not add or change any threshold.
 * Time points: L-n = n days before launch (pre-flight), R+n = n days after return (post-flight).
 * The study text lists R+1, R+45 and R+82 as post-flight; the file also contains R+194.
 */
(function (root) {
  'use strict';

  var TIMEPOINTS = ['L-92', 'L-44', 'L-3', 'R+1', 'R+45', 'R+82', 'R+194']; // time order
  var PRE = 3; // the first three time points are pre-flight

  var ANALYTES = {
    glucose:   { unit: 'mg/dL',  lo: 65,  hi: 99,  decimals: 0 },
    potassium: { unit: 'mmol/L', lo: 3.5, hi: 5.3, decimals: 1 },
    sodium:    { unit: 'mmol/L', lo: 135, hi: 146, decimals: 0 },
    albumin:   { unit: 'g/dL',   lo: 3.6, hi: 5.1, decimals: 1 }
  };

  var CREW = {
    C001: {
      glucose: [83, 80, 69, 90, 84, 91, 87], potassium: [4.6, 4.2, 3.9, 4.4, 4, 4.3, 4.3],
      sodium: [141, 139, 142, 138, 138, 140, 137], albumin: [5, 5, 4.9, 4.9, 4.9, 5.1, 4.6]
    },
    C002: {
      glucose: [69, 72, 78, 83, 44, 77, 84], potassium: [3.9, 4, 3.8, 3.5, 4.1, 3.7, 4.4],
      sodium: [142, 141, 143, 137, 140, 141, 138], albumin: [4.9, 4.6, 4.3, 4.4, 4.2, 4.5, 4.3]
    },
    C003: {
      glucose: [77, 62, 75, 103, 36, 80, 73], potassium: [3.7, 3.5, 3.3, 3, 4.4, 3.7, 3.8],
      sodium: [139, 139, 138, 137, 136, 138, 137], albumin: [4.4, 4.9, 4.2, 4.2, 4.5, 4.8, 4.4]
    },
    C004: {
      glucose: [100, 83, 56, 97, 43, 80, 84], potassium: [4.2, 4.2, 3.7, 4, 5.9, 4.2, 3.8],
      sodium: [138, 140, 141, 140, 139, 140, 141], albumin: [4.6, 4.4, 4.6, 4.5, 4.5, 4.6, 4.3]
    }
  };

  function crewIds() { return Object.keys(CREW); }

  /** 'low' | 'high' | null — relative to the laboratory range printed in the dataset. */
  function flag(analyte, value) {
    var a = ANALYTES[analyte];
    if (value < a.lo) return 'low';
    if (value > a.hi) return 'high';
    return null;
  }

  /** Descriptive summary only (n = 3 pre-flight values per person; no inference). */
  function summary(crew, analyte) {
    var v = CREW[crew][analyte];
    var pre = v.slice(0, PRE);
    var preMean = pre.reduce(function (s, x) { return s + x; }, 0) / pre.length;
    return {
      pre: pre, preMean: preMean,
      points: v.map(function (x, i) {
        return { tp: TIMEPOINTS[i], value: x, post: i >= PRE, delta: i >= PRE ? x - preMean : null, flag: flag(analyte, x) };
      })
    };
  }

  /** Time points where at least `minCount` crew members are outside the dataset's lab range. */
  function outsideAt(analyte, minCount) {
    var res = [];
    TIMEPOINTS.forEach(function (tp, i) {
      var vals = [];
      crewIds().forEach(function (c) { var x = CREW[c][analyte][i]; if (flag(analyte, x)) vals.push(x); });
      if (vals.length >= (minCount || 2)) {
        res.push({ tp: tp, n: vals.length, total: crewIds().length, min: Math.min.apply(null, vals), max: Math.max.apply(null, vals) });
      }
    });
    return res;
  }

  var api = {
    STUDY: 'OSD-575', TIMEPOINTS: TIMEPOINTS, PRE: PRE, ANALYTES: ANALYTES, CREW: CREW,
    crewIds: crewIds, flag: flag, summary: summary, outsideAt: outsideAt,
    SOURCE_URL: 'https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager&file=LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv'
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Osdr = api;
})(typeof window !== 'undefined' ? window : globalThis);
