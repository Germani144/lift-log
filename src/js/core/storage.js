/* All of Germani144's apps share this origin's localStorage, so every Lift Log key starts with "lift-log:".
   Old unprefixed keys are moved once. Keys whose content proves they're Lift Log's (workout in progress, backup
   settings) are removed afterwards; generic ones (rest, bw, lb, dirty) are copied only if they look valid, and
   left in place because another app might own a key with the same name. */
const LSP = 'lift-log:';
(() => {
  try {
    const L = localStorage,
      J = v => {
        try {
          return JSON.parse(v);
        } catch {
          return null;
        }
      },
      num = (a, b) => v => +v >= a && +v <= b;
    const sure = {
        w: v => {
          const o = J(v);
          return !!(o && Array.isArray(o.items) && o.sess > 0);
        },
        gh: v => {
          const o = J(v);
          return !!(o && o.token && /lift-log/i.test(o.repo || ''));
        },
        gherr: v => /^Last automatic backup failed/.test(v),
      },
      looks = {
        rest: num(15, 1800),
        bw: num(20, 400),
        ht: num(100, 250),
        lb: num(1.5e12, 4e12),
        dirty: v => v == '0' || v == '1',
      };
    for (const k of [...Object.keys(sure), ...Object.keys(looks)]) {
      const v = L.getItem(k);
      if (v == null || L.getItem(LSP + k) != null) continue;
      if (sure[k]) {
        if (sure[k](v)) {
          L.setItem(LSP + k, v);
          L.removeItem(k);
        }
      } else if (looks[k](v)) L.setItem(LSP + k, v);
    }
  } catch {}
})();
let bt;
const ls = (k, v) => {
  try {
    localStorage.setItem(LSP + k, v);
  } catch {}
};
const lg = k => {
  try {
    return localStorage.getItem(LSP + k);
  } catch {
    return null;
  }
};
/* ---------- IndexedDB ---------- */
let db;
const open = () =>
  new Promise((res, rej) => {
    const r = indexedDB.open('liftlog', 1);
    r.onupgradeneeded = () => {
      const d = r.result,
        o = { keyPath: 'id', autoIncrement: true };
      d.createObjectStore('exercises', o);
      d.createObjectStore('templates', o);
      d.createObjectStore('pr_history', o).createIndex('ex', 'exId');
      d.createObjectStore('sets', o).createIndex('ex', 'exId');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const rq = r =>
  new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const st = (n, m = 'readonly') => db.transaction(n, m).objectStore(n);
const all = (n, ix, k) =>
  rq(ix ? st(n).index(ix).getAll(k) : st(n).getAll()).then(a =>
    n == 'sets' ? a.map(s => (s.rir > 10 ? { ...s, rir: null } : s)) : a,
  ); // RIR above 10 is treated as 'not tracked'
const put = (n, o) => (touch(), rq(st(n, 'readwrite').put(o)));
const del = (n, id) => (touch(), rq(st(n, 'readwrite').delete(id)));
