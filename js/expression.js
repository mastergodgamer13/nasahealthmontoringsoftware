/*
 * expression.js — gene expression change: fold change and classification (pure logic, no DOM).
 * Port of the two functions calculate_fold_change() and classify_gene() supplied with the project.
 *
 * foldChange(log2fc)  = 2 ^ log2fc   (> 1 higher, < 1 lower, = 1 no change)
 * classify(log2fc, padj, opts) -> 'up' | 'down' | 'below' | 'ns' | 'nodata'
 *   'ns'     adjusted p-value > padj cut-off (not statistically significant)
 *   'up'     significant and log2fc >= log2fc cut-off
 *   'down'   significant and log2fc <= -cut-off
 *   'below'  significant, but |log2fc| below the cut-off
 *   'nodata' missing / non-finite value (never treated as "no change")
 * The cut-offs are statistical conventions, not clinical thresholds.
 */
(function (root) {
  'use strict';

  var DEFAULTS = { padj: 0.05, log2fc: 1.5 };
  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  function foldChange(log2fc) {
    if (log2fc === null || log2fc === undefined) throw new Error('log2 fold change cannot be null');
    if (!isNum(log2fc)) throw new Error('log2 fold change must be finite');
    return Math.pow(2, log2fc);
  }

  function classify(log2fc, padj, opts) {
    var c = { padj: DEFAULTS.padj, log2fc: DEFAULTS.log2fc };
    if (opts) { if (isNum(opts.padj)) c.padj = opts.padj; if (isNum(opts.log2fc)) c.log2fc = opts.log2fc; }
    if (!isNum(log2fc) || !isNum(padj)) return 'nodata';
    if (padj < 0 || padj > 1) throw new RangeError('Adjusted p-value must be between 0 and 1');
    if (padj > c.padj) return 'ns';
    if (log2fc >= c.log2fc) return 'up';
    if (log2fc <= -c.log2fc) return 'down';
    return 'below';
  }

  var api = { DEFAULTS: DEFAULTS, CLASSES: ['up', 'down', 'below', 'ns', 'nodata'], foldChange: foldChange, classify: classify };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Expression = api;
})(typeof window !== 'undefined' ? window : globalThis);
