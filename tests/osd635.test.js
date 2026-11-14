// Run: node tests/osd635.test.js
const assert = require('assert');
const O = require('../js/osd635.js');
let n = 0;
function test(name, fn) { fn(); n++; console.log('ok -', name); }

test('6 samples: 3 space flight + 3 ground control, unique ids', () => {
  assert.strictEqual(O.SAMPLES.length, 6);
  assert.strictEqual(O.count('flight'), 3); assert.strictEqual(O.count('ground'), 3);
  assert.strictEqual(new Set(O.SAMPLES.map(s => s.id)).size, 6);
  O.SAMPLES.forEach(s => assert.ok(O.GROUPS.includes(s.group)));
});
test('sample ids follow the published naming (F = flight, G = ground)', () => {
  O.SAMPLES.forEach(s => assert.strictEqual(s.id.split('-')[1], s.group === 'flight' ? 'F' : 'G'));
});
test('spot checks against the published assay table (copied values)', () => {
  const by = id => O.SAMPLES.find(s => s.id === id);
  assert.strictEqual(by('SMC-F-E1_S1').readDepth, 57184416); assert.strictEqual(by('SMC-F-E1_S1').rrna, 2.67);
  assert.strictEqual(by('SMC-G-E2_S6').readDepth, 80394761); assert.strictEqual(by('SMC-G-E3_S7').rrna, 1.9);
});
test('study facts from the investigation file', () => {
  assert.strictEqual(O.STUDY.id, 'OSD-635'); assert.strictEqual(O.STUDY.organism, 'Homo sapiens');
  assert.strictEqual(O.STUDY.cultureDays, 3); assert.strictEqual(O.STUDY.statedSignificantGenes, 4422);
  assert.strictEqual(O.STUDY.missionStart, '2019-05-04'); assert.strictEqual(O.STUDY.missionEnd, '2019-06-03');
  assert.strictEqual(O.DOI_URL, 'https://doi.org/10.1038/s41526-024-00380-w');
});
test('module holds no gene-level results (they are not in the metadata files)', () => {
  assert.ok(!('GENES' in O) && !('genes' in O));
  assert.ok(/differential_expression/.test(O.STUDY.resultsFile));
});
console.log(n + ' osd635 tests passed');
