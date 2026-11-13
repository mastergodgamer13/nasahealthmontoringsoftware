/*
 * demo.js — SIMULATED data generator. Every value produced here is FICTIONAL.
 * Parameters are arbitrary, chosen only to demonstrate how the app reacts to drifts.
 * They make no claim about real astronaut physiology.
 */
(function (root) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeGauss(rand) {
    return function () {
      var u = 0, v = 0;
      while (u === 0) u = rand();
      v = rand();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** 30 fictional mission days. Drifts start on day 14 (sleep), 18 (heart rate), 20 (mood). */
  function generate(seed, days) {
    days = days || 30;
    var rand = mulberry32(seed || 2026);
    var g = makeGauss(rand);
    var out = [];
    for (var d = 1; d <= days; d++) {
      var sleepDrift = d >= 14 ? -0.12 * (d - 13) : 0;
      var hrDrift = d >= 18 ? 0.5 * (d - 17) : 0;
      var moodDrift = d >= 20 ? -0.06 * (d - 19) : 0;
      var mood = Math.round(Math.min(5, Math.max(1, 4 + moodDrift + g() * 0.5)));
      var sys = Math.round(118 + g() * 4);
      var dia = Math.round(76 + g() * 3);
      out.push({
        date: '2030-03-' + pad(d),   // fictional calendar; labelled "Mission day" in the UI
        day: d,
        hr: Math.round(62 + hrDrift + g() * 2),
        sys: sys,
        dia: Math.min(dia, sys - 20),
        glucose: Math.round(92 + g() * 5),
        temp: Math.round((36.6 + g() * 0.2) * 10) / 10,
        sleep: Math.round(Math.max(0, 7.2 + sleepDrift + g() * 0.4) * 10) / 10,
        mood: mood
      });
    }
    return out;
  }

  var api = { generate: generate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Demo = api;
})(typeof window !== 'undefined' ? window : globalThis);
