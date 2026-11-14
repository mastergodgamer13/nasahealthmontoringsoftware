// Run: node tests/osd569.test.js
const assert = require('assert');
const fs = require('fs');
const O = require('../js/osd569.js');
const Ex = require('../js/expression.js');
let n = 0;
function test(name, fn) { fn(); n++; console.log('ok -', name); }

test('4 crew, 7 time points, 8 CBC analytes, arrays aligned', () => {
  assert.deepStrictEqual(O.crewIds(), ['C001', 'C002', 'C003', 'C004']);
  assert.deepStrictEqual(O.TIMEPOINTS, ['L-92', 'L-44', 'L-3', 'R+1', 'R+45', 'R+82', 'R+194']);
  assert.strictEqual(O.ANALYTES.length, 8);
  O.crewIds().forEach(c => O.ANALYTES.forEach(a => ['values', 'lo', 'hi'].forEach(k => assert.strictEqual(O.CREW[c][a.id][k].length, 7))));
});
test('spot checks against the published CBC file (copied values)', () => {
  assert.strictEqual(O.CREW.C001.wbc.values[2], 7);       // C001 L-3
  assert.strictEqual(O.CREW.C001.hgb.values[3], 14.7);    // C001 R+1
  assert.strictEqual(O.CREW.C002.hgb.values[5], 11.5);    // C002 R+82
  assert.strictEqual(O.CREW.C004.plt.values[5], 198);     // C004 R+82
  assert.strictEqual(O.CREW.C003.neut.values[3], 4088);   // C003 R+1
});
test('lab ranges are per row and differ by sex (hemoglobin)', () => {
  assert.deepStrictEqual([O.CREW.C001.hgb.lo[0], O.CREW.C001.hgb.hi[0]], [13.2, 17.1]); // male
  assert.deepStrictEqual([O.CREW.C002.hgb.lo[0], O.CREW.C002.hgb.hi[0]], [11.7, 15.5]); // female
  assert.strictEqual(O.flag('C002', 'hgb', 2), 'low');   // C002 L-3: 11.5 < 11.7
  assert.strictEqual(O.flag('C001', 'hgb', 0), null);
});
test('the shifted C003 L-92 row: untrusted fields left empty, trusted ones kept', () => {
  assert.deepStrictEqual(O.EXCLUDED, [{ crew: 'C003', tp: 'L-92', fields: ['lymph', 'neut', 'plt'] }]);
  ['neut', 'lymph', 'plt'].forEach(a => assert.strictEqual(O.CREW.C003[a].values[0], null));
  assert.strictEqual(O.CREW.C003.wbc.values[0], 9.6); assert.strictEqual(O.CREW.C003.hgb.values[0], 13.2);
  assert.strictEqual(O.flag('C003', 'neut', 0), null);
});
test('missing values stay missing (C002 R+194 MCV is blank in the source)', () => {
  assert.strictEqual(O.CREW.C002.mcv.values[6], null);
  assert.strictEqual(O.prePost('C002').mcv.post[3].value, null);
  assert.strictEqual(O.prePost('C002').mcv.post[3].delta, null);
});
test('absolute neutrophils agree with WBC x neutrophil % elsewhere (sanity check of the copied values)', () => {
  // C001 L-3: 7.0 x 1000 x 0.51 = 3570
  assert.strictEqual(Math.round(O.CREW.C001.wbc.values[2] * 1000 * 0.51), O.CREW.C001.neut.values[2]);
});
test('prePost: mean/range from pre-flight values only, delta and vsPre for post-flight', () => {
  const p = O.prePost('C001').wbc;
  assert.strictEqual(p.preN, 3); assert.ok(Math.abs(p.preMean - (7 + 5.5 + 5.4) / 3) < 1e-9);
  assert.strictEqual(p.preMin, 5.4); assert.strictEqual(p.preMax, 7);
  assert.strictEqual(p.post.length, 4); assert.strictEqual(p.post[0].tp, 'R+1');
  assert.ok(Math.abs(p.post[0].delta - (5 - p.preMean)) < 1e-9);
  assert.strictEqual(p.post[0].vsPre, 'below');
});
test('prePost with only two pre-flight values still works; vsPre needs at least 2', () => {
  const p = O.prePost('C003').neut; // C003 L-92 neut is empty -> preN 2
  assert.strictEqual(p.preN, 2); assert.strictEqual(p.preMin, 5792); assert.strictEqual(p.preMax, 6408);
});
test('gene results: 13 comparisons x 2 tools, counts add up to the genes in the file', () => {
  assert.strictEqual(O.COMPARISONS.length, 13);
  O.COMPARISONS.forEach(c => O.TOOLS.forEach(t => {
    const k = O.classCounts(c.id, t);
    assert.strictEqual(k.up + k.down + k.below + k.ns + k.nodata, c.genes);
  }));
});
test('spot checks of class counts (main comparison I4-FP3)', () => {
  assert.deepStrictEqual(O.classCounts('I4-FP3', 'DESeq2'), { up: 0, down: 0, below: 0, ns: 20243, nodata: 41609 });
  assert.deepStrictEqual(O.classCounts('I4-FP3', 'pipeline-transcriptome-de'), { up: 8, down: 3, below: 5, ns: 20431, nodata: 41405 });
});
test('listed genes: 11, all classified up/down by expression.js, counts match', () => {
  const g = O.listedGenes();
  assert.strictEqual(g.length, 11);
  const k = O.classCounts('I4-FP3', 'pipeline-transcriptome-de');
  assert.strictEqual(g.filter(x => x.cls === 'up').length, k.up); assert.strictEqual(g.filter(x => x.cls === 'down').length, k.down);
  g.forEach(x => { assert.ok(x.padj <= 0.05 && Math.abs(x.log2fc) >= 1.5); assert.strictEqual(x.fc, Ex.foldChange(x.log2fc)); assert.ok(/^ENSG\d{11}$/.test(x.ensembl)); });
  assert.strictEqual(g[0].ensembl, 'ENSG00000213934'); assert.strictEqual(g[0].log2fc, 7.47533);
});
test('study facts', () => {
  assert.strictEqual(O.STUDY.id, 'OSD-569'); assert.strictEqual(O.NANOPORE.samples, 29);
  assert.strictEqual(O.NANOPORE.rinMin, 3.2); assert.strictEqual(O.NANOPORE.rinMax, 8.5);
  assert.strictEqual(O.DOI_URL, 'https://doi.org/10.1038/s41467-024-48929-3');
});
console.log(n + ' osd569 tests passed');
