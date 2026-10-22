/* Where data lives.
 *   localStorage: small settings and the workout in progress, every key prefixed "lift-log:".
 *   IndexedDB (database "liftlog"): exercises, plans ("templates"), tested 1RMs ("pr_history") and logged sets. */

/* ---------- localStorage ----------
   Other apps may share this origin's localStorage, so every Lift Log key starts with "lift-log:".
   Old unprefixed keys are moved once. Keys whose content proves they're Lift Log's (workout in progress, backup
   settings) are removed afterwards; generic ones (rest, bw, ht, lb, dirty) are copied only if they look valid, and
   left in place because another app might own a key with the same name. */
const LS_PREFIX = 'lift-log:';
(() => {
  try {
    const L = localStorage,
      parse = v => {
        try {
          return JSON.parse(v);
        } catch {
          return null;
        }
      },
      between = (lo, hi) => v => +v >= lo && +v <= hi;
    const surelyOurs = {
        w: v => {
          const o = parse(v);
          return !!(o && Array.isArray(o.items) && o.sess > 0);
        },
        gh: v => {
          const o = parse(v);
          return !!(o && o.token && /lift-log/i.test(o.repo || ''));
        },
        gherr: v => /^Last automatic backup failed/.test(v),
      },
      looksValid = {
        rest: between(15, 1800),
        bw: between(20, 400),
        ht: between(100, 250),
        lb: between(1.5e12, 4e12),
        dirty: v => v == '0' || v == '1',
      };
    for (const k of [...Object.keys(surelyOurs), ...Object.keys(looksValid)]) {
      const v = L.getItem(k);
      if (v == null || L.getItem(LS_PREFIX + k) != null) continue;
      if (surelyOurs[k]) {
        if (surelyOurs[k](v)) {
          L.setItem(LS_PREFIX + k, v);
          L.removeItem(k);
        }
      } else if (looksValid[k](v)) L.setItem(LS_PREFIX + k, v);
    }
  } catch {}
})();

const lsSet = (k, v) => {
  try {
    localStorage.setItem(LS_PREFIX + k, v);
  } catch {}
};
const lsGet = k => {
  try {
    return localStorage.getItem(LS_PREFIX + k);
  } catch {
    return null;
  }
};

// Settings: your bodyweight (kg) and height (cm); 0 when not set.
const bodyweight = () => +lsGet('bw') || 0,
  height = () => +lsGet('ht') || 0;

/* ---------- IndexedDB ---------- */
let db;
const openDatabase = () =>
  new Promise((resolve, reject) => {
    const r = indexedDB.open('liftlog', 1);
    r.onupgradeneeded = () => {
      const d = r.result,
        keys = { keyPath: 'id', autoIncrement: true };
      d.createObjectStore('exercises', keys);
      d.createObjectStore('templates', keys);
      d.createObjectStore('pr_history', keys).createIndex('ex', 'exId');
      d.createObjectStore('sets', keys).createIndex('ex', 'exId');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
const request = r =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
const store = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);
// Everything in a store, or (with an index) everything matching a key, e.g. getAll('sets', 'ex', exerciseId).
// A set's RIR above 10 is treated as "not tracked".
const getAll = (name, index, key) =>
  request(index ? store(name).index(index).getAll(key) : store(name).getAll()).then(a =>
    name == 'sets' ? a.map(s => (s.rir > 10 ? { ...s, rir: null } : s)) : a,
  );
// Every change marks the data as changed, which schedules an automatic backup (backup.js).
const dbPut = (name, o) => (markDataChanged(), request(store(name, 'readwrite').put(o)));
const dbDelete = (name, id) => (markDataChanged(), request(store(name, 'readwrite').delete(id)));
