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
test('prePost: pre = first 3 time points, post = the other 4, per crew member', () => {
  const d = O.prePost('C001').glucose; // pre 83, 80, 69; post 90, 84, 91, 87
  assert.ok(Math.abs(d.preMean - 77.3333) < 0.001);
  assert.strictEqual(d.preMin, 69); assert.strictEqual(d.preMax, 83);
  assert.deepStrictEqual(d.post.map(p => p.tp), ['R+1', 'R+45', 'R+82', 'R+194']);
  assert.deepStrictEqual(d.post.map(p => p.value), [90, 84, 91, 87]);
  assert.ok(d.post.every(p => p.vsPre === 'above'));
});
test('prePost: below own pre-flight range and lab-range flag are independent', () => {
  const p = O.prePost('C003').glucose.post[1]; // C003 R+45 = 36; pre 77, 62, 75
  assert.strictEqual(p.tp, 'R+45'); assert.strictEqual(p.vsPre, 'below'); assert.strictEqual(p.flag, 'low');
  const q = O.prePost('C004').glucose.post[0]; // R+1 = 97, pre 100, 83, 56 -> inside own range, inside lab range
  assert.strictEqual(q.vsPre, null); assert.strictEqual(q.flag, null);
});
test('prePost covers every analyte and matches summary()', () => {
  O.crewIds().forEach(c => {
    const d = O.prePost(c);
    assert.deepStrictEqual(Object.keys(d), Object.keys(O.ANALYTES));
    Object.keys(O.ANALYTES).forEach(a => {
      const s = O.summary(c, a);
      assert.strictEqual(d[a].preMean, s.preMean);
      d[a].post.forEach((p, i) => assert.strictEqual(p.delta, s.points[O.PRE + i].delta));
    });
  });
});
test('groupOf: first 3 time points are pre-flight, the rest post-flight', () => {
  assert.deepStrictEqual(O.TIMEPOINTS.map(O.groupOf), ['pre', 'pre', 'pre', 'post', 'post', 'post', 'post']);
  assert.strictEqual(O.groupOf('R+2'), null);
});
test('validateFlight: accepts values, rounds to the dataset decimals, keeps only given analytes', () => {
  const v = O.validateFlight({ tp: 'R+45', glucose: '44.4', potassium: '5,94', sodium: '', albumin: '  ' });
  assert.ok(v.ok); assert.deepStrictEqual(v.entry, { tp: 'R+45', glucose: 44, potassium: 5.9 });
});
test('validateFlight: rejects unknown time point, empty record, non-numbers and impossible values', () => {
  assert.strictEqual(O.validateFlight({ tp: 'R+2', glucose: '80' }).codes[0].code, 'tp');
  assert.strictEqual(O.validateFlight({ tp: 'L-3' }).codes[0].code, 'empty');
  assert.strictEqual(O.validateFlight({ tp: 'L-3', glucose: 'abc' }).codes[0].code, 'notnum');
  const r = O.validateFlight({ tp: 'L-3', glucose: '5000', sodium: '10' });
  assert.deepStrictEqual(r.codes.map(c => c.id), ['glucose', 'sodium']); assert.strictEqual(r.codes[0].max, 800);
});
test('validateFlight: the lab range is NOT a limit (out-of-range values are accepted and flagged)', () => {
  assert.ok(O.validateFlight({ tp: 'R+45', glucose: '36' }).ok);
  assert.strictEqual(O.flag('glucose', 36), 'low');
});
test('flightSummary: pre-flight mean/range from entered pre points, delta and vsPre for post', () => {
  const recs = [{ tp: 'L-3', glucose: 69 }, { tp: 'L-92', glucose: 83 }, { tp: 'L-44', glucose: 80 }, { tp: 'R+45', glucose: 44 }, { tp: 'R+1', glucose: 90 }];
  const s = O.flightSummary(recs), g = s.analytes.glucose;
  assert.deepStrictEqual(s.tps, ['L-92', 'L-44', 'L-3', 'R+1', 'R+45']); // dataset time order, not entry order
  assert.strictEqual(g.preN, 3); assert.ok(Math.abs(g.preMean - 77.3333) < 0.001); assert.strictEqual(g.preMin, 69); assert.strictEqual(g.preMax, 83);
  const r1 = g.points[3], r45 = g.points[4];
  assert.strictEqual(r1.group, 'post'); assert.ok(Math.abs(r1.delta - (90 - 77.3333)) < 0.001); assert.strictEqual(r1.vsPre, 'above');
  assert.strictEqual(r45.vsPre, 'below'); assert.strictEqual(r45.flag, 'low');
  assert.strictEqual(g.points[0].delta, null); // pre-flight points have no delta
  assert.strictEqual(s.analytes.sodium.preN, 0); assert.strictEqual(s.analytes.sodium.preMean, null);
});
test('flightSummary: needs >= 2 pre values for vsPre, >= 1 for delta; ignores unknown time points', () => {
  const s = O.flightSummary([{ tp: 'L-3', glucose: 80 }, { tp: 'R+1', glucose: 120 }, { tp: 'X', glucose: 1 }]).analytes.glucose;
  assert.strictEqual(s.points.length, 2); assert.strictEqual(s.points[1].delta, 40); assert.strictEqual(s.points[1].vsPre, null);
  const none = O.flightSummary([{ tp: 'R+1', glucose: 120 }]).analytes.glucose.points[0];
  assert.strictEqual(none.delta, null);
  assert.deepStrictEqual(O.flightSummary(undefined).tps, []);
});
console.log(n + ' osdr tests passed');
