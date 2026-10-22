function rTpl() {
  return (
    ttl('Plans') +
    S.tpl
      .map(
        t =>
          `<button class="b big" data-a=tplEdit data-i=${t.id}>${esc(t.name)}<small>${t.days.length} day${t.days.length > 1 ? 's' : ''}/week · ${t.weeks} weeks${t.active ? ' · active' : ''} · ${t.days.map(d => esc(d.name)).join(', ')}</small></button>`,
      )
      .join('') +
    `<button class="b p" data-a=tplNew>New weekly plan</button>`
  );
}

function resizeDays(n) {
  const d = E.days;
  if (
    n < d.length &&
    d.slice(n).some(x => x.items.length) &&
    !confirm('Remove the extra days and their exercises?')
  ) {
    render();
    return;
  }
  while (d.length < n) d.push({ name: 'Day ' + (d.length + 1), items: [] });
  d.length = Math.min(d.length, n);
  render();
}

function rTple() {
  const dpw = [1, 2, 3, 4, 5, 6, 7]
    .map(n => `<option ${n == E.days.length ? 'selected' : ''}>${n}</option>`)
    .join('');
  return (
    `<button class=b data-a=back>‹ Back</button><label>Plan name<input data-b=name value="${esc(E.name)}"></label>
 <div class=row><label>Days per week<select data-dpw>${dpw}</select></label><label>Number of weeks<input type=number min=1 data-n data-b=weeks value="${E.weeks ?? 8}"></label></div>
 <p class=m>Plan each exercise by <b>RIR</b> (sets, this plan's rep range, and a target RIR for each week) or by <b>% of 1RM</b> (sets × reps at a % of your 1RM; you log the RPE). You can still switch during the workout.</p>` +
    E.days
      .map(
        (dy, k) =>
          `<div class=card><label>Day ${k + 1} name<input data-b="days.${k}.name" value="${esc(dy.name)}"></label>` +
          dy.items
            .map((it, j) => {
              const ex = EX(it.exId),
                b = `days.${k}.items.${j}`,
                f = (x, l) =>
                  `<label>${l}<input type=number step=any data-n data-b="${b}.${x}" value="${it[x] ?? ''}" placeholder="${ex ? (ex[x] ?? '') : ''}"></label>`;
              const sw = TR && TR.k == k && TR.j == j;
              return (
                `<div class=card style="background:var(--bg)">` +
                (sw
                  ? `<div class=row><input data-tr="${k}.${j}" placeholder="Replace ${esc(ex?.name || 'exercise')}: type a name" autocomplete=off enterkeyhint=done value="${esc(TR.q)}"><button class=b style="flex:0 0 auto" data-a=tplSwapX>Cancel</button></div><div id=trs>${trBox()}</div>`
                  : `<div class=row><button class="b exsw" data-a=tplSwap data-k=${k} data-i=${j}><span>${esc(ex?.name || 'Deleted exercise')}</span><span class=m>⇄ Replace</span></button><button class=s style="flex:0 0 40px" data-a=tplDelItem data-k=${k} data-i=${j} aria-label="Remove exercise">×</button></div>`) +
                `<div class=segrow><span class=m>Track by</span><span class=seg role=group aria-label="Track by"><button class="${it.mode == 'pct' ? '' : 'on'}" data-a=tplMode data-k=${k} data-i=${j} data-m=rir>RIR</button><button class="${it.mode == 'pct' ? 'on' : ''}" data-a=tplMode data-k=${k} data-i=${j} data-m=pct>% 1RM</button></span></div>` +
                (it.mode == 'pct'
                  ? `<div class="pline hdr"><span>Sets</span><span>Reps</span><span>% 1RM</span><span></span></div>` +
                    (it.lines || [])
                      .map(
                        (l, q) =>
                          `<div class=pline>${['n', 'r', 'p'].map(x => `<input type=number step=any inputmode=decimal data-n data-b="${b}.lines.${q}.${x}" value="${l[x] ?? ''}" aria-label="${{ n: 'Sets', r: 'Reps', p: 'Percent of 1RM' }[x]}">`).join('')}<button class=s data-a=tplRmLine data-k=${k} data-i=${j} data-l=${q} aria-label="Remove line">×</button></div>`,
                      )
                      .join('') +
                    `<button class=b data-a=tplAddLine data-k=${k} data-i=${j}>+ Line</button>`
                  : ((it.rirW = rirWeeks(it, Math.max(1, Math.round(+E.weeks || 8)), ex)),
                    `<div class=row>${f('n', 'Sets').replace(/placeholder="[^"]*"/, '')}${f('lo', 'Reps min')}${f('hi', 'Reps max')}</div>
     <div class=m style="margin-top:6px">Target RIR per week</div><div class=wkr>${it.rirW.map((v, w) => `<label>W${w + 1}${rirSel(`data-n data-b="${b}.rirW.${w}" aria-label="Week ${w + 1} target RIR"`, v, { max5: true, blank: false })}</label>`).join('')}</div>`)) +
                `</div>`
              );
            })
            .join('') +
          `<input data-tq=${k} placeholder="Add exercise: type a name" autocomplete=off enterkeyhint=done value="${TQ.k == k ? esc(TQ.q) : ''}" style="margin-top:6px"><div id=tqs${k}>${TQ.k == k ? tqBox(k) : ''}</div></div>`,
      )
      .join('') +
    `<div class=row><button class="b p" data-a=tplSave>Save</button>${E.id ? '<button class=b data-a=tplDel>Delete</button>' : ''}</div>`
  );
}
