function lastBackup() {
  try {
    return +localStorage.getItem(LSP + 'lb') || 0;
  } catch {
    return 0;
  }
}
/* ---------- backup ---------- */
const STORES = ['exercises', 'templates', 'pr_history', 'sets'];
async function exportData() {
  const d = { app: 'liftlog', v: 1, t: Date.now() };
  for (const n of STORES) d[n] = await all(n);
  d.bw = BWv() || undefined;
  d.ht = HTv() || undefined;
  const name = `liftlog-${new Date().toISOString().slice(0, 10)}.json`,
    f = new File([JSON.stringify(d)], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f] });
    else throw 0;
  } catch (e) {
    if (e && e.name == 'AbortError') return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = name;
    a.click();
  }
  try {
    localStorage.setItem(LSP + 'lb', Date.now());
  } catch {}
  toast('Backup exported');
  render();
}
/* ---------- import validation: rebuild every record from known fields only ---------- */
function clean(d) {
  const num = (x, k) => {
      if (typeof x != 'number' || !isFinite(x)) throw new Error('bad ' + k);
      return x;
    },
    opt = x => (typeof x == 'number' && isFinite(x) ? x : undefined),
    str = (x, k) => {
      if (typeof x != 'string' || x.length > 200) throw new Error('bad ' + k);
      return x;
    },
    arr = (o, n, max = 2e5) => {
      if (!Array.isArray(o[n]) || o[n].length > max) throw new Error('bad ' + n);
      return o[n];
    };
  return {
    t: opt(d.t) ?? Date.now(),
    bw: opt(d.bw),
    ht: opt(d.ht),
    exercises: arr(d, 'exercises').map(e => {
      if (!['rir', 'pct'].includes(e.mode)) throw new Error('bad mode');
      return {
        id: num(e.id, 'id'),
        name: str(e.name, 'name'),
        mode: e.mode,
        inc: num(e.inc, 'inc'),
        lo: opt(e.lo),
        hi: opt(e.hi),
        rir: opt(e.rir),
        pb: opt(e.pb),
        wu: opt(e.wu),
        bwl: e.bwl === true ? true : undefined,
      };
    }),
    templates: arr(d, 'templates').map(t => ({
      id: num(t.id, 'id'),
      name: str(t.name, 'name'),
      weeks: opt(t.weeks),
      active: t.active === true,
      runStart: opt(t.runStart),
      days: arr(Array.isArray(t.days) ? t : { days: [{ name: 'Day 1', items: t.items }] }, 'days', 14).map(
        y => ({
          name: str(y.name, 'name'),
          items: arr(y, 'items', 200).map(i => ({
            exId: num(i.exId, 'exId'),
            n: opt(i.n),
            lo: opt(i.lo),
            hi: opt(i.hi),
            rir: opt(i.rir),
            mode: i.mode == 'pct' ? 'pct' : i.mode == 'rir' ? 'rir' : undefined,
            lines: Array.isArray(i.lines)
              ? arr(i, 'lines', 20).map(l => ({ n: opt(l.n), r: opt(l.r), p: opt(l.p) }))
              : undefined,
            rirW: Array.isArray(i.rirW) ? arr(i, 'rirW', 60).map(v => opt(v) ?? 2) : undefined,
            text: typeof i.text == 'string' ? i.text.slice(0, 2000) : undefined,
          })),
        }),
      ),
    })),
    pr_history: arr(d, 'pr_history').map(p => ({
      id: num(p.id, 'id'),
      exId: num(p.exId, 'exId'),
      w: num(p.w, 'w'),
      t: num(p.t, 't'),
      setId: opt(p.setId),
    })),
    sets: arr(d, 'sets').map(s => ({
      id: num(s.id, 'id'),
      exId: num(s.exId, 'exId'),
      sess: num(s.sess, 'sess'),
      t: num(s.t, 't'),
      w: num(s.w, 'w'),
      r: num(s.r, 'r'),
      rir: s.rir == null ? null : num(s.rir, 'rir'),
      test: s.test === true,
      wu: s.wu === true ? true : undefined,
      bw: opt(s.bw),
      wn: typeof s.wn == 'string' ? s.wn.slice(0, 100) : undefined,
      pd: typeof s.pd == 'string' && /^\d+:\d+$/.test(s.pd) ? s.pd : undefined,
    })),
  };
}
async function importData(f) {
  if (!f) return;
  let d;
  try {
    d = JSON.parse(await f.text());
    if (d.app != 'liftlog' || !STORES.every(n => Array.isArray(d[n]))) throw 0;
  } catch {
    return toast('Not a Lift Log backup file');
  }
  await applyBackup(d);
}
async function applyBackup(d) {
  try {
    d = clean(d);
  } catch (e) {
    toast('Backup file is invalid (' + e.message + '). Nothing was changed.');
    return false;
  }
  if (
    !confirm(
      `Replace ALL current data with the backup from ${dstr(d.t)}? (${d.sets.length} sets, ${d.exercises.length} exercises)`,
    )
  )
    return false;
  for (const n of STORES) {
    await rq(st(n, 'readwrite').clear());
    for (const o of d[n]) await put(n, o);
  }
  if (d.bw > 0) ls('bw', d.bw);
  if (d.ht >= 100 && d.ht <= 250) ls('ht', d.ht);
  W = null;
  saveW();
  S.view = null;
  E = null;
  await load();
  render();
  toast('Backup restored');
  return true;
}

/* ---------- automatic backup to a private GitHub repo ---------- */
const ghCfg = () => {
  try {
    return JSON.parse(lg('gh') || 'null');
  } catch {
    return null;
  }
};
const ghUrl = g => `https://api.github.com/repos/${g.repo}/contents/liftlog-backup.json`;
const ghH = (g, a = 'application/vnd.github+json') => ({ Authorization: 'Bearer ' + g.token, Accept: a });
function touch() {
  ls('dirty', '1');
  clearTimeout(bt);
  bt = setTimeout(autoBackup, 15000);
}
let pq = Promise.resolve();
const ghPush = g =>
  (pq = pq
    .catch(() => {})
    .then(async () => {
      try {
        return await ghPush1(g);
      } catch (e) {
        if (/ 409| 422/.test(e.message)) return await ghPush1(g);
        throw e;
      }
    }));
async function ghPush1(g) {
  let sha;
  const r0 = await fetch(ghUrl(g), { headers: ghH(g), cache: 'no-store' });
  if (r0.ok) sha = (await r0.json()).sha;
  else if (r0.status != 404) throw new Error('GitHub error ' + r0.status);
  const d = { app: 'liftlog', v: 1, t: Date.now() };
  for (const n of STORES) d[n] = await all(n);
  d.bw = BWv() || undefined;
  d.ht = HTv() || undefined;
  const r = await fetch(ghUrl(g), {
    method: 'PUT',
    cache: 'no-store',
    headers: ghH(g),
    body: JSON.stringify({
      message: 'Lift Log backup',
      content: btoa(unescape(encodeURIComponent(JSON.stringify(d)))),
      sha,
    }),
  });
  if (!r.ok)
    throw new Error('GitHub error ' + r.status + (r.status == 422 ? ' (stale file version, try again)' : ''));
  ls('lb', Date.now());
  ls('dirty', '0');
  ls('gherr', '');
}
async function ghPull(g) {
  const r = await fetch(ghUrl(g), { headers: ghH(g, 'application/vnd.github.raw+json'), cache: 'no-store' });
  if (r.status == 404) return null;
  if (!r.ok) throw new Error('GitHub error ' + r.status);
  return JSON.parse(await r.text());
}
async function autoBackup() {
  const g = ghCfg();
  if (!g || !navigator.onLine || (!S.ex.length && !S.sets.length)) return;
  try {
    await ghPush(g);
  } catch (e) {
    ls('gherr', 'Last automatic backup failed: ' + e.message);
  }
  if (S.view?.t == 'set') render();
}
const DEFREPO = 'Germani144/lift-log-data';
function ghCard() {
  const g = ghCfg(),
    lb = lastBackup(),
    er = lg('gherr');
  return (
    `<div class=card><b>Automatic backup (GitHub)</b>` +
    (g
      ? `<div class=m>On → ${esc(g.repo)}. Saves a few seconds after each change${lb ? '. Last backup ' + age(lb) : ''}.</div>${er ? `<div class=wr>${esc(er)}</div>` : ''}<div class=row><button class=b data-a=ghNow>Back up now</button><button class=b data-a=ghRestore>Restore</button><button class=b data-a=ghOff>Turn off</button></div>`
      : `<div class=m>Use a <b>private</b> repo just for backups and a fine-grained token limited to that repo with Contents: read and write. Don't use your Pages repo.</div><form id=ghf><input name=username autocomplete=username value="${esc(DEFREPO)}" hidden><label>Repo<input id=ghr value="${esc(DEFREPO)}" autocapitalize=off></label><label>Token<input id=ght name=password type=password autocomplete=current-password></label><button class="b p" type=submit>Turn on</button></form>`) +
    `</div>`
  );
}
Object.assign(A, {
  ghSave: async () => {
    const repo = $('#ghr').value.trim(),
      token = $('#ght').value.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) return toast('Enter the repo as owner/name and a token');
    const g = { repo, token };
    try {
      const empty = !S.ex.length && !S.sets.length,
        rem = empty ? await ghPull(g) : null;
      ls('gh', JSON.stringify(g));
      if (rem) await applyBackup(rem);
      else if (!empty) await ghPush(g);
      toast('Automatic backup is on');
      render();
    } catch (e) {
      toast(e.message + '. Check the repo name and token permissions.');
    }
  },
  ghNow: async () => {
    try {
      await ghPush(ghCfg());
      toast('Backed up');
    } catch (e) {
      ls('gherr', 'Last automatic backup failed: ' + e.message);
      toast(e.message);
    }
    render();
  },
  ghRestore: async () => {
    try {
      const d = await ghPull(ghCfg());
      d ? await applyBackup(d) : toast('No backup found in that repo');
    } catch (e) {
      toast(e.message);
    }
  },
  ghOff: () => {
    ls('gh', '');
    render();
  },
});
addEventListener('online', () => ghCfg() && autoBackup());
