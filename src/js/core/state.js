/* ---------- state ---------- */
let state = { tab: 'train', view: null, ex: [], tpl: [], pr: {}, prl: [], hist: [] },
  draft = null,
  workout = null;
try {
  workout = JSON.parse(localStorage.getItem(LS_PREFIX + 'w') || 'null');
} catch {}
const saveWorkout = () => {
  try {
    localStorage.setItem(LS_PREFIX + 'w', JSON.stringify(workout));
  } catch {}
};
const exerciseById = id => state.ex.find(e => e.id == id);
async function loadState() {
  state.ex = await getAll('exercises');
  state.tpl = await getAll('templates');
  state.sets = await getAll('sets');
  state.pr = {};
  state.tpl.forEach(t => {
    if (!t.weeks) t.weeks = 8;
    if (!t.days) {
      t.days = [{ name: 'Day 1', items: t.items || [] }];
      delete t.items;
    }
    for (const d of t.days)
      for (const it of d.items) {
        if (!it.mode) it.mode = exerciseById(it.exId)?.mode == 'pct' ? 'pct' : 'rir';
        if (it.mode == 'pct' && !it.lines?.length) {
          it.lines = linesFromText(it.text);
          if (!it.lines.length) it.lines = [newPctLine()];
        }
      }
  });
  (await getAll('pr_history')).sort((a, b) => a.t - b.t).forEach(p => (state.pr[p.exId] = p));
} // latest tested PR per exercise

/* ---------- plan slots: each one is RIR (sets, rep range, target RIR) or % of 1RM (lines of sets x reps @ % with a target RPE) ---------- */
// Old plans stored % sets as text like "3*80%x5"; turn those into lines once.
function linesFromText(t) {
  const out = [];
  for (const l of String(t || '').split('\n')) {
    const m = l.trim().match(/^(?:(\d+)\s*[*×]\s*)?(\d+(?:\.\d+)?)%\s*x\s*(\d+)$/i);
    if (m) out.push({ n: +(m[1] || 1), p: +m[2], r: +m[3] });
  }
  return out;
}
const rememberTrackingMode = async (ex, m) => {
  if (ex && ex.mode != m) {
    ex.mode = m;
    await dbPut('exercises', ex);
  }
}; // new plan slots and quick adds start in the mode you used last
const newPctLine = () => ({ n: 3, r: 3, p: 75 });
// RIR slots: one target RIR per week of the plan.
const weeklyRirTargets = (it, weeks, ex) => {
  const a = Array.isArray(it.rirW) ? it.rirW.slice(0, weeks) : [],
    d = a.length ? a[a.length - 1] : (it.rir ?? ex?.rir ?? 2);
  while (a.length < weeks) a.push(d);
  return a;
};
async function addExerciseToWorkout(it, wk = 1) {
  const ex = exerciseById(it.exId);
  if (!ex) return;
  const pk = (a, b) => (a === '' || a == null ? b : a),
    mode = it.mode || (ex.mode == 'pct' ? 'pct' : 'rir'),
    lo = pk(it.lo, ex.lo) || 5,
    hi = pk(it.hi, ex.hi) || Math.max(lo, 8),
    rirT =
      Array.isArray(it.rirW) && it.rirW.length
        ? +it.rirW[Math.min(wk, it.rirW.length) - 1]
        : (pk(it.rir, ex.rir) ?? 2),
    item = { exId: ex.id, mode, lo, hi, rirT, rows: [], hint: '', bwo: bodyweightFor(ex) },
    g = await suggestSets({ ...ex, lo, hi, rir: rirT }, mode == 'pct' && it.lines?.length ? 0 : it.n || 3);
  item.hint = g.hint;
  if (mode == 'pct') {
    const ref = await reference1RM(ex);
    item.ref = ref?.w;
    item.refEst = ref?.est;
  }
  if (mode == 'pct' && it.lines?.length) {
    // planned % sets: the plan's %, nudged (max ±10%) by your recent trend at that rep count
    const ss = (await getAll('sets', 'ex', ex.id))
      .filter(s => !s.wu)
      .sort((a, b) => a.t - b.t)
      .map(s => withBodyweight(ex, s));
    let moved = 0;
    for (const l of it.lines) {
      const r = Math.max(1, Math.round(+l.r || 1)),
        f = strengthTrend(ss, r),
        wp = item.ref ? ((+l.p || 0) / 100) * item.ref : 0;
      if (f !== 1) moved = f;
      for (let k = 0; k < Math.max(1, Math.round(+l.n || 1)); k++)
        item.rows.push({ w: wp > 0 ? toLoadedWeight(ex, wp * f) : '', r, rir: '', pw: wp, auto: true });
    }
    const last = (item.hint || '').startsWith('Last:')
      ? item.hint.replace(/ · \d+–\d+ reps @ [\d.]+ RIR$/, '')
      : '';
    item.hint = [
      moved ? `${moved > 1 ? '+' : ''}${Math.round((moved - 1) * 100)}% vs plan from recent sessions` : '',
      last,
    ]
      .filter(Boolean)
      .join(' · ');
  } else item.rows = g.rows.map(r => ({ ...r, pw: (+r.w || 0) + item.bwo, auto: true }));
  if (!item.rows.length) item.rows.push({ w: '', r: '', rir: '' });
  const nw = Math.min(4, Math.max(0, Math.round(+ex.wu || 0)));
  if (nw) {
    const w0 = +item.rows[0].w || 0;
    item.rows.unshift(
      ...WARMUP_RAMP[nw].map(([p, r]) => ({
        w: w0 && ex.inc > 0 ? roundToStep(w0 * p, ex.inc) : '',
        r,
        rir: '',
        wu: true,
      })),
    );
  }
  workout.items.push(item);
}

async function startWorkout(tid, day = 0) {
  picker = null;
  showTrainHome = false;
  const t = tid ? state.tpl.find(x => x.id == tid) : null,
    dy = t && t.days[day];
  workout = {
    sess: Date.now(),
    name: dy ? `${t.name} · ${dy.name}` : 'Quick workout',
    pd: dy ? `${t.id}:${day}` : undefined,
    rest: +lsGet('rest') || 120,
    restEnd: 0,
    items: [],
  };
  if (dy) {
    const wk = planProgress(t).wk;
    for (const it of dy.items) await addExerciseToWorkout(it, wk);
  }
  saveWorkout();
  render();
}

function planProgress(t) {
  const dpw = t.days.length,
    seen = new Map();
  state.sets
    .filter(s => s.pd && s.pd.startsWith(t.id + ':') && s.sess >= t.runStart)
    .sort((a, b) => a.t - b.t)
    .forEach(s => {
      if (!seen.has(s.sess)) seen.set(s.sess, +s.pd.split(':')[1]);
    });
  const days = [...seen.values()],
    total = days.length,
    need = t.weeks * dpw;
  return {
    total,
    need,
    done: total >= need,
    wk: Math.min(Math.floor(total / dpw) + 1, t.weeks),
    wdays: new Set(days.slice(Math.floor(total / dpw) * dpw)),
    nx: total ? (days[total - 1] + 1) % dpw : 0,
  };
}
