let exerciseFilter = ''; // Exercises tab search text
const matchesFilter = n => {
  n = n.toLowerCase();
  return exerciseFilter
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every(w => n.includes(w));
};
function renderExercises() {
  return (
    pageTitle('Exercises') +
    (state.ex.length
      ? `<input id=exq type=search placeholder="Search exercises" value="${esc(exerciseFilter)}" autocomplete=off enterkeyhint=search>`
      : '') +
    (!state.ex.length && !state.sets.length && !githubConfig()
      ? `<div class=card><b>No data here</b><div class=m>If you had a backup, restore it first: tap ⚙ (top right), enter your token in Automatic backup and tap Turn on. Don't add anything before restoring.</div></div>`
      : '') +
    exercisesByName()
      .map(e => {
        const p = state.pr[e.id];
        return `<button class="b big exr" data-a=exOpen data-i=${e.id} data-q="${esc(e.name.toLowerCase())}"${matchesFilter(e.name) ? '' : ' hidden'}><span class=l>${esc(e.name)}<small>${e.inc > 0 ? 'increment ' + e.inc : 'bodyweight'}</small></span>${p ? `<span class=r><b>${e.bwl ? '+' : ''}${fmt(p.w)}<i> kg</i></b><small>1RM ${ageText(p.t)}${e.pb ? ' · PB ' + fmt(e.pb) : ''}</small></span>` : e.pb ? `<span class=r><small>PB ${fmt(e.pb)}</small></span>` : e.mode == 'pct' ? '<span class=r><small>No 1RM</small></span>' : ''}</button>`;
      })
      .join('') +
    `<p class=m id=exnone${!state.ex.length || state.ex.some(e => matchesFilter(e.name)) ? ' hidden' : ''}>No exercise matches “${esc(exerciseFilter)}”.</p><button class="b p" data-a=exNew>New exercise</button>`
  );
}

function groupSessions(sets) {
  const g = {};
  sets.forEach(s => (g[s.sess] ??= []).push(s));
  return Object.keys(g)
    .map(k => {
      const ss = g[k].sort((a, b) => a.t - b.t),
        es = ss.filter(s => s.rir != null && !s.test).map(s => estimate1RM(s.w, s.r, s.rir));
      return {
        k: +k,
        t: ss[0].t,
        ss,
        vol: ss.reduce((a, s) => a + s.r, 0),
        top: ss.reduce((a, b) => (b.w > a.w ? b : a)),
        e: es.length ? Math.max(...es) : null,
      };
    })
    .sort((a, b) => b.k - a.k);
}
function lineChart(l, v, t, z, u = '') {
  if (v.length < 2) return '';
  const mx = Math.max(...v),
    mn = z ? 0 : Math.min(...v),
    R = mx - mn || 1,
    L = 34,
    Rr = 292,
    T = 8,
    B = 100,
    X = i => (L + (i / (v.length - 1)) * (Rr - L)).toFixed(1),
    Y = y => (B - ((y - mn) / R) * (B - T)).toFixed(1),
    pts = v.map((y, i) => X(i) + ',' + Y(y)).join(' '),
    d = x => new Date(x).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
  return `<div class=m style="margin-top:12px">${l}</div><svg class=chart viewBox="0 0 300 124" width="100%" role=img aria-label="${l}: from ${fmt(v[0])} to ${fmt(v[v.length - 1])}" data-u="${u}" data-p="${v.map((y, i) => X(i) + '|' + Y(y) + '|' + y + '|' + t[i]).join(';')}"><g fill="var(--m)" font-size="10" font-family="Bw,system-ui,sans-serif"><text x="${L - 5}" y="${T + 3}" text-anchor="end">${fmt(mx)}</text><text x="${L - 5}" y="${B + 3}" text-anchor="end">${fmt(mn)}</text><text x="${L}" y="118">${d(t[0])}</text><text x="${Rr}" y="118" text-anchor="end">${d(t[t.length - 1])}</text></g>
 <path d="M${L} ${T}V${B}H${Rr}" fill="none" stroke="var(--m)" stroke-width="1" opacity=".6"/><polyline points="${pts}" fill="none" stroke="var(--ac)" stroke-width="2" stroke-linejoin="round"/>
 <g class=tip visibility=hidden><line y1="${T}" y2="${B}" stroke="var(--fg)" stroke-width="1" opacity=".35"/><circle r="4" fill="var(--ac)" stroke="var(--c)" stroke-width="2"/><rect rx="5" fill="var(--c2)"/><text font-size="11" font-weight="600" fill="var(--fg)" text-anchor="middle" font-family="Bw,system-ui,sans-serif"></text></g></svg>`;
}
// Touch, drag or hover on a chart: mark the nearest session and show its date and value.
function showChartTip(e) {
  const sv = e.target.closest?.('svg.chart');
  if (!sv) {
    if (e.type == 'pointerdown')
      document.querySelectorAll('svg.chart .tip').forEach(g => g.setAttribute('visibility', 'hidden'));
    return;
  }
  const r = sv.getBoundingClientRect(),
    x = ((e.clientX - r.left) / r.width) * 300,
    pts = sv.dataset.p.split(';').map(p => p.split('|').map(Number));
  let b = pts[0];
  for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(b[0] - x)) b = p;
  const [px, py, val, t] = b,
    g = sv.querySelector('.tip'),
    tx = g.querySelector('text'),
    rc = g.querySelector('rect'),
    u = sv.dataset.u;
  g.querySelector('line').setAttribute('x1', px);
  g.querySelector('line').setAttribute('x2', px);
  const c = g.querySelector('circle');
  c.setAttribute('cx', px);
  c.setAttribute('cy', py);
  tx.textContent = `${new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })} · ${u == 'kg' && !(val > 0) ? 'BW' : fmt(val) + (u ? ' ' + u : '')}`;
  g.setAttribute('visibility', 'visible');
  const w = tx.getComputedTextLength() + 14,
    cx = Math.min(300 - w / 2 - 2, Math.max(w / 2 + 2, px)),
    cy = py < 30 ? py + 22 : py - 12;
  tx.setAttribute('x', cx);
  tx.setAttribute('y', cy + 4);
  rc.setAttribute('x', cx - w / 2);
  rc.setAttribute('y', cy - 9);
  rc.setAttribute('width', w);
  rc.setAttribute('height', 18);
}
addEventListener('pointermove', showChartTip);
addEventListener('pointerdown', showChartTip);

function renderExerciseDetail() {
  const e = draft;
  if (e.cur === undefined) e.cur = e.id ? (state.pr[e.id]?.w ?? '') : '';
  const n = k => `type=number step=any data-n data-b=${k} value="${e[k] ?? ''}"`;
  let h =
    `<button class=b data-a=back>‹ Back</button><div class=card>
 <label>Name<input data-b=name value="${esc(e.name)}"></label>
 <label>Weight increment (0 = bodyweight only)<input ${n('inc')}></label>
 <label class=chk><input type=checkbox data-b=bwl ${e.bwl ? 'checked' : ''}> Load includes bodyweight (pull-ups, dips, chin-ups…)</label>
 ${e.bwl ? `<div class=m>Weights, 1RM and PB here are the <b>added</b> kg; the maths adds your bodyweight (${bodyweight() ? fmt(bodyweight()) + ' kg' : 'not set yet: set it in Settings (⚙)'}).</div>` : ''}
 <label>Warm-up sets added before working sets (0–4)<input ${n('wu')} min=0 max=4 placeholder=0></label>
 <div class=row><label>Current 1RM (kg)<input ${n('cur')}></label><label>Lifetime PB (kg)<input ${n('pb')}></label></div>
 <div class=m>Current 1RM sets your % weights. Lifetime PB is your best ever, and it rises on its own when you beat it.</div>` +
    `<div class=m style="margin-top:10px">Quick workouts (plans set their own)</div><div class=row><label>Reps min<input ${n('lo')}></label><label>Reps max<input ${n('hi')}></label><label>Target RIR${rirSelect(`data-n data-b=rir`, e.rir ?? 2, { max5: true, blank: false })}</label></div>` +
    `<div class=row><button class="b p" data-a=exSave>Save</button>${e.id ? '<button class=b data-a=exDel>Delete</button>' : ''}</div></div>`;
  if (!e.id) return h;
  h +=
    `<div class=card><b>Tested 1RM history</b><div class=m>Latest entry is your current 1RM.</div>` +
    (state.prl
      .map(
        (p, k) =>
          `<div class=hl><span>${fmt(p.w)} · ${dateText(p.t)} <span class=m>${ageText(p.t)}${k == 0 ? ' · current' : ''}</span></span><button data-a=prDel data-i=${p.id}>×</button></div>`,
      )
      .join('') || '<p class=m>None yet.</p>') +
    `<div class=row><input id=prw type=number step=any inputmode=decimal placeholder="Tested 1RM"><input id=prd type=date value="${new Date().toISOString().slice(0, 10)}"><button class=b data-a=prAdd>Add PR</button></div></div>`;
  const ses = groupSessions(state.hist);
  h +=
    `<div class=card><b>History</b>` +
    (ses.length
      ? lineChart(
          'Max weight per session (kg)',
          ses.map(x => x.top.w).reverse(),
          ses.map(x => x.t).reverse(),
          0,
          'kg',
        ) +
        lineChart(
          'Volume per session (reps)',
          ses.map(x => x.vol).reverse(),
          ses.map(x => x.t).reverse(),
          1,
          'reps',
        ) +
        ses
          .map(
            x =>
              `<div class=card style="margin:8px 0"><div class=hd><b>${dateText(x.t)}</b><span class=m>volume ${x.vol} reps</span></div><div class=m>Top set ${weightLabel(x.top.w)}×${x.top.r}${x.e ? ` · best e1RM ${fmt(x.e)}` : ''}</div>` +
              x.ss
                .map(
                  s =>
                    `<div class=hl><span>${weightLabel(s.w)} × ${s.r}${s.rir != null ? ` @ ${rirLabel(s.rir)} RIR` : ''}${s.test ? ' ★test' : ''}${s.wu ? ' <span class=m>warm-up</span>' : ''}</span><button data-a=sdel data-i=${s.id}>×</button></div>`,
                )
                .join('') +
              `</div>`,
          )
          .join('')
      : '<p class=m>No sets logged.</p>') +
    `</div>`;
  return h;
}

async function openExerciseHistory(id) {
  state.prl = (await getAll('pr_history', 'ex', id)).sort((a, b) => b.t - a.t);
  state.hist = (await getAll('sets', 'ex', id)).sort((a, b) => b.t - a.t);
  await loadState();
  render();
}
