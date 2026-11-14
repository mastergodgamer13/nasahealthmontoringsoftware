// Run: node tests/immune.test.js
const assert = require('assert');
const I = require('../js/immune.js');
const Store = require('../js/store.js');
let n = 0;
function test(name, fn) { fn(); n++; console.log('ok -', name); }
function mem() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; }

test('three analytes with the OSD-569 lab ranges (same for every row of the file)', () => {
  assert.deepStrictEqual(Object.keys(I.ANALYTES), ['wbc', 'neut', 'lymph']);
  assert.deepStrictEqual([I.ANALYTES.wbc.lo, I.ANALYTES.wbc.hi], [3.8, 10.8]);
  assert.deepStrictEqual([I.ANALYTES.neut.lo, I.ANALYTES.neut.hi], [1500, 7800]);
  assert.deepStrictEqual([I.ANALYTES.lymph.lo, I.ANALYTES.lymph.hi], [850, 3900]);
});
test('ranges match every row of the published file (via osd569 data)', () => {
  const O = require('../js/osd569.js');
  O.crewIds().forEach(c => [['wbc', 'wbc'], ['neut', 'neut'], ['lymph', 'lymph']].forEach(([a, b]) =>
    O.CREW[c][b].lo.forEach((lo, i) => { assert.strictEqual(lo, I.ANALYTES[a].lo); assert.strictEqual(O.CREW[c][b].hi[i], I.ANALYTES[a].hi); })));
});
test('validate: accepts numbers and comma decimals, rounds to analyte decimals', () => {
  const v = I.validate({ tp: 'R+1', wbc: '5,26', neut: '2685.4', lymph: '' });
  assert.ok(v.ok); assert.deepStrictEqual(v.entry, { tp: 'R+1', wbc: 5.3, neut: 2685 });
});
test('validate: rejects bad time point, empty, text, impossible values', () => {
  assert.deepStrictEqual(I.validate({ tp: 'R+2', wbc: 5 }).codes, [{ code: 'tp' }]);
  assert.deepStrictEqual(I.validate({ tp: 'L-3' }).codes, [{ code: 'empty' }]);
  assert.strictEqual(I.validate({ tp: 'L-3', wbc: 'abc' }).codes[0].code, 'notnum');
  assert.strictEqual(I.validate({ tp: 'L-3', neut: 999999 }).codes[0].code, 'range');
  assert.strictEqual(I.validate({ tp: 'L-3', wbc: 0 }).ok, false);
});
test('summary: pre-flight mean/range, delta and vsPre for post-flight, flags against lab range', () => {
  const s = I.summary([{ tp: 'L-92', wbc: 5.4 }, { tp: 'L-44', wbc: 5.5 }, { tp: 'L-3', wbc: 7 }, { tp: 'R+1', wbc: 3.5 }, { tp: 'R+45', wbc: 6 }]);
  const a = s.analytes.wbc;
  assert.strictEqual(a.preN, 3); assert.ok(Math.abs(a.preMean - 5.9666667) < 1e-6); assert.strictEqual(a.preMin, 5.4); assert.strictEqual(a.preMax, 7);
  assert.deepStrictEqual(s.tps, ['L-92', 'L-44', 'L-3', 'R+1', 'R+45']);
  const r1 = a.points[3]; assert.strictEqual(r1.flag, 'low'); assert.strictEqual(r1.vsPre, 'below'); assert.ok(Math.abs(r1.delta - (3.5 - a.preMean)) < 1e-9);
  assert.strictEqual(a.points[4].flag, null); assert.strictEqual(a.points[4].vsPre, null);
  assert.strictEqual(a.points[0].delta, null); // pre-flight points have no delta
});
test('summary: one pre value gives delta but no vsPre; no pre value gives neither; unknown time points ignored', () => {
  let a = I.summary([{ tp: 'L-3', lymph: 2000 }, { tp: 'R+1', lymph: 1500 }]).analytes.lymph;
  assert.strictEqual(a.points[1].delta, -500); assert.strictEqual(a.points[1].vsPre, null);
  a = I.summary([{ tp: 'R+1', lymph: 1500 }, { tp: 'X', lymph: 1 }]).analytes.lymph;
  assert.strictEqual(a.points[0].delta, null); assert.strictEqual(a.preN, 0); assert.strictEqual(a.points.length, 1);
});
test('summary: a record without one analyte shows nothing for it', () => {
  const s = I.summary([{ tp: 'R+1', wbc: 5 }]);
  assert.strictEqual(s.analytes.neut.points[0].value, null);
});
test('store: immune records are saved per user, one per time point, and persist', () => {
  const st = mem(); let s = Store.create(st); const u = s.add('Ada').user;
  assert.deepStrictEqual(s.immuneOf(u.id), []);
  s.saveImmune(u.id, { tp: 'R+1', wbc: 5 }); s.saveImmune(u.id, { tp: 'R+1', wbc: 6, neut: 2000 }); s.saveImmune(u.id, { tp: 'L-3', wbc: 7 });
  assert.strictEqual(s.immuneOf(u.id).length, 2);
  s = Store.create(st); assert.deepStrictEqual(s.immuneOf(u.id).find(r => r.tp === 'R+1'), { tp: 'R+1', wbc: 6, neut: 2000 });
  assert.deepStrictEqual(s.flightOf(u.id), []); // separate from the OSD-575 values
  s.clearImmune(u.id); assert.deepStrictEqual(s.immuneOf(u.id), []);
});
test('store: users saved before this feature (no immune field) still load', () => {
  const st = mem(); st.setItem('sa_users_v2', JSON.stringify({ users: [{ id: 'u1', name: 'Old', entries: [], flight: [] }], current: 'u1' }));
  assert.deepStrictEqual(Store.create(st).immuneOf('u1'), []);
});
console.log(n + ' immune tests passed');
