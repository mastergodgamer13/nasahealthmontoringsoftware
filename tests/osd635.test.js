// Run: node tests/osd635.test.js
const assert = require('assert');
const O = require('../js/osd635.js');
const Ex = require('../js/expression.js');
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
const D = require('../js/osd635-genes.js');
test('gene table: 22,253 genes, columns as generated, no filtering', () => {
  assert.strictEqual(D.rows.length, 22253); assert.strictEqual(D.study, 'OSD-635');
  assert.deepStrictEqual(D.cols, ['ensembl', 'symbol', 'name', 'log2fc', 'padj', 'flightMean', 'groundMean']);
  assert.ok(D.rows.every(r => r.length === D.cols.length));
  assert.strictEqual(D.rows.filter(r => r[4] === null).length, 4); // 4 genes have NA adjusted p-value in the file
});
test('spot checks against the published file (rounded to 6 significant digits)', () => {
  const by = sym => O.bySymbol(D, [sym])[0];
  assert.strictEqual(by('ACTA2').ensembl, 'ENSG00000107796'); assert.strictEqual(by('ACTA2').log2fc, -1.17602); assert.strictEqual(by('ACTA2').padj, 8.50151e-12);
  assert.strictEqual(by('MMP9').log2fc, -2.56959); assert.strictEqual(by('CNN1').log2fc, 1.27890); assert.strictEqual(by('STAT3').log2fc, 0.480264);
});
test('contrast direction: log2FC > 0 means higher in Space Flight (CNN1 up, MMP9 down)', () => {
  const by = sym => O.bySymbol(D, [sym])[0];
  assert.ok(by('CNN1').flightMean > by('CNN1').groundMean && by('CNN1').log2fc > 0);
  assert.ok(by('MMP9').flightMean < by('MMP9').groundMean && by('MMP9').log2fc < 0);
});
test('classes of the featured genes with the default cut-offs', () => {
  const cls = sym => Ex.classify(O.bySymbol(D, [sym])[0].log2fc, O.bySymbol(D, [sym])[0].padj);
  assert.strictEqual(cls('MMP9'), 'down'); assert.strictEqual(cls('ACTA2'), 'below'); assert.strictEqual(cls('CNN1'), 'below'); assert.strictEqual(cls('STAT3'), 'below');
  assert.deepStrictEqual(O.bySymbol(D, O.FEATURED).map(g => g.symbol), ['ACTA2', 'MMP9', 'CNN1', 'STAT3']);
});
test('analyze: counts add up and match the numbers computed from the source CSV', () => {
  const a = O.analyze(D);
  assert.strictEqual(a.total, 22253); assert.strictEqual(Object.values(a.counts).reduce((x, y) => x + y, 0), 22253);
  assert.strictEqual(a.counts.up, 1976); assert.strictEqual(a.counts.down, 2486); assert.strictEqual(a.counts.nodata, 4);
  assert.strictEqual(O.analyze(D, { log2fc: 1 }).counts.up + O.analyze(D, { log2fc: 1 }).counts.down, 6867);
});
test('find: exact symbol first, case-insensitive, by Ensembl id, by name, empty/unknown', () => {
  assert.strictEqual(O.find(D, 'acta2')[0].symbol, 'ACTA2'); assert.strictEqual(O.find(D, 'ENSG00000107796')[0].symbol, 'ACTA2');
  assert.ok(O.find(D, 'ACTA')[0].symbol.startsWith('ACTA')); assert.ok(O.find(D, 'tetraspanin').length > 0);
  assert.deepStrictEqual(O.find(D, '  '), []); assert.deepStrictEqual(O.find(D, 'zzzzzzzz'), []); assert.ok(O.find(D, 'a', 5).length <= 5);
});
test('top: strongest genes pass both cut-offs and are sorted', () => {
  const up = O.top(D, 'up', 10), down = O.top(D, 'down', 10);
  assert.strictEqual(up.length, 10); assert.strictEqual(down.length, 10);
  up.forEach(g => assert.strictEqual(Ex.classify(g.log2fc, g.padj), 'up')); down.forEach(g => assert.strictEqual(Ex.classify(g.log2fc, g.padj), 'down'));
  for (let i = 1; i < 10; i++) { assert.ok(up[i - 1].log2fc >= up[i].log2fc); assert.ok(down[i - 1].log2fc <= down[i].log2fc); }
});
console.log(n + ' osd635 tests passed');
