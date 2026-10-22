/* App state, loading data, plans, and building a workout.
 *
 * Data model (field names are short because they're stored on the phone and in backups; don't rename them)
 *   exercise   { id, name, mode: 'rir'|'pct' (last used), inc: weight step (0 = bodyweight only),
 *                lo, hi: rep range and rir: target RIR for quick workouts, wu: warm-up sets (0–4),
 *                pb: lifetime best kg, bwl: true if the load includes bodyweight }
 *   set        { id, exId, sess: workout id (its start time), t: time logged, w: kg, r: reps, rir: RIR or null,
 *                test: 1-rep max test, wu: warm-up, bw: bodyweight then, wn: workout name, pd: 'planId:dayIndex' }
 *   pr_history { id, exId, w: tested 1RM in kg, t: date, setId }   (the latest one is your current 1RM)
 *   template   a plan: { id, name, weeks, active, runStart, days: [{ name, items: [slot] }] }
 *     slot     RIR:  { exId, mode: 'rir', n: sets, lo, hi, rirW: [target RIR for week 1, week 2, …] }
 *              %1RM: { exId, mode: 'pct', lines: [{ n: sets, r: reps, p: % of 1RM }] }
 *   workout    the workout in progress (kept in localStorage):
 *              { sess, name, pd, rest: rest seconds, restEnd: when the timer ends, items: [item] }
 *     item     one exercise: { exId, mode, lo, hi, rirT: target RIR, rows: [row], hint, bwo: bodyweight added,
 *                ref: reference 1RM for % view, refEst: true if ref is an estimate }
 *     row      one set: { w, r, rir, pw: planned weight (total load), auto: untouched by you, done, id: logged set,
 *                wu: warm-up, adj: adjusted after an earlier set }
 */

// state.tab: the bottom-bar tab. state.view: a page open on top of it ({ t: 'exd' | 'tple' | 'wed' | 'set' }).
// state.prl / state.hist: tested 1RMs and logged sets of the exercise whose page is open.
let state = { tab: 'train', view: null, ex: [], tpl: [], pr: {}, prl: [], hist: [] },
  draft = null, // a copy of the exercise or plan being edited, saved only when you tap Save
  workout = null; // the workout in progress (see the data model above)
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
  state.tpl.forEach(upgradeOldPlan);
  // state.pr[exerciseId] = the latest tested 1RM
  (await getAll('pr_history')).sort((a, b) => a.t - b.t).forEach(p => (state.pr[p.exId] = p));
}

/* ---------- Plans ---------- */

// Older versions stored plans differently; bring them up to date in memory (saved on the next Save).
function upgradeOldPlan(t) {
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
}

// Old plans stored % sets as text like "3*80%x5"; turn those into lines.
function linesFromText(text) {
  const out = [];
  for (const l of String(text || '').split('\n')) {
    const m = l.trim().match(/^(?:(\d+)\s*[*×]\s*)?(\d+(?:\.\d+)?)%\s*x\s*(\d+)$/i);
    if (m) out.push({ n: +(m[1] || 1), p: +m[2], r: +m[3] });
  }
  return out;
}

// New plan slots and quick adds start in the tracking mode you used last for that exercise.
const rememberTrackingMode = async (ex, mode) => {
  if (ex && ex.mode != mode) {
    ex.mode = mode;
    await dbPut('exercises', ex);
  }
};
const newPctLine = () => ({ n: 3, r: 3, p: 75 });

// A RIR slot's target RIR for each week of the plan, padded with the last value (or the default).
const weeklyRirTargets = (it, weeks, ex) => {
  const targets = Array.isArray(it.rirW) ? it.rirW.slice(0, weeks) : [],
    fill = targets.length ? targets[targets.length - 1] : (it.rir ?? ex?.rir ?? 2);
  while (targets.length < weeks) targets.push(fill);
  return targets;
};

/* Where you are in a plan, counted from the workouts logged since you started it.
   { total: plan days done, need: total days in the plan, done, wk: current week,
     wdays: day indexes done this week, nx: index of the next day } */
function planProgress(t) {
  const daysPerWeek = t.days.length,
    dayOfSession = new Map();
  state.sets
    .filter(s => s.pd && s.pd.startsWith(t.id + ':') && s.sess >= t.runStart)
    .sort((a, b) => a.t - b.t)
    .forEach(s => {
      if (!dayOfSession.has(s.sess)) dayOfSession.set(s.sess, +s.pd.split(':')[1]);
    });
  const days = [...dayOfSession.values()],
    total = days.length,
    need = t.weeks * daysPerWeek,
    weeksDone = Math.floor(total / daysPerWeek);
  return {
    total,
    need,
    done: total >= need,
    wk: Math.min(weeksDone + 1, t.weeks),
    wdays: new Set(days.slice(weeksDone * daysPerWeek)),
    nx: total ? (days[total - 1] + 1) % daysPerWeek : 0,
  };
}

/* ---------- Building a workout ---------- */

// The 1RM % sets are based on, for an exercise (see reference1RM in training.js).
async function loadReference1RM(ex) {
  return reference1RM(ex, state.pr[ex.id], await getAll('sets', 'ex', ex.id));
}

/* Add an exercise to the workout in progress, with its sets filled in.
   `slot` is a plan slot (or { exId, n } for a quick add); `week` is the plan week, which picks the target RIR.
   RIR slots get suggested weight and reps. % slots get the plan's % of your reference 1RM, nudged (max ±10%)
   by how strong you've been lately at that rep count. Warm-ups, if the exercise has them, go first. */
async function addExerciseToWorkout(slot, week = 1) {
  const ex = exerciseById(slot.exId);
  if (!ex) return;
  const orDefault = (value, fallback) => (value === '' || value == null ? fallback : value),
    mode = slot.mode || (ex.mode == 'pct' ? 'pct' : 'rir'),
    lo = orDefault(slot.lo, ex.lo) || 5,
    hi = orDefault(slot.hi, ex.hi) || Math.max(lo, 8),
    targetRir =
      Array.isArray(slot.rirW) && slot.rirW.length
        ? +slot.rirW[Math.min(week, slot.rirW.length) - 1]
        : (orDefault(slot.rir, ex.rir) ?? 2),
    plannedPct = mode == 'pct' && slot.lines?.length,
    item = { exId: ex.id, mode, lo, hi, rirT: targetRir, rows: [], hint: '', bwo: bodyweightFor(ex) },
    suggestion = suggestSets(
      { ...ex, lo, hi, rir: targetRir },
      plannedPct ? 0 : slot.n || 3,
      await getAll('sets', 'ex', ex.id),
    );
  item.hint = suggestion.hint;
  if (mode == 'pct') {
    const ref = await loadReference1RM(ex);
    item.ref = ref?.w;
    item.refEst = ref?.est;
  }

  if (plannedPct) {
    const history = sortedHistory(await getAll('sets', 'ex', ex.id)).map(s => withBodyweight(ex, s));
    let nudge = 0;
    for (const line of slot.lines) {
      const reps = Math.max(1, Math.round(+line.r || 1)),
        trend = strengthTrend(history, reps),
        planned = item.ref ? ((+line.p || 0) / 100) * item.ref : 0;
      if (trend !== 1) nudge = trend;
      for (let k = 0; k < Math.max(1, Math.round(+line.n || 1)); k++)
        item.rows.push({
          w: planned > 0 ? toLoadedWeight(ex, planned * trend) : '',
          r: reps,
          rir: '',
          pw: planned,
          auto: true,
        });
    }
    // Hint: the nudge, then what you did last time (without the RIR target, which doesn't apply here).
    const last = (item.hint || '').startsWith('Last:')
      ? item.hint.replace(/ · \d+–\d+ reps @ [\d.]+ RIR$/, '')
      : '';
    item.hint = [
      nudge ? `${nudge > 1 ? '+' : ''}${Math.round((nudge - 1) * 100)}% vs plan from recent sessions` : '',
      last,
    ]
      .filter(Boolean)
      .join(' · ');
  } else item.rows = suggestion.rows.map(r => ({ ...r, pw: (+r.w || 0) + item.bwo, auto: true }));

  if (!item.rows.length) item.rows.push({ w: '', r: '', rir: '' });
  const warmups = Math.min(4, Math.max(0, Math.round(+ex.wu || 0)));
  if (warmups) {
    const working = +item.rows[0].w || 0;
    item.rows.unshift(
      ...WARMUP_RAMP[warmups].map(([fraction, reps]) => ({
        w: working && ex.inc > 0 ? roundToStep(working * fraction, ex.inc) : '',
        r: reps,
        rir: '',
        wu: true,
      })),
    );
  }
  workout.items.push(item);
}

// Start a workout: a plan day (planId, dayIndex) or a quick workout (no planId).
async function startWorkout(planId, day = 0) {
  picker = null;
  showTrainHome = false;
  const plan = planId ? state.tpl.find(x => x.id == planId) : null,
    planDay = plan && plan.days[day];
  workout = {
    sess: Date.now(),
    name: planDay ? `${plan.name} · ${planDay.name}` : 'Quick workout',
    pd: planDay ? `${plan.id}:${day}` : undefined,
    rest: +lsGet('rest') || 120,
    restEnd: 0,
    items: [],
  };
  if (planDay) {
    const week = planProgress(plan).wk;
    for (const slot of planDay.items) await addExerciseToWorkout(slot, week);
  }
  saveWorkout();
  render();
}
