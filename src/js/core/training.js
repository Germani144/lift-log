/* ---------- math ---------- */
const fractionOf1RM = (r, rir) => 1 / (1 + (r + rir) / 30); // %1RM from reps + RIR
const estimate1RM = (w, r, rir) => w / fractionOf1RM(r, rir);
const hasRir = r => r.rir !== '' && r.rir != null && +r.rir >= 0 && +r.rir <= 10;
const isMaxTest = r => +r.r === 1 && hasRir(r) && +r.rir === 0; // 1 rep at 0 RIR counts as a 1RM
const roundToStep = (x, i) => (i > 0 ? +(Math.round(x / i) * i).toFixed(3) : +(+x).toFixed(2)); // increment 0 = no rounding (bodyweight)
const weightLabel = w => (w > 0 ? fmt(w) : 'BW');

/* Bodyweight lifts (pull-ups, dips…): with "Load includes bodyweight" on, the maths uses you + the plate,
   while you always type and see only the added kg. Each logged set remembers your bodyweight at the time. */
const bodyweight = () => +lsGet('bw') || 0,
  height = () => +lsGet('ht') || 0,
  bodyweightFor = ex => (ex?.bwl ? bodyweight() : 0);
const withBodyweight = (ex, s) =>
  ex?.bwl ? { ...s, w: (s.w === '' || s.w == null ? 0 : +s.w) + (s.bw ?? bodyweight()) } : s; // a set in total-load space
const toLoadedWeight = (ex, v) => {
  if (ex?.bwl) {
    const a = roundToStep(+v - bodyweight(), ex.inc);
    return a > 0 ? a : '';
  }
  return v > 0 ? roundToStep(v, ex.inc) : '';
}; // total load -> what you load ('' = bodyweight / no suggestion)
/* RIR is picked from a list: 0–5 in half steps, plus "5+" (stored as 6). A 5+ set stays in history and volume
   but, like a warm-up, never feeds suggestions, the strength estimate or the next-set adjustment. */
const RIR_CHOICES = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6];
const rirLabel = v => (v == null || v === '' ? '' : +v > 5 ? '5+' : fmt(v)),
  rpeLabel = v => (v == null || v === '' ? '' : +v > 5 ? '<5' : fmt(10 - v));
// How strong a lift has been lately vs. its longer-run level, at a similar rep count: recent 3 sessions vs. the last 10. Used to nudge planned % sets (max ±10%).
function strengthTrend(ss, r) {
  const by = new Map();
  for (const s of ss)
    if (isWorkingSet(s) && Math.abs(s.r - r) <= 1)
      by.set(s.sess, Math.max(by.get(s.sess) || 0, estimate1RM(s.w, s.r, s.rir)));
  const v = [...by.values()];
  if (v.length < 2) return 1;
  const rc = v.slice(-3);
  let a = 0,
    b = 0;
  rc.forEach((x, i) => {
    a += x * (i + 1);
    b += i + 1;
  });
  const lg = v.slice(-10),
    mean = lg.reduce((p, x) => p + x, 0) / lg.length;
  return Math.min(1.1, Math.max(0.9, a / b / mean));
}
// Reference 1RM for % view: your tested 1RM, or else the estimate from recent working sets.
async function reference1RM(ex) {
  const p = state.pr[ex.id];
  if (p) return { w: p.w + bodyweightFor(ex), est: false };
  const ss = (await getAll('sets', 'ex', ex.id))
      .filter(s => !s.wu)
      .sort((a, b) => a.t - b.t)
      .map(s => withBodyweight(ex, s)),
    E = estimateStrength(ss, -99, 999);
  return E ? { w: Math.round(E * 10) / 10, est: true } : null;
}

/* ---------- RIR double progression ---------- */
// Per set, from the same set last session: reps you could have done at target RIR = reps + RIR - target.
// Aim one more rep at the same weight; past the top of the range, reset to the bottom reps at a heavier e1RM-based weight.
/* ---------- suggestions ----------
 Strength = estimated 1RM averaged over your last 4 sessions (recent ones count more), from working sets only:
 not warm-ups, RIR known and under 5. Sets in a rep range close to today's target are preferred, so a heavy-triple
 day doesn't inflate a light-day suggestion. Weight and reps then come from that strength number and the target. */
const isWorkingSet = s => !s.wu && s.rir != null && s.rir < 5 && s.w > 0;
function estimateStrength(ss, lo, hi) {
  const est = f => {
    const by = new Map();
    for (const s of ss)
      if (isWorkingSet(s) && f(s))
        by.set(s.sess, Math.max(by.get(s.sess) || 0, estimate1RM(s.w, s.r, s.rir)));
    const v = [...by.values()].slice(-4);
    if (!v.length) return null;
    let a = 0,
      b = 0;
    v.forEach((x, i) => {
      const k = i + 1;
      a += x * k;
      b += k;
    });
    return a / b;
  };
  return est(s => s.r >= lo - 3 && s.r <= hi + 3) ?? est(() => true);
}
const WARMUP_RAMP = {
  1: [[0.6, 5]],
  2: [
    [0.5, 8],
    [0.75, 4],
  ],
  3: [
    [0.45, 8],
    [0.65, 5],
    [0.85, 3],
  ],
  4: [
    [0.4, 8],
    [0.55, 5],
    [0.7, 3],
    [0.85, 2],
  ],
}; // warm-up % of working weight, reps
async function suggestSets(ex, n) {
  const ss = (await getAll('sets', 'ex', ex.id)).filter(s => !s.wu).sort((a, b) => a.t - b.t),
    rows = [],
    aim = `${ex.lo}–${ex.hi} reps @ ${ex.rir} RIR`,
    sess = [...new Set(ss.map(s => s.sess))],
    fat = j => Math.floor(j / 2), // later sets: about 1 rep fewer every 2 sets
    sT = ex.bwl ? ss.map(s => withBodyweight(ex, s)) : ss;
  const lastS = ss.filter(s => s.sess == sess[sess.length - 1]),
    hint = lastS.length
      ? `Last: ${lastS.map(s => `${weightLabel(s.w)}×${s.r}${s.rir != null ? ' @' + rirLabel(s.rir) : ''}`).join(', ')} · ${aim}`
      : `${aim} · no history yet`;
  if (!(ex.inc > 0) || (!ex.bwl && lastS.length && Math.max(...lastS.map(s => s.w)) === 0)) {
    // bodyweight (or done at bodyweight last time): progress reps
    const by = new Map();
    for (const s of ss)
      if (!s.wu && s.rir != null && s.rir < 5 && (!(ex.inc > 0) || s.w === 0))
        by.set(s.sess, Math.max(by.get(s.sess) || 0, s.r + s.rir));
    const v = [...by.values()].slice(-4);
    let cap = null;
    if (v.length) {
      let a = 0,
        b = 0;
      v.forEach((x, i) => {
        a += x * (i + 1);
        b += i + 1;
      });
      cap = a / b;
    }
    const lb = lastS.filter(s => s.rir != null && s.rir < 5).reduce((m, s) => Math.max(m, s.r + s.rir), 0),
      w = lastS.length ? Math.max(...lastS.map(s => s.w)) : '',
      rS = cap == null ? null : Math.round(cap - ex.rir),
      r =
        rS == null
          ? ex.lo
          : Math.max(ex.lo, lb ? Math.min(rS + 2, Math.max(rS, Math.round(lb - ex.rir) + 1)) : rS + 1);
    for (let j = 0; j < n; j++) rows.push({ w: w || '', r: Math.max(ex.lo, r - fat(j)), rir: ex.rir });
    return { rows, hint };
  }
  const E = estimateStrength(sT, ex.lo, ex.hi);
  if (!E) {
    for (let j = 0; j < n; j++) rows.push({ w: '', r: ex.lo, rir: ex.rir });
    return { rows, hint };
  }
  let Wb = null,
    bt = null; // the weight you last used in today's rep range, and that set
  for (let k = sess.length - 1; k >= 0 && Wb == null; k--) {
    const t = sT
      .filter(s => s.sess == sess[k] && isWorkingSet(s) && s.r >= ex.lo && s.r <= ex.hi)
      .sort((a, b) => b.w - a.w || b.r - a.r)[0];
    if (t) {
      Wb = t.w;
      bt = t;
    }
  }
  let w, r;
  if (Wb != null) {
    const rS = Math.round(30 * (E / Wb - 1) - ex.rir); // reps the averaged strength says you can do at that weight
    r = Math.min(rS + 2, Math.max(rS, Math.round(bt.r + bt.rir - ex.rir) + 1));
    w = Wb; // one more than last time, kept within the average's guard rails
    if (r > ex.hi) {
      r = ex.lo;
      w = Math.max(roundToStep(E * fractionOf1RM(ex.lo, ex.rir), ex.inc), roundToStep(Wb + ex.inc, ex.inc));
    } else if (r < ex.lo) {
      r = ex.lo;
      w = Math.min(roundToStep(E * fractionOf1RM(ex.lo, ex.rir), ex.inc), roundToStep(Wb - ex.inc, ex.inc));
    }
  } else {
    r = ex.lo;
    w = roundToStep(E * fractionOf1RM(ex.lo, ex.rir), ex.inc);
  }
  for (let j = 0; j < n; j++)
    rows.push({ w: toLoadedWeight(ex, w), r: Math.max(ex.lo, r - fat(j)), rir: ex.rir });
  return { rows, hint };
}

/* After you log a set, the sets after it (that you haven't edited) adjust to how that set really went.
   % view: the weight moves to match today's strength. RIR view: the weight stays and the reps move,
   unless they'd leave the rep range. Never more than ±10% from the plan, about 1.5% easier per set for fatigue. */
async function adjustRemainingSetsPct(it, j, ex) {
  const d = withBodyweight(ex, it.rows[j]);
  if (+d.rir > 5 || d.wu || !(+d.w > 0) || !hasRir(d) || !(+d.r > 0) || !(ex.inc > 0)) return;
  const now = estimate1RM(+d.w, +d.r, +d.rir),
    by = new Map();
  for (const s of (await getAll('sets', 'ex', ex.id)).map(s => withBodyweight(ex, s)))
    if (s.sess != workout.sess && isWorkingSet(s) && Math.abs(s.r - d.r) <= 1)
      by.set(s.sess, [s.t, Math.max(by.get(s.sess)?.[1] || 0, estimate1RM(s.w, s.r, s.rir))]);
  let base = null;
  const v = [...by.values()]
    .sort((a, b) => a[0] - b[0])
    .slice(-4)
    .map(x => x[1]);
  if (v.length) {
    let a = 0,
      b = 0;
    v.forEach((x, i) => {
      a += x * (i + 1);
      b += i + 1;
    });
    base = a / b;
  } else {
    const f = it.rows.find(
      r => r.done && !r.wu && +withBodyweight(ex, r).w > 0 && hasRir(r) && Math.abs(+r.r - d.r) <= 1,
    );
    if (f && f !== it.rows[j]) {
      const fT = withBodyweight(ex, f);
      base = estimate1RM(+fT.w, +fT.r, +fT.rir);
    }
  } // no history: compare with today's first set
  if (!base) return;
  const fac = Math.min(1.1, Math.max(0.9, now / base));
  for (let q = j + 1; q < it.rows.length; q++) {
    const r = it.rows[q];
    if (r.done || r.wu || !r.auto || !(+r.pw > 0)) continue;
    const w = toLoadedWeight(ex, r.pw * fac);
    if (w !== r.w) {
      r.w = w;
      r.adj = true;
    }
  }
}
function adjustRemainingSetsRir(it, j, ex) {
  if (it.mode == 'pct') return;
  const d = withBodyweight(ex, it.rows[j]);
  if (+d.rir > 5 || d.wu || !(+d.w > 0) || !hasRir(d) || !(+d.r > 0) || !(ex.inc > 0)) return;
  const e = estimate1RM(+d.w, +d.r, +d.rir);
  let k = 0;
  for (let q = j + 1; q < it.rows.length; q++) {
    const r = it.rows[q];
    if (r.done || r.wu || !r.auto || !(+r.r > 0) || !hasRir(r)) continue;
    const f = Math.pow(0.985, ++k),
      pw = +r.pw || +r.w || 0,
      cl = w =>
        pw > 0 ? Math.min(roundToStep(pw * 1.1, ex.inc), Math.max(roundToStep(pw * 0.9, ex.inc), w)) : w;
    let w = +withBodyweight(ex, r).w || 0,
      rr = +r.r;
    const w0 = w;
    if (it.mode == 'pct' || !(w > 0)) w = cl(roundToStep(e * f * fractionOf1RM(rr, +r.rir), ex.inc));
    else {
      rr = Math.round(30 * ((e * f) / w - 1) - +r.rir);
      if (rr > it.hi) {
        rr = it.hi;
        w = cl(roundToStep(e * f * fractionOf1RM(rr, +r.rir), ex.inc));
      } else if (rr < it.lo) {
        rr = it.lo;
        w = cl(roundToStep(e * f * fractionOf1RM(rr, +r.rir), ex.inc));
      }
    }
    if (rr !== +r.r || w !== w0) {
      r.r = rr;
      if (w !== w0) r.w = toLoadedWeight(ex, w);
      r.adj = true;
    }
  }
}

/* ---------- row info: e1RM + PR check ---------- */
function setInfo(r0, ex) {
  const b = bodyweightFor(ex),
    pr0 = state.pr[ex.id],
    pr = pr0 && { ...pr0, w: pr0.w + b };
  if (r0.wu) return { s: 'Warm-up', w: 0 };
  const r = b ? withBodyweight(ex, r0) : r0;
  if (+r0.rir > 5 && r0.rir !== '') return { s: '5+: not used for suggestions', w: 0 };
  if (!(r.w > 0 && r.r > 0 && hasRir(r))) return { s: '', w: 0 };
  if (isMaxTest(r)) {
    let s = 'Counts as a 1RM';
    if (pr) {
      const d = (r.w / pr.w - 1) * 100;
      s += ` · ${d >= 0 ? '+' : ''}${d.toFixed(1)}% vs 1RM`;
    }
    return { s, w: 0 };
  }
  const e = estimate1RM(r.w, r.r, r.rir);
  let s = 'e1RM ' + fmt(e);
  if (pr) {
    const d = (e / pr.w - 1) * 100;
    s += ` · ${d >= 0 ? '+' : ''}${d.toFixed(1)}% vs 1RM`;
    if (d > 3) return { s: '⚠ ' + s, w: 1 };
  }
  return { s, w: 0 };
}
