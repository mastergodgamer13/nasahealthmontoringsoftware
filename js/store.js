/*
 * store.js — users and their entries (no DOM). Works in the browser (window.Store) and Node.
 *
 * Data model: { users: [{ id, name, entries: [ {date, hr, sys, ...} ], flight: [ {tp, glucose, ...} ] }], current: id|null }
 * flight = typed-in pre-/post-flight records, one per time point (rules live in osdr.js).
 * Everything stays in the browser (localStorage); nothing is sent anywhere.
 */
(function (root) {
  'use strict';

  var KEY = 'sa_users_v2';
  var LEGACY_KEY = 'sa_manual_entries_v1'; // single-user entries from the first prototype
  var MAX_USERS = 12;
  var NAME_MAX = 30;

  function create(storage, opts) {
    opts = opts || {};
    var key = opts.key || KEY;
    var state = { users: [], current: null };

    function persist() {
      try { storage.setItem(key, JSON.stringify(state)); } catch (e) { /* storage blocked: keep in memory */ }
    }
    function find(id) {
      for (var i = 0; i < state.users.length; i++) if (state.users[i].id === id) return state.users[i];
      return null;
    }
    function cleanFlight(r) {
      var o = { tp: r.tp };
      Object.keys(r).forEach(function (k) { if (k !== 'tp' && typeof r[k] === 'number' && isFinite(r[k])) o[k] = r[k]; });
      return o;
    }
    function cleanUser(u) {
      return {
        id: String(u.id),
        name: String(u.name).slice(0, NAME_MAX),
        entries: Array.isArray(u.entries) ? u.entries.filter(function (e) { return e && typeof e.date === 'string'; }) : [],
        flight: Array.isArray(u.flight) ? u.flight.filter(function (r) { return r && typeof r.tp === 'string'; }).map(cleanFlight) : []
      };
    }
    function nextId() {
      var max = 0;
      state.users.forEach(function (u) { var n = parseInt(String(u.id).replace(/^u/, ''), 10); if (n > max) max = n; });
      return 'u' + (max + 1);
    }

    function load() {
      var raw = null;
      try { raw = storage.getItem(key); } catch (e) { raw = null; }
      if (raw) {
        try {
          var p = JSON.parse(raw);
          if (p && Array.isArray(p.users)) {
            state.users = p.users.filter(function (u) { return u && u.id && u.name; }).map(cleanUser);
            state.current = find(p.current) ? p.current : (state.users.length ? state.users[0].id : null);
            return;
          }
        } catch (e) { /* corrupt data: start empty */ }
      }
      // one-time migration of the first prototype's single list of entries
      var legacy = null;
      try { legacy = storage.getItem(LEGACY_KEY); } catch (e) { legacy = null; }
      if (legacy && opts.legacyName) {
        try {
          var arr = JSON.parse(legacy);
          if (Array.isArray(arr) && arr.length) {
            state.users = [cleanUser({ id: 'u1', name: opts.legacyName, entries: arr })];
            state.current = 'u1';
            persist();
          }
        } catch (e) { /* ignore */ }
      }
    }

    function validateName(name) {
      var n = String(name === undefined || name === null ? '' : name).replace(/\s+/g, ' ').trim();
      if (!n) return { ok: false, code: 'empty' };
      if (n.length > NAME_MAX) n = n.slice(0, NAME_MAX);
      var low = n.toLowerCase();
      for (var i = 0; i < state.users.length; i++) if (state.users[i].name.toLowerCase() === low) return { ok: false, code: 'dup' };
      if (state.users.length >= MAX_USERS) return { ok: false, code: 'max', max: MAX_USERS };
      return { ok: true, name: n };
    }

    var api = {
      MAX_USERS: MAX_USERS, NAME_MAX: NAME_MAX,
      users: function () { return state.users.slice(); },
      current: function () { return state.current; },
      currentUser: function () { return find(state.current); },
      select: function (id) { if (!find(id)) return false; state.current = id; persist(); return true; },
      add: function (name) {
        var v = validateName(name);
        if (!v.ok) return v;
        var u = { id: nextId(), name: v.name, entries: [], flight: [] };
        state.users.push(u); state.current = u.id; persist();
        return { ok: true, user: u };
      },
      remove: function (id) {
        var u = find(id); if (!u) return false;
        state.users = state.users.filter(function (x) { return x.id !== id; });
        if (state.current === id) state.current = state.users.length ? state.users[0].id : null;
        persist(); return true;
      },
      entriesOf: function (id) { var u = find(id); return u ? u.entries : []; },
      saveEntry: function (id, entry) {
        var u = find(id); if (!u) return false;
        u.entries = u.entries.filter(function (e) { return e.date !== entry.date; }); // one entry per date
        u.entries.push(entry); persist(); return true;
      },
      clearEntries: function (id) { var u = find(id); if (!u) return false; u.entries = []; persist(); return true; },
      flightOf: function (id) { var u = find(id); return u ? u.flight : []; },
      saveFlight: function (id, rec) {
        var u = find(id); if (!u || !rec || typeof rec.tp !== 'string') return false;
        u.flight = u.flight.filter(function (r) { return r.tp !== rec.tp; }); // one record per time point
        u.flight.push(cleanFlight(rec)); persist(); return true;
      },
      clearFlight: function (id) { var u = find(id); if (!u) return false; u.flight = []; persist(); return true; }
    };
    load();
    return api;
  }

  var api = { create: create, KEY: KEY, LEGACY_KEY: LEGACY_KEY, MAX_USERS: MAX_USERS, NAME_MAX: NAME_MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Store = api;
})(typeof window !== 'undefined' ? window : globalThis);
