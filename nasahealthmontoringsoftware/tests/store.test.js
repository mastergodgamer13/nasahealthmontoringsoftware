// Run: node tests/store.test.js
const assert = require('assert');
const Store = require('../js/store.js');
let n = 0;
function test(name, fn) { fn(); n++; console.log('ok -', name); }
function mem(init) { const m = Object.assign({}, init); return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; }

test('starts empty', () => { const s = Store.create(mem()); assert.strictEqual(s.users().length, 0); assert.strictEqual(s.current(), null); });
test('add selects the new user and persists', () => {
  const st = mem(); const s = Store.create(st); const r = s.add('  Student   1 ');
  assert.ok(r.ok); assert.strictEqual(r.user.name, 'Student 1'); assert.strictEqual(s.current(), r.user.id);
  const s2 = Store.create(st); assert.strictEqual(s2.users()[0].name, 'Student 1'); assert.strictEqual(s2.current(), r.user.id);
});
test('rejects empty, duplicate (case-insensitive) and too many users', () => {
  const s = Store.create(mem());
  assert.strictEqual(s.add('   ').code, 'empty');
  s.add('Ada'); assert.strictEqual(s.add('ada').code, 'dup');
  for (let i = 1; i < Store.MAX_USERS; i++) assert.ok(s.add('U' + i).ok);
  const r = s.add('Overflow'); assert.strictEqual(r.code, 'max'); assert.strictEqual(r.max, Store.MAX_USERS);
});
test('entries are per user and one per date', () => {
  const s = Store.create(mem()); const a = s.add('A').user, b = s.add('B').user;
  s.saveEntry(a.id, { date: '2026-01-01', hr: 60 }); s.saveEntry(a.id, { date: '2026-01-01', hr: 65 }); s.saveEntry(b.id, { date: '2026-01-01', hr: 90 });
  assert.strictEqual(s.entriesOf(a.id).length, 1); assert.strictEqual(s.entriesOf(a.id)[0].hr, 65); assert.strictEqual(s.entriesOf(b.id)[0].hr, 90);
});
test('removing the current user selects another; clearEntries keeps the user', () => {
  const s = Store.create(mem()); const a = s.add('A').user, b = s.add('B').user;
  s.saveEntry(b.id, { date: '2026-01-02', hr: 70 }); s.clearEntries(b.id);
  assert.strictEqual(s.entriesOf(b.id).length, 0); assert.strictEqual(s.users().length, 2);
  assert.ok(s.remove(b.id)); assert.strictEqual(s.current(), a.id);
  assert.ok(s.remove(a.id)); assert.strictEqual(s.current(), null);
});
test('ids are never reused after removal', () => {
  const s = Store.create(mem()); const a = s.add('A').user; const b = s.add('B').user; s.remove(a.id); const c = s.add('C').user;
  assert.notStrictEqual(c.id, b.id);
});
test('migrates legacy single-user entries once', () => {
  const st = mem({ sa_manual_entries_v1: JSON.stringify([{ date: '2026-01-01', hr: 60 }]) });
  const s = Store.create(st, { legacyName: 'Earlier' });
  assert.strictEqual(s.users().length, 1); assert.strictEqual(s.users()[0].name, 'Earlier'); assert.strictEqual(s.users()[0].entries.length, 1);
  assert.ok(st.m.sa_users_v2);
});
test('corrupt storage does not throw', () => {
  const s = Store.create(mem({ sa_users_v2: '{not json' })); assert.strictEqual(s.users().length, 0);
});
test('blocked storage does not throw', () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const s = Store.create(bad); assert.ok(s.add('A').ok);
});
console.log(n + ' store tests passed');
