/*
 * osd635.js — study information and sample design of NASA OSDR study OSD-635
 * ("Spaceflight effects on human vascular smooth muscle cell phenotype and function").
 *
 * Source: the study's own metadata files (copied as published, no values changed):
 *   s_OSD-635.txt (sample table), a_OSD-635_transcription-profiling_rna-sequencing-_rna-seq__illumina.txt (assay table),
 *   Investigation file (title, description, protocols, publication).
 * These files hold NO gene-level results. The differential-expression results (log2 fold change, adjusted p-value)
 * are in a separate file listed in the assay table and are NOT part of this module yet:
 *   GLDS-608_rna_seq_differential_expression_GLbulkRNAseq.csv
 * (the file names still use the study's earlier GeneLab number, GLDS-608).
 */
(function (root) {
  'use strict';

  var GROUPS = ['flight', 'ground']; // factor "Spaceflight": Space Flight vs Ground Control

  // sample = assay-table sample name; readDepth = reads; rrna = rRNA contamination in percent
  var SAMPLES = [
    { id: 'SMC-F-E1_S1', source: 'SMC Flight sample 1', group: 'flight', readDepth: 57184416, rrna: 2.67 },
    { id: 'SMC-F-E2_S2', source: 'SMC Flight sample 2', group: 'flight', readDepth: 61369820, rrna: 3.26 },
    { id: 'SMC-F-E3_S3', source: 'SMC Flight sample 3', group: 'flight', readDepth: 70106860, rrna: 3.06 },
    { id: 'SMC-G-E1_S5', source: 'SMC Ground sample 1', group: 'ground', readDepth: 62671926, rrna: 2.47 },
    { id: 'SMC-G-E2_S6', source: 'SMC Ground sample 2', group: 'ground', readDepth: 80394761, rrna: 2.05 },
    { id: 'SMC-G-E3_S7', source: 'SMC Ground sample 3', group: 'ground', readDepth: 78584327, rrna: 1.9 }
  ];

  var STUDY = {
    id: 'OSD-635',
    title: 'Spaceflight effects on human vascular smooth muscle cell phenotype and function',
    organism: 'Homo sapiens',
    cell: 'Human aortic smooth muscle cells (HASMC)',
    cultureDays: 3,
    cultureTempC: 37,
    mission: 'SpaceX-17 (CRS-17)',
    program: 'International Space Station (ISS)',
    missionStart: '2019-05-04', missionEnd: '2019-06-03', // source: 05/04/2019 and 06/03/2019 (month/day/year)
    hardware: 'Kayser experimental unit (KEU-RO), STaARS incubator',
    platform: 'Illumina NextSeq500',
    library: 'poly(A) enrichment, paired-end, stranded, 76 bp reads',
    preservation: 'RNAlater, stored at -80 °C',
    submitted: '2023-07-25', released: '2024-04-03',
    publicationDoi: '10.1038/s41526-024-00380-w',
    // from the study description (the authors' statement, not computed here)
    statedSignificantGenes: 4422,
    resultsFile: 'GLDS-608_rna_seq_differential_expression_GLbulkRNAseq.csv',
    sourceFiles: ['s_OSD-635.txt', 'a_OSD-635_transcription-profiling_rna-sequencing-_rna-seq__illumina.txt', 'Investigation']
  };

  function count(group) { return SAMPLES.filter(function (s) { return s.group === group; }).length; }

  var api = {
    GROUPS: GROUPS, SAMPLES: SAMPLES, STUDY: STUDY, count: count,
    DOI_URL: 'https://doi.org/' + STUDY.publicationDoi
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Osd635 = api;
})(typeof window !== 'undefined' ? window : globalThis);
