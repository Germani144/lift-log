const dk = t => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const vol = a => a.reduce((t, x) => t + x.r, 0); // volume = total reps performed
let CAL = null;
function rCal(g) {
  const now = new Date();
  CAL ??= { y: now.getFullYear(), m: now.getMonth(), sel: null };
  const by = {};
  Object.keys(g).forEach(k => (by[dk(+k)] ??= []).push(k));
  const off = (new Date(CAL.y, CAL.m, 1).getDay() + 6) % 7,
    dim = new Date(CAL.y, CAL.m + 1, 0).getDate(),
    today = dk(Date.now()),
    pre = `${CAL.y}-${String(CAL.m + 1).padStart(2, '0')}-`;
  let cells =
      '<div class=wd>M</div><div class=wd>T</div><div class=wd>W</div><div class=wd>T</div><div class=wd>F</div><div class=wd>S</div><div class=wd>S</div>' +
      '<i></i>'.repeat(off),
    n = 0;
  for (let d = 1; d <= dim; d++) {
    const key = pre + String(d).padStart(2, '0'),
      has = by[key];
    if (has) n += has.length;
    cells += `<button class="cd${has ? ' tr' : ''}${key == today ? ' td' : ''}${key == CAL.sel ? ' sl' : ''}" data-a=calday data-k=${key}>${d}</button>`;
  }
  const label = new Date(CAL.y, CAL.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    cur = CAL.y == now.getFullYear() && CAL.m == now.getMonth();
  return (
    `<div class=card><div class=hd><button class=s style="width:44px" data-a=calnav data-d=-1 aria-label="Previous month">‹</button><b>${label}</b><button class=s style="width:44px" data-a=calnav data-d=1 aria-label="Next month">›</button></div>
 <div class=m style="text-align:center">${n} workout${n == 1 ? '' : 's'} this month${cur ? '' : ' · '}${cur ? '' : '<button class=lk data-a=caltoday>Today</button>'}</div><div class=cal>${cells}</div></div>` +
    rDay(g)
  );
}
function rDay(g) {
  if (!CAL.sel) return '<p class=m>Tap a highlighted day to see its workout.</p>';
  const label = new Date(CAL.sel + 'T12:00').toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    ks = Object.keys(g)
      .filter(k => dk(+k) == CAL.sel)
      .sort((a, b) => a - b);
  if (!ks.length) return `<div class=card><b>${label}</b><p class=m>No workout logged.</p></div>`;
  return ks
    .map(k => {
      const ss = g[k].slice().sort((a, b) => a.t - b.t),
        ids = [...new Set(ss.map(s => s.exId))];
      return (
        `<div class=card><div class=hd><b>${esc(ss[0].wn || 'Workout')}</b><span class=m>${label}</span></div><div class=m>${ids.length} exercise${ids.length == 1 ? '' : 's'} · ${ss.length} sets · volume ${vol(ss)} reps</div>` +
        ids
          .map(id => {
            const xs = ss.filter(s => s.exId == id);
            return (
              `<div style="margin-top:12px"><div class=hd><b>${esc(EX(id)?.name || 'Deleted exercise')}</b><span class=m>${vol(xs)} reps</span></div>` +
              xs
                .map(
                  (s, j) =>
                    `<div class=hl><span class=m>${s.wu ? 'Warm-up' : 'Set ' + xs.slice(0, j + 1).filter(y => !y.wu).length}</span><span>${wt(s.w)}${s.w > 0 ? ' kg' : ''} × ${s.r}${s.rir != null ? ` · RIR ${rirTxt(s.rir)}` : ''}${s.test ? ' ★' : ''}</span></div>`,
                )
                .join('') +
              `</div>`
            );
          })
          .join('') +
        (W && W.sess == k
          ? ''
          : `<button class=b data-a=wedOpen data-i=${k} style="margin-top:10px">Edit workout</button>`) +
        `</div>`
      );
    })
    .join('');
}

function rHist() {
  const g = {};
  S.sets.forEach(s => (g[s.sess] ??= []).push(s));
  const ks = Object.keys(g).sort((a, b) => b - a);
  return (
    ttl('History') +
    rCal(g) +
    `<h2 style="margin-top:22px">All workouts</h2>` +
    (ks
      .map(k => {
        const ss = g[k].sort((a, b) => a.t - b.t),
          ids = [...new Set(ss.map(s => s.exId))];
        return (
          `<div class=card><div class=hd><b>${esc(ss[0].wn || 'Workout')}</b><span class=m>${dstr(+k)} · ${vol(ss)} reps</span></div>` +
          ids
            .map(id => {
              const xs = ss.filter(s => s.exId == id);
              return `<div class=hl style="display:block"><div class=hd><b>${esc(EX(id)?.name || 'Deleted exercise')}</b><span class=m>${vol(xs)} reps</span></div><div class=m>${xs.map(s => `${wt(s.w)}×${s.r}${s.rir != null ? ' @' + rirTxt(s.rir) : ''}${s.test ? ' ★' : ''}`).join(' · ')}</div></div>`;
            })
            .join('') +
          `<div class=row>${W && W.sess == k ? '' : `<button class=b data-a=wedOpen data-i=${k}>Edit workout</button>`}<button class=b data-a=wdel data-i=${k}>Delete workout</button></div></div>`
        );
      })
      .join('') || '<p class=m>No workouts logged yet. Sets appear here as soon as you tap ✓.</p>')
  );
}

/* ---------- edit a past workout (from History) ---------- */
let WE = null,
  WQ = ''; // the workout being edited; its add-exercise search text
function wedOpen(sess) {
  const ss = S.sets.filter(s => s.sess == sess).sort((a, b) => a.t - b.t),
    items = [];
  for (const s of ss) {
    let it = items.find(i => i.exId == s.exId);
    if (!it) items.push((it = { exId: s.exId, rows: [] }));
    it.rows.push({ id: s.id, w: s.w > 0 ? s.w : '', r: s.r, rir: s.rir ?? '', wu: !!s.wu, src: s });
  }
  WE = { sess, wn: ss[0]?.wn || 'Workout', date: dk(sess), items };
  WQ = '';
  S.view = { t: 'wed' };
  render();
}
const wqBox = () => exSugg(WQ, null, e => `data-a=wedAdd data-x=${e.id}`, 'data-a=wedAddNew');
function rWed() {
  const row = (
    r,
    k,
    j,
  ) => `<div class="eset${r.wu ? ' wu' : ''}" data-k=${k} data-j=${j}><input data-wf=w inputmode=decimal aria-label="Weight in kg, empty for bodyweight" value="${r.w === '' ? '' : fmt(r.w)}"><input data-wf=r inputmode=numeric aria-label=Reps value="${r.r === '' ? '' : fmt(r.r)}">${rirSel(`data-wf=rir aria-label="Reps in reserve"`, r.rir)}<button class=s data-a=wedRm data-k=${k} data-j=${j} aria-label="Remove set">×</button>
  <div class=inf><span>${r.wu ? 'Warm-up' : ''}</span><button class=lk data-a=wedWu data-k=${k} data-j=${j}>${r.wu ? 'Make working set' : 'Mark as warm-up'}</button></div></div>`;
  return (
    `<div class=hd><button class=b data-a=wedCancel>Cancel</button><button class="b p" data-a=wedSave>Save</button></div><h2>Edit workout</h2>
 <div class=card><label>Name<input data-wn value="${esc(WE.wn)}"></label><label>Date<input type=date data-wd value="${WE.date}"></label></div>` +
    WE.items
      .map(
        (
          it,
          k,
        ) => `<div class=card><div class=hd><b>${esc(EX(it.exId)?.name || 'Deleted exercise')}</b><button class=s style="width:40px" data-a=wedRmx data-k=${k} aria-label="Remove exercise">×</button></div>
 <div class="eset hdr"><span>Weight (kg)</span><span>Reps</span><span>RIR</span><span></span></div>${it.rows.map((r, j) => row(r, k, j)).join('')}
 <button class=b data-a=wedAddSet data-k=${k}>+ Set</button></div>`,
      )
      .join('') +
    `<input id=wq placeholder="Add exercise: type a name" autocomplete=off enterkeyhint=done value="${esc(WQ)}" style="margin-top:12px"><div id=wqs>${wqBox()}</div>`
  );
}
async function wedSave() {
  for (const it of WE.items)
    for (const r of it.rows) {
      if (!(+r.r > 0))
        return toast(
          `Enter reps for every set of ${EX(it.exId)?.name || 'each exercise'}, or remove the set`,
        );
      if (r.rir !== '' && !(+r.rir >= 0 && +r.rir <= 10))
        return toast('RIR must be between 0 and 10, or empty');
    }
  const old = S.sets.filter(s => s.sess == WE.sess),
    o = new Date(WE.sess),
    [y, mo, da] = (WE.date || dk(WE.sess)).split('-').map(Number),
    sess = new Date(
      y,
      mo - 1,
      da,
      o.getHours(),
      o.getMinutes(),
      o.getSeconds(),
      o.getMilliseconds(),
    ).getTime(),
    dt = isFinite(sess) ? sess - WE.sess : 0,
    ns = WE.sess + dt,
    keep = new Set(WE.items.flatMap(i => i.rows.map(r => r.id).filter(Boolean))),
    pd = old.find(s => s.pd)?.pd,
    wn = WE.wn.trim().slice(0, 100) || 'Workout';
  let tmax = Math.max(ns, ...old.map(s => s.t + dt));
  for (const s of old) if (!keep.has(s.id)) await del('sets', s.id);
  for (const it of WE.items)
    for (const r of it.rows) {
      const rir = r.rir === '' ? null : +r.rir,
        rec = {
          ...(r.src || {}),
          exId: it.exId,
          sess: ns,
          wn,
          t: r.src ? r.src.t + dt : (tmax += 1000),
          w: +r.w || 0,
          r: Math.round(+r.r),
          rir,
          test: !r.wu && +r.r === 1 && rir === 0,
        };
      if (pd) rec.pd = pd;
      else delete rec.pd;
      if (r.wu) rec.wu = true;
      else delete rec.wu;
      await put('sets', rec);
    }
  WE = null;
  S.view = null;
  if (CAL) CAL.sel = dk(ns);
  await load();
  render();
  toast('Workout saved');
}
