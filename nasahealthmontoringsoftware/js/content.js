/*
 * content.js — structure of the explanatory content (which indicators / hazards belong to which region).
 * The visible TEXT lives in i18n.js (keys region.*, hazard.*, info.*, msg.*).
 *
 * STATUS: DRAFT. The explanatory texts (in i18n.js) are general, plain-language explanations written for the prototype.
 * They have NOT yet been verified against NASA Human Research Program sources.
 * The UI shows a "draft — not yet source-verified" badge next to them.
 *
 * Hazard names come from the challenge text (NASA HRP's five hazards of human spaceflight):
 * space radiation, isolation and confinement, distance from Earth, gravity fields,
 * hostile closed environments. The indicator -> hazard mapping below is a PROPOSED mapping.
 */
(function (root) {
  'use strict';

  // hazard keys -> i18n 'hazard.<key>'. The mapping is PROPOSED, not source-verified.
  var REGIONS = {
    mind:       { indicators: ['sleep', 'mood'],   hazards: ['isolation', 'closed'] },
    heart:      { indicators: ['hr', 'sys', 'dia'], hazards: ['gravity'] },
    metabolism: { indicators: ['glucose'],         hazards: ['nutrition'] },
    whole:      { indicators: ['temp'],            hazards: ['closed'] },
    bones:      { indicators: [],                  hazards: ['gravity'] },
    immune:     { indicators: [],                  hazards: ['radiation', 'isolation'] }
  };

  var api = { REGIONS: REGIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Content = api;
})(typeof window !== 'undefined' ? window : globalThis);
