// Run: node tests/osdr.test.js
const assert = require('assert');
const O = require('../js/osdr.js');
let n = 0;
function test(name, fn) { fn(); n++; console.log('ok -', name); }

test('4 crew, 4 analytes, 7 time points each', () => {
  assert.deepStrictEqual(O.crewIds(), ['C001', 'C002', 'C003', 'C004']);
  O.crewIds().forEach(c => Object.keys(O.ANALYTES).forEach(a => assert.strictEqual(O.CREW[c][a].length, O.TIMEPOINTS.length, c + a)));
});
test('spot checks against the published file (copied values)', () => {
  assert.strictEqual(O.CREW.C002.glucose[4], 44); // C002 R+45
  assert.strictEqual(O.CREW.C003.glucose[4], 36); // C003 R+45
  assert.strictEqual(O.CREW.C004.potassium[4], 5.9);
  assert.strictEqual(O.CREW.C001.albumin[6], 4.6);
});
test('flag uses only the dataset lab range', () => {
  assert.strictEqual(O.flag('glucose', 64), 'low'); assert.strictEqual(O.flag('glucose', 65), null);
  assert.strictEqual(O.flag('glucose', 99), null); assert.strictEqual(O.flag('glucose', 100), 'high');
});
test('summary: pre-flight mean and delta', () => {
  const s = O.summary('C001', 'glucose'); // (83+80+69)/3
  assert.ok(Math.abs(s.preMean - 77.3333) < 0.001);
  assert.strictEqual(s.points[0].delta, null); assert.strictEqual(s.points[3].tp, 'R+1');
  assert.ok(Math.abs(s.points[3].delta - (90 - 77.3333)) < 0.001);
});
test('glucose: three crew members outside the range at R+45', () => {
  const o = O.outsideAt('glucose', 2).filter(x => x.tp === 'R+45')[0];
  assert.ok(o); assert.strictEqual(o.n, 3); assert.strictEqual(o.min, 36); assert.strictEqual(o.max, 44);
});
test('describe: pooled descriptive statistics match pandas describe() (sample SD, linear quantiles)', () => {
  const d = O.describe('glucose');
  assert.strictEqual(d.n, 28); assert.strictEqual(d.min, 36); assert.strictEqual(d.max, 103);
  assert.ok(Math.abs(d.mean - 76.4286) < 0.001); assert.ok(Math.abs(d.sd - 16.2284) < 0.01);
  assert.ok(d.q1 <= d.median && d.median <= d.q3);
  assert.ok(Math.abs(d.lower - (d.mean - 2 * d.sd)) < 1e-9 && Math.abs(d.upper - (d.mean + 2 * d.sd)) < 1e-9);
});
test('statOutliers: strictly outside pooled mean +/- 2 SD (glucose 44 is just inside)', () => {
  const o = O.statOutliers('glucose').map(r => r.crew + '@' + r.tp + '=' + r.value).sort();
  assert.deepStrictEqual(o, ['C003@R+45=36', 'C004@R+45=43']);
  assert.deepStrictEqual(O.statOutliers('potassium').map(r => r.value), [5.9]);
  assert.deepStrictEqual(O.statOutliers('albumin'), []);
});
test('statOutliers are independent of the laboratory range flags', () => {
  const r = O.statOutliers('sodium')[0];
  assert.strictEqual(r.value, 143); assert.strictEqual(O.flag('sodium', r.value), null);
});
console.log(n + ' osdr tests passed');
