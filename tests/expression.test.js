// Run: node tests/expression.test.js
const assert = require('assert');
const E = require('../js/expression.js');
let n = 0;
function test(name, fn) { fn(); n++; console.log('ok -', name); }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-4, a + ' vs ' + b);

test('foldChange = 2^log2FC (the five example genes from the project code)', () => {
  close(E.foldChange(-2.0), 0.25); close(E.foldChange(2.0), 4); close(E.foldChange(-1.7), 0.3078);
  close(E.foldChange(0.5), 1.4142); close(E.foldChange(1.8), 3.4822); assert.strictEqual(E.foldChange(0), 1);
});
test('foldChange rejects null/undefined and non-finite input', () => {
  [null, undefined, NaN, Infinity, -Infinity, '2'].forEach(v => assert.throws(() => E.foldChange(v), Error));
});
test('classify: the five example genes (illustrative values, not data)', () => {
  assert.strictEqual(E.classify(-2.0, 0.001), 'down');   // ACTA2
  assert.strictEqual(E.classify(2.0, 0.002), 'up');      // MMP9
  assert.strictEqual(E.classify(-1.7, 0.010), 'down');   // CNN1
  assert.strictEqual(E.classify(0.5, 0.030), 'below');   // STAT3
  assert.strictEqual(E.classify(1.8, 0.200), 'ns');      // GENE_X
});
test('classify: boundaries are inclusive (padj <= 0.05, |log2FC| >= 1.5)', () => {
  assert.strictEqual(E.classify(1.5, 0.05), 'up'); assert.strictEqual(E.classify(-1.5, 0.05), 'down');
  assert.strictEqual(E.classify(1.4999, 0.05), 'below'); assert.strictEqual(E.classify(2, 0.0500001), 'ns');
});
test('classify: significance is checked before effect size', () => {
  assert.strictEqual(E.classify(10, 0.5), 'ns'); assert.strictEqual(E.classify(-10, 0.9), 'ns');
});
test('classify: missing values are "nodata", never "no change"', () => {
  [[null, 0.01], [1, null], [undefined, 0.01], [NaN, 0.01], [1, NaN], [Infinity, 0.01]].forEach(a => assert.strictEqual(E.classify(a[0], a[1]), 'nodata'));
});
test('classify: adjusted p-value outside 0..1 throws', () => {
  assert.throws(() => E.classify(1, -0.1), RangeError); assert.throws(() => E.classify(1, 1.1), RangeError);
  assert.strictEqual(E.classify(1, 0), 'below'); assert.strictEqual(E.classify(1, 1), 'ns');
});
test('classify: custom cut-offs; defaults are 0.05 and 1.5', () => {
  assert.deepStrictEqual(E.DEFAULTS, { padj: 0.05, log2fc: 1.5 });
  assert.strictEqual(E.classify(1.2, 0.04, { log2fc: 1 }), 'up'); assert.strictEqual(E.classify(1.2, 0.04, { padj: 0.01 }), 'ns');
});
console.log(n + ' expression tests passed');
