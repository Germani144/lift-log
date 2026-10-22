function lastBackupTime() {
  try {
    return +localStorage.getItem(LS_PREFIX + 'lb') || 0;
  } catch {
    return 0;
  }
}
/* ---------- backup ---------- */
const STORES = ['exercises', 'templates', 'pr_history', 'sets'];
async function exportData() {
  const d = { app: 'liftlog', v: 1, t: Date.now() };
  for (const n of STORES) d[n] = await getAll(n);
  d.bw = bodyweight() || undefined;
  d.ht = height() || undefined;
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
    localStorage.setItem(LS_PREFIX + 'lb', Date.now());
  } catch {}
  toast('Backup exported');
  render();
}
/* ---------- import validation: rebuild every record from known fields only ---------- */
function sanitizeBackup(d) {
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
    d = sanitizeBackup(d);
  } catch (e) {
    toast('Backup file is invalid (' + e.message + '). Nothing was changed.');
    return false;
  }
  if (
    !confirm(
      `Replace ALL current data with the backup from ${dateText(d.t)}? (${d.sets.length} sets, ${d.exercises.length} exercises)`,
    )
  )
    return false;
  for (const n of STORES) {
    await request(store(n, 'readwrite').clear());
    for (const o of d[n]) await dbPut(n, o);
  }
  if (d.bw > 0) lsSet('bw', d.bw);
  if (d.ht >= 100 && d.ht <= 250) lsSet('ht', d.ht);
  workout = null;
  saveWorkout();
  state.view = null;
  draft = null;
  await loadState();
  render();
  toast('Backup restored');
  return true;
}

/* ---------- automatic backup to a private GitHub repo ---------- */
const githubConfig = () => {
  try {
    return JSON.parse(lsGet('gh') || 'null');
  } catch {
    return null;
  }
};
const githubFileUrl = g => `https://api.github.com/repos/${g.repo}/contents/liftlog-backup.json`;
const githubHeaders = (g, a = 'application/vnd.github+json') => ({
  Authorization: 'Bearer ' + g.token,
  Accept: a,
});
function markDataChanged() {
  lsSet('dirty', '1');
  clearTimeout(backupTimer);
  backupTimer = setTimeout(autoBackup, 15000);
}
let pushQueue = Promise.resolve();
const githubPush = g =>
  (pushQueue = pushQueue
    .catch(() => {})
    .then(async () => {
      try {
        return await githubPushOnce(g);
      } catch (e) {
        if (/ 409| 422/.test(e.message)) return await githubPushOnce(g);
        throw e;
      }
    }));
async function githubPushOnce(g) {
  let sha;
  const r0 = await fetch(githubFileUrl(g), { headers: githubHeaders(g), cache: 'no-store' });
  if (r0.ok) sha = (await r0.json()).sha;
  else if (r0.status != 404) throw new Error('GitHub error ' + r0.status);
  const d = { app: 'liftlog', v: 1, t: Date.now() };
  for (const n of STORES) d[n] = await getAll(n);
  d.bw = bodyweight() || undefined;
  d.ht = height() || undefined;
  const r = await fetch(githubFileUrl(g), {
    method: 'PUT',
    cache: 'no-store',
    headers: githubHeaders(g),
    body: JSON.stringify({
      message: 'Lift Log backup',
      content: btoa(unescape(encodeURIComponent(JSON.stringify(d)))),
      sha,
    }),
  });
  if (!r.ok)
    throw new Error('GitHub error ' + r.status + (r.status == 422 ? ' (stale file version, try again)' : ''));
  lsSet('lb', Date.now());
  lsSet('dirty', '0');
  lsSet('gherr', '');
}
async function githubPull(g) {
  const r = await fetch(githubFileUrl(g), {
    headers: githubHeaders(g, 'application/vnd.github.raw+json'),
    cache: 'no-store',
  });
  if (r.status == 404) return null;
  if (!r.ok) throw new Error('GitHub error ' + r.status);
  return JSON.parse(await r.text());
}
async function autoBackup() {
  const g = githubConfig();
  if (!g || !navigator.onLine || (!state.ex.length && !state.sets.length)) return;
  try {
    await githubPush(g);
  } catch (e) {
    lsSet('gherr', 'Last automatic backup failed: ' + e.message);
  }
  if (state.view?.t == 'set') render();
}
const DEFAULT_BACKUP_REPO = 'Germani144/lift-log-data';
function githubBackupCard() {
  const g = githubConfig(),
    lb = lastBackupTime(),
    er = lsGet('gherr');
  return (
    `<div class=card><b>Automatic backup (GitHub)</b>` +
    (g
      ? `<div class=m>On → ${esc(g.repo)}. Saves a few seconds after each change${lb ? '. Last backup ' + ageText(lb) : ''}.</div>${er ? `<div class=wr>${esc(er)}</div>` : ''}<div class=row><button class=b data-a=ghNow>Back up now</button><button class=b data-a=ghRestore>Restore</button><button class=b data-a=ghOff>Turn off</button></div>`
      : `<div class=m>Use a <b>private</b> repo just for backups and a fine-grained token limited to that repo with Contents: read and write. Don't use your Pages repo.</div><form id=ghf><input name=username autocomplete=username value="${esc(DEFAULT_BACKUP_REPO)}" hidden><label>Repo<input id=ghr value="${esc(DEFAULT_BACKUP_REPO)}" autocapitalize=off></label><label>Token<input id=ght name=password type=password autocomplete=current-password></label><button class="b p" type=submit>Turn on</button></form>`) +
    `</div>`
  );
}
Object.assign(actions, {
  ghSave: async () => {
    const repo = $('#ghr').value.trim(),
      token = $('#ght').value.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) return toast('Enter the repo as owner/name and a token');
    const g = { repo, token };
    try {
      const empty = !state.ex.length && !state.sets.length,
        rem = empty ? await githubPull(g) : null;
      lsSet('gh', JSON.stringify(g));
      if (rem) await applyBackup(rem);
      else if (!empty) await githubPush(g);
      toast('Automatic backup is on');
      render();
    } catch (e) {
      toast(e.message + '. Check the repo name and token permissions.');
    }
  },
  ghNow: async () => {
    try {
      await githubPush(githubConfig());
      toast('Backed up');
    } catch (e) {
      lsSet('gherr', 'Last automatic backup failed: ' + e.message);
      toast(e.message);
    }
    render();
  },
  ghRestore: async () => {
    try {
      const d = await githubPull(githubConfig());
      d ? await applyBackup(d) : toast('No backup found in that repo');
    } catch (e) {
      toast(e.message);
    }
  },
  ghOff: () => {
    lsSet('gh', '');
    render();
  },
});
addEventListener('online', () => githubConfig() && autoBackup());
