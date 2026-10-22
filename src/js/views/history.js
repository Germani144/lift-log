/* History tab: month calendar, every workout, and editing a past workout. */

const dayKey = t => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const totalReps = a => a.reduce((t, x) => t + x.r, 0); // volume = total reps performed
let calendar = null;
function renderCalendar(g) {
  const now = new Date();
  calendar ??= { y: now.getFullYear(), m: now.getMonth(), sel: null };
  const by = {};
  Object.keys(g).forEach(k => (by[dayKey(+k)] ??= []).push(k));
  const off = (new Date(calendar.y, calendar.m, 1).getDay() + 6) % 7,
    dim = new Date(calendar.y, calendar.m + 1, 0).getDate(),
    today = dayKey(Date.now()),
    pre = `${calendar.y}-${String(calendar.m + 1).padStart(2, '0')}-`;
  let cells =
      '<div class=wd>M</div><div class=wd>T</div><div class=wd>W</div><div class=wd>T</div><div class=wd>F</div><div class=wd>S</div><div class=wd>S</div>' +
      '<i></i>'.repeat(off),
    n = 0;
  for (let d = 1; d <= dim; d++) {
    const key = pre + String(d).padStart(2, '0'),
      has = by[key];
    if (has) n += has.length;
    cells += `<button class="cd${has ? ' tr' : ''}${key == today ? ' td' : ''}${key == calendar.sel ? ' sl' : ''}" data-a=calday data-k=${key}>${d}</button>`;
  }
  const label = new Date(calendar.y, calendar.m, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    }),
    cur = calendar.y == now.getFullYear() && calendar.m == now.getMonth();
  return (
    `<div class=card><div class=hd><button class=s style="width:44px" data-a=calnav data-d=-1 aria-label="Previous month">‹</button><b>${label}</b><button class=s style="width:44px" data-a=calnav data-d=1 aria-label="Next month">›</button></div>
 <div class=m style="text-align:center">${n} workout${n == 1 ? '' : 's'} this month${cur ? '' : ' · '}${cur ? '' : '<button class=lk data-a=caltoday>Today</button>'}</div><div class=cal>${cells}</div></div>` +
    renderDay(g)
  );
}
function renderDay(g) {
  if (!calendar.sel) return '<p class=m>Tap a highlighted day to see its workout.</p>';
  const label = new Date(calendar.sel + 'T12:00').toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    ks = Object.keys(g)
      .filter(k => dayKey(+k) == calendar.sel)
      .sort((a, b) => a - b);
  if (!ks.length) return `<div class=card><b>${label}</b><p class=m>No workout logged.</p></div>`;
  return ks
    .map(k => {
      const ss = g[k].slice().sort((a, b) => a.t - b.t),
        ids = [...new Set(ss.map(s => s.exId))];
      return (
        `<div class=card><div class=hd><b>${esc(ss[0].wn || 'Workout')}</b><span class=m>${label}</span></div><div class=m>${ids.length} exercise${ids.length == 1 ? '' : 's'} · ${ss.length} sets · volume ${totalReps(ss)} reps</div>` +
        ids
          .map(id => {
            const xs = ss.filter(s => s.exId == id);
            return (
              `<div style="margin-top:12px"><div class=hd><b>${esc(exerciseById(id)?.name || 'Deleted exercise')}</b><span class=m>${totalReps(xs)} reps</span></div>` +
              xs
                .map(
                  (s, j) =>
                    `<div class=hl><span class=m>${s.wu ? 'Warm-up' : 'Set ' + xs.slice(0, j + 1).filter(y => !y.wu).length}</span><span>${weightLabel(s.w)}${s.w > 0 ? ' kg' : ''} × ${s.r}${s.rir != null ? ` · RIR ${rirLabel(s.rir)}` : ''}${s.test ? ' ★' : ''}</span></div>`,
                )
                .join('') +
              `</div>`
            );
          })
          .join('') +
        (workout && workout.sess == k
          ? ''
          : `<button class=b data-a=wedOpen data-i=${k} style="margin-top:10px">Edit workout</button>`) +
        `</div>`
      );
    })
    .join('');
}

function renderHistory() {
  const g = {};
  state.sets.forEach(s => (g[s.sess] ??= []).push(s));
  const ks = Object.keys(g).sort((a, b) => b - a);
  return (
    pageTitle('History') +
    renderCalendar(g) +
    `<h2 style="margin-top:22px">All workouts</h2>` +
    (ks
      .map(k => {
        const ss = g[k].sort((a, b) => a.t - b.t),
          ids = [...new Set(ss.map(s => s.exId))];
        return (
          `<div class=card><div class=hd><b>${esc(ss[0].wn || 'Workout')}</b><span class=m>${dateText(+k)} · ${totalReps(ss)} reps</span></div>` +
          ids
            .map(id => {
              const xs = ss.filter(s => s.exId == id);
              return `<div class=hl style="display:block"><div class=hd><b>${esc(exerciseById(id)?.name || 'Deleted exercise')}</b><span class=m>${totalReps(xs)} reps</span></div><div class=m>${xs.map(s => `${weightLabel(s.w)}×${s.r}${s.rir != null ? ' @' + rirLabel(s.rir) : ''}${s.test ? ' ★' : ''}`).join(' · ')}</div></div>`;
            })
            .join('') +
          `<div class=row>${workout && workout.sess == k ? '' : `<button class=b data-a=wedOpen data-i=${k}>Edit workout</button>`}<button class=b data-a=wdel data-i=${k}>Delete workout</button></div></div>`
        );
      })
      .join('') || '<p class=m>No workouts logged yet. Sets appear here as soon as you tap ✓.</p>')
  );
}

/* ---------- edit a past workout (from History) ---------- */
let editedWorkout = null,
  editorAddQuery = ''; // the workout being edited; its add-exercise search text
function openWorkoutEditor(sess) {
  const ss = state.sets.filter(s => s.sess == sess).sort((a, b) => a.t - b.t),
    items = [];
  for (const s of ss) {
    let it = items.find(i => i.exId == s.exId);
    if (!it) items.push((it = { exId: s.exId, rows: [] }));
    it.rows.push({ id: s.id, w: s.w > 0 ? s.w : '', r: s.r, rir: s.rir ?? '', wu: !!s.wu, src: s });
  }
  editedWorkout = { sess, wn: ss[0]?.wn || 'Workout', date: dayKey(sess), items };
  editorAddQuery = '';
  state.view = { t: 'wed' };
  render();
}
const editorAddResults = () =>
  exerciseSuggestions(editorAddQuery, null, e => `data-a=wedAdd data-x=${e.id}`, 'data-a=wedAddNew');
function renderWorkoutEditor() {
  const row = (
    r,
    k,
    j,
  ) => `<div class="eset${r.wu ? ' wu' : ''}" data-k=${k} data-j=${j}><input data-wf=w inputmode=decimal aria-label="Weight in kg, empty for bodyweight" value="${r.w === '' ? '' : fmt(r.w)}"><input data-wf=r inputmode=numeric aria-label=Reps value="${r.r === '' ? '' : fmt(r.r)}">${rirSelect(`data-wf=rir aria-label="Reps in reserve"`, r.rir)}<button class=s data-a=wedRm data-k=${k} data-j=${j} aria-label="Remove set">×</button>
  <div class=inf><span>${r.wu ? 'Warm-up' : ''}</span><button class=lk data-a=wedWu data-k=${k} data-j=${j}>${r.wu ? 'Make working set' : 'Mark as warm-up'}</button></div></div>`;
  return (
    `<div class=hd><button class=b data-a=wedCancel>Cancel</button><button class="b p" data-a=wedSave>Save</button></div><h2>Edit workout</h2>
 <div class=card><label>Name<input data-wn value="${esc(editedWorkout.wn)}"></label><label>Date<input type=date data-wd value="${editedWorkout.date}"></label></div>` +
    editedWorkout.items
      .map(
        (
          it,
          k,
        ) => `<div class=card><div class=hd><b>${esc(exerciseById(it.exId)?.name || 'Deleted exercise')}</b><button class=s style="width:40px" data-a=wedRmx data-k=${k} aria-label="Remove exercise">×</button></div>
 <div class="eset hdr"><span>Weight (kg)</span><span>Reps</span><span>RIR</span><span></span></div>${it.rows.map((r, j) => row(r, k, j)).join('')}
 <button class=b data-a=wedAddSet data-k=${k}>+ Set</button></div>`,
      )
      .join('') +
    `<input id=wq placeholder="Add exercise: type a name" autocomplete=off enterkeyhint=done value="${esc(editorAddQuery)}" style="margin-top:12px"><div id=wqs>${editorAddResults()}</div>`
  );
}
async function saveEditedWorkout() {
  for (const it of editedWorkout.items)
    for (const r of it.rows) {
      if (!(+r.r > 0))
        return toast(
          `Enter reps for every set of ${exerciseById(it.exId)?.name || 'each exercise'}, or remove the set`,
        );
      if (r.rir !== '' && !(+r.rir >= 0 && +r.rir <= 10))
        return toast('RIR must be between 0 and 10, or empty');
    }
  const old = state.sets.filter(s => s.sess == editedWorkout.sess),
    o = new Date(editedWorkout.sess),
    [y, mo, da] = (editedWorkout.date || dayKey(editedWorkout.sess)).split('-').map(Number),
    sess = new Date(
      y,
      mo - 1,
      da,
      o.getHours(),
      o.getMinutes(),
      o.getSeconds(),
      o.getMilliseconds(),
    ).getTime(),
    dt = isFinite(sess) ? sess - editedWorkout.sess : 0,
    ns = editedWorkout.sess + dt,
    keep = new Set(editedWorkout.items.flatMap(i => i.rows.map(r => r.id).filter(Boolean))),
    pd = old.find(s => s.pd)?.pd,
    wn = editedWorkout.wn.trim().slice(0, 100) || 'Workout';
  let tmax = Math.max(ns, ...old.map(s => s.t + dt));
  for (const s of old) if (!keep.has(s.id)) await dbDelete('sets', s.id);
  for (const it of editedWorkout.items)
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
      await dbPut('sets', rec);
    }
  editedWorkout = null;
  state.view = null;
  if (calendar) calendar.sel = dayKey(ns);
  await loadState();
  render();
  toast('Workout saved');
}
