// Run: node tests/i18n.test.js
const assert = require('assert');
const I18n = require('../js/i18n.js');
const Content = require('../js/content.js');
const Core = require('../js/core.js');
let n = 0;
function test(name, fn) { fn(); n++; console.log('ok -', name); }
const codes = I18n.LANGS.map(l => l.code);
const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(',');

test('four languages: en tr it es', () => assert.deepStrictEqual(codes, ['en', 'tr', 'it', 'es']));
codes.forEach(c => test('no missing/extra keys in ' + c, () => {
  const d = I18n.diff(c);
  assert.deepStrictEqual(d.missing, []); assert.deepStrictEqual(d.extra, []);
}));
codes.forEach(c => test('placeholders match English in ' + c, () => {
  Object.keys(I18n.DICT.en).forEach(k => assert.strictEqual(ph(I18n.DICT[c][k]), ph(I18n.DICT.en[k]), c + ':' + k));
}));
codes.forEach(c => test('no empty strings in ' + c, () => {
  Object.keys(I18n.DICT[c]).forEach(k => assert.ok(I18n.DICT[c][k].trim().length > 0, c + ':' + k));
}));
test('t substitutes params and falls back to key', () => {
  assert.strictEqual(I18n.t('nope.key'), 'nope.key');
  assert.ok(I18n.t('savedFor', { date: '2026-01-01' }).includes('2026-01-01'));
});
test('keys required by content/core exist in every language', () => {
  codes.forEach(c => {
    const D = I18n.DICT[c];
    Object.keys(Content.REGIONS).forEach(r => {
      assert.ok(D['region.' + r + '.title'] && D['region.' + r + '.blurb'], c + ' region ' + r);
      Content.REGIONS[r].hazards.forEach(h => assert.ok(D['hazard.' + h], c + ' hazard ' + h));
    });
    Core.INDICATORS.forEach(i => ['ind.', 'info.'].forEach(p => {
      if (p === 'ind.') assert.ok(D['ind.' + i.id], c + ' ' + i.id);
      else { assert.ok(D['info.' + i.id + '.why'] && D['info.' + i.id + '.how'], c + ' info ' + i.id); }
    }));
    ['ok', 'watch', 'attention', 'nodata'].forEach(s => assert.ok(D['status.' + s] && D['msg.' + s], c + ' ' + s));
    ['collecting', 'baselineDone', 'flat'].forEach(r => assert.ok(D['reason.' + r], c + ' reason ' + r));
    ['date', 'notnum', 'range', 'integer', 'empty', 'bp'].forEach(e => assert.ok(D['err.' + e], c + ' err ' + e));
  });
});
test('core error codes are all translatable', () => {
  const v = Core.validateEntry({ date: 'x', hr: 'abc', sys: '9999', mood: '2.5', dia: '' });
  assert.ok(v.codes && v.codes.length >= 3);
  v.codes.forEach(c => assert.ok(I18n.DICT.en['err.' + c.code], c.code));
});
test('keys used by users / compare / OSDR views exist in every language', () => {
  const Osdr = require('../js/osdr.js');
  codes.forEach(c => {
    const D = I18n.DICT[c];
    Object.keys(Osdr.ANALYTES).forEach(a => assert.ok(D['osdr.a.' + a], c + ' analyte ' + a));
    ['empty', 'dup', 'max'].forEach(e => assert.ok(D['users.err.' + e], c + ' users.err.' + e));
    ['tabDash', 'tabCompare', 'tabOsdr', 'users.legacyName', 'osdr.low', 'osdr.high', 'osdr.out'].forEach(k => assert.ok(D[k], c + ' ' + k));
  });
});
console.log(n + ' i18n tests passed');
