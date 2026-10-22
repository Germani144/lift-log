function updInfo(s) {
  const it = W.items[s.dataset.i];
  $('.inf>span', s).innerHTML = infoTxt(it, it.rows[s.dataset.j], EX(it.exId));
}

const pctOf = (it, w) => {
  const t = (w === '' || w == null ? 0 : +w) + (it.bwo || 0);
  return it.ref > 0 && t > 0 && (w !== '' || it.bwo) ? Math.round((t / it.ref) * 1000) / 10 : '';
};
function card(it, i) {
  const ex = EX(it.exId);
  if (!ex) return '';
  const P = it.mode == 'pct',
    pr = S.pr[ex.id];
  const ref = P
    ? it.ref > 0
      ? `${it.refEst ? 'Estimated 1RM' : '1RM'} ${fmt(it.ref)}${it.refEst ? '' : ' · ' + age(pr?.t)}`
      : 'No 1RM yet'
    : '';
  let h = `<div class=card><div class=hd><b style="flex:1">${esc(ex.name)}</b><span class=seg role=group aria-label="Track by"><button class="${P ? '' : 'on'}" data-a=mode data-i=${i} data-m=rir>RIR</button><button class="${P ? 'on' : ''}" data-a=mode data-i=${i} data-m=pct>% 1RM</button></span><button class=s style="width:40px" data-a=rmx data-i=${i} aria-label="Remove exercise">×</button></div><div class=m>${esc([ref, ex.bwl ? (it.bwo ? `incl. ${fmt(it.bwo)} kg bodyweight` : 'set your bodyweight in Settings (⚙)') : '', it.hint].filter(Boolean).join(' · '))}</div>`;
  h +=
    `<div class="set hdr"><span>${P ? '% of 1RM' : 'Weight (kg)'}</span><span></span><span>Reps</span><span></span><span>${P ? 'RPE' : 'RIR'}</span><span></span></div>` +
    it.rows
      .map((r, j) => {
        const d = r.done ? 'disabled' : '';
        const wv = P ? pctOf(it, r.w) : r.w > 0 ? fmt(r.w) : r.done ? 'BW' : '',
          ev = r.rir === '' || r.rir == null ? '' : P ? fmt(10 - r.rir) : fmt(r.rir);
        return `<div class="set ${r.done ? 'dn' : ''}${r.wu ? ' wu' : ''}" data-i=${i} data-j=${j}>
  <input data-f=w inputmode=decimal aria-label="${P ? 'Percent of 1RM' : 'Weight in kg, empty for bodyweight'}" value="${wv}" ${d}>
  <button class=s data-a=step data-d=-1 aria-label="One rep less" ${d}>−</button><input data-f=r inputmode=numeric placeholder=reps aria-label=Reps value="${fmt(r.r)}" ${d}><button class=s data-a=step data-d=1 aria-label="One rep more" ${d}>+</button>${rirSel(`data-f=rir aria-label="${P ? 'RPE (10 = max effort)' : 'Reps in reserve'}" ${d}`, r.rir, { pct: P })}
  <button class="ck ${r.done ? 'on' : ''}" data-a=${r.done ? 'undo' : 'log'} aria-label="${r.done ? 'Undo set' : 'Log set'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg></button>
  <div class=inf><span>${infoTxt(it, r, ex)}</span><span><button class=lk data-a=wu>${r.wu ? 'Make working set' : 'Mark as warm-up'}</button> <button class=lk data-a=rms>Remove set</button></span></div></div>`;
      })
      .join('');
  return (
    h +
    `<div class=row><button class=b data-a=addset data-i=${i}>+ Set</button><button class=b data-a=repl data-i=${i}>⇄ Replace</button></div></div>`
  );
}
function infoTxt(it, r, ex) {
  const P = it.mode == 'pct',
    x = info(r, ex),
    kg = P
      ? it.bwo
        ? +r.w > 0
          ? `<b>+${fmt(rnd(+r.w, 0.01))} kg</b>`
          : r.w === '' && !r.done
            ? ''
            : '<b>BW</b>'
        : +r.w > 0
          ? `<b>${fmt(rnd(+r.w, 0.01))} kg</b>`
          : ''
      : '',
    adj = r.adj && !r.done ? 'adjusted' : '',
    note =
      x.s && (!P || x.w || isTest(r) || r.wu) ? `<span class="${x.w ? 'wr' : ''}">${esc(x.s)}</span>` : ''; // % view: just the kg, plus warnings
  return [kg, note, adj].filter(Boolean).join(' · ');
}

function nag() {
  const lb = lastBackup();
  return S.sets.length && Date.now() - lb > 6048e5
    ? `<div class=card><span class=wr>Back up your data</span><div class=m>${lb ? 'Last backup ' + age(lb) : 'No backup yet'}. Clearing browser data erases your history.</div><button class=b data-a=backup>Export backup</button></div>`
    : '';
}
function rPlan(t) {
  if (!t.active)
    return `<div class=card><div class=hd><b>${esc(t.name)}</b><span class=m>${t.days.length} days/week · ${t.weeks} weeks</span></div><button class=b data-a=planStart data-i=${t.id}>Start plan</button></div>`;
  const p = planRun(t);
  return (
    `<div class=card><div class=hd><b>${esc(t.name)}</b><span class=m>${t.days.length} days/week</span></div><div class=big-n>${p.done ? 'Complete' : `Week ${p.wk}<span> of ${t.weeks}</span>`}</div>${bb(t.weeks, Math.min(t.weeks, Math.floor(p.total / t.days.length)), !p.done, p.done ? 'Plan complete' : `Week ${p.wk} of ${t.weeks}`)}` +
    (p.done
      ? `<p>Plan complete: all ${t.weeks} weeks done.</p><div class=row><button class="b p" data-a=planStart data-i=${t.id}>Restart</button><button class=b data-a=planStop data-i=${t.id}>Close</button></div>`
      : t.days
          .map(
            (d, k) =>
              `<button class="b big" data-a=start data-i=${t.id} data-d=${k}>${p.wdays.has(k) ? '✓ ' : ''}${esc(d.name)}${k == p.nx ? ' · next' : ''}<small>${d.items.map(i => esc(EX(i.exId)?.name || '?')).join(', ') || 'No exercises'}</small></button>`,
          )
          .join('') + `<button class=lk data-a=planStop data-i=${t.id}>End plan early</button>`) +
    `</div>`
  );
}

function prog() {
  const n = W.items.length;
  if (!n) return '';
  const d = W.items.filter(i => i.rows.length && i.rows.every(r => r.done)).length;
  return `<div class=card><div class=hd><span class=m>${d} of ${n} exercise${n == 1 ? '' : 's'} done</span><span class=m id=el>${elapsed()}</span></div>${bb(n, d, d < n, `${d} of ${n} exercises done`)}</div>`;
}
let LAND = false; // true = show the Train landing page even though a workout is in progress
let PICK = null,
  PQ = ''; // exercise picker state: {t:'add'|'rep', i, y}
function rPick() {
  const old = PICK.t == 'rep' ? EX(W.items[PICK.i]?.exId) : null;
  return `<div class=hd><h2>${PICK.t == 'rep' ? 'Replace ' + esc(old?.name || 'exercise') : 'Add exercise'}</h2><button class=b data-a=pickCancel>Cancel</button></div><input id=pq placeholder="Type an exercise" value="${esc(PQ)}" autocomplete=off enterkeyhint=done><div id=plist>${pickBox()}</div>`;
}
function rTrain() {
  if (!W || LAND) {
    const ps = [...S.tpl.filter(t => t.active), ...S.tpl.filter(t => !t.active)],
      cur = W
        ? `<div class=card><div class=hd><b>Workout in progress</b><span class=m>${W.items.reduce((n, i) => n + i.rows.filter(x => x.done).length, 0)} sets logged</span></div><div class=m>${esc(W.name)}</div><div class=row><button class="b p" data-a=resume>Resume</button><button class=b data-a=finish>Finish</button></div></div>`
        : '';
    return (
      ttl('Train') +
      cur +
      nag() +
      (ps.map(rPlan).join('') ||
        '<p class=m>No plans yet. Build one in Plans, or start a quick workout.</p>') +
      `<button class=b data-a=start>Quick workout</button>`
    );
  }
  if (!W.rest) W.rest = +lg('rest') || 120;
  if (PICK) return rPick();
  return (
    `<button class=b data-a=toLanding>‹ Back</button><div class=hd><h2>${esc(W.name)}</h2><button class="b p" data-a=finish>Finish</button></div>` +
    prog() +
    W.items.map(card).join('') +
    (S.ex.length
      ? `<button class="b p" style="width:100%;margin-top:12px" data-a=pickAdd>+ Add exercise</button>`
      : '<p class=m>Create exercises first.</p>') +
    restBar()
  );
}
