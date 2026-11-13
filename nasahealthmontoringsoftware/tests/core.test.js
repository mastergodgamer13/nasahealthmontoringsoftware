// Run with: node tests/core.test.js   (no dependencies)
'use strict';
var assert = require('assert');
var Core = require('../js/core.js');
var Demo = require('../js/demo.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   - ' + name); }
  catch (e) { console.error('FAIL - ' + name + '\n       ' + e.message); process.exitCode = 1; }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-9); }

test('mean and sample sd', function () {
  assert.ok(near(Core.mean([1, 2, 3, 4]), 2.5));
  assert.ok(near(Core.sd([2, 4, 4, 4, 5, 5, 7, 9]), 2.138089935299395, 1e-9));
  assert.ok(isNaN(Core.sd([5])));
});

test('fewer readings than baseline -> nodata (never "ok")', function () {
  var r = Core.computeStatus([60, 61, 62]);
  assert.strictEqual(r.status, 'nodata');
});

test('baseline complete but nothing after -> nodata', function () {
  var r = Core.computeStatus([60, 61, 62, 60, 61, 62, 61]);
  assert.strictEqual(r.status, 'nodata');
});

test('flat baseline (sd = 0) -> nodata, no division by zero', function () {
  var r = Core.computeStatus([60, 60, 60, 60, 60, 60, 60, 80]);
  assert.strictEqual(r.status, 'nodata');
});

var BASE = [60, 62, 61, 63, 60, 62, 61]; // mean ~61.29, sd ~1.15

test('stable readings after baseline -> ok', function () {
  var r = Core.computeStatus(BASE.concat([61, 62, 61]));
  assert.strictEqual(r.status, 'ok');
});

test('large upward shift -> attention', function () {
  var r = Core.computeStatus(BASE.concat([70, 71, 72]));
  assert.strictEqual(r.status, 'attention');
  assert.ok(r.z > 3);
});

test('large downward shift is also flagged (two-sided)', function () {
  var r = Core.computeStatus(BASE.concat([50, 51, 50]));
  assert.strictEqual(r.status, 'attention');
  assert.ok(r.z < -3);
});

test('moderate shift -> watch', function () {
  // recent mean ~ 63.9 -> z about 2.3
  var r = Core.computeStatus(BASE.concat([64, 64, 64]));
  assert.strictEqual(r.status, 'watch');
});

test('non-numeric values are ignored', function () {
  var r = Core.computeStatus(BASE.concat([NaN, null, undefined, 61, 62, 61]));
  assert.strictEqual(r.status, 'ok');
});

test('validateEntry accepts valid, allows missing indicators', function () {
  var v = Core.validateEntry({ date: '2030-01-01', hr: '62', sys: '', sleep: '7,5' });
  assert.ok(v.ok);
  assert.strictEqual(v.entry.hr, 62);
  assert.strictEqual(v.entry.sleep, 7.5);
  assert.strictEqual(v.entry.sys, undefined);
});

test('validateEntry rejects bad date, empty entry, out-of-range, text, non-integer mood', function () {
  assert.ok(!Core.validateEntry({ date: '01/01/2030', hr: 60 }).ok);
  assert.ok(!Core.validateEntry({ date: '2030-01-01' }).ok);
  assert.ok(!Core.validateEntry({ date: '2030-01-01', hr: 900 }).ok);
  assert.ok(!Core.validateEntry({ date: '2030-01-01', hr: 'abc' }).ok);
  assert.ok(!Core.validateEntry({ date: '2030-01-01', mood: 3.5 }).ok);
  assert.ok(!Core.validateEntry(null).ok);
});

test('validateEntry rejects diastolic >= systolic', function () {
  assert.ok(!Core.validateEntry({ date: '2030-01-01', sys: 100, dia: 100 }).ok);
});

test('worstStatus: nodata only if everything is nodata', function () {
  assert.strictEqual(Core.worstStatus(['nodata', 'nodata']), 'nodata');
  assert.strictEqual(Core.worstStatus(['nodata', 'ok']), 'ok');
  assert.strictEqual(Core.worstStatus(['ok', 'watch', 'nodata']), 'watch');
  assert.strictEqual(Core.worstStatus(['ok', 'attention', 'watch']), 'attention');
});

test('simulated demo is deterministic for a given seed', function () {
  assert.deepStrictEqual(Demo.generate(2026, 30), Demo.generate(2026, 30));
  assert.notDeepStrictEqual(Demo.generate(1, 30), Demo.generate(2, 30));
});

test('simulated demo entries pass validation', function () {
  Demo.generate(2026, 30).forEach(function (e) {
    var v = Core.validateEntry(e);
    assert.ok(v.ok, JSON.stringify(e) + ' -> ' + v.errors.join(' '));
  });
});

test('demo scenario: sleep, heart rate, mood drift are detected; stable indicators are not', function () {
  var a = Core.assess(Demo.generate(2026, 30));
  assert.strictEqual(a.per.sleep.status, 'attention');
  assert.strictEqual(a.per.hr.status, 'attention');
  assert.ok(['watch', 'attention'].indexOf(a.per.mood.status) >= 0);
  assert.notStrictEqual(a.per.glucose.status, 'attention');
  assert.notStrictEqual(a.per.temp.status, 'attention');
});

test('assess on empty data: every indicator nodata, overall nodata', function () {
  var a = Core.assess([]);
  assert.strictEqual(a.overall, 'nodata');
  assert.strictEqual(a.counts.nodata, a.total);
});

console.log('\n' + passed + ' tests passed' + (process.exitCode ? ', some FAILED' : ''));
