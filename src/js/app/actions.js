const back = () => {
  S.view = null;
  E = null;
  render();
};

const A = {
  upd: async () => {
    const b = $('#updb'); // ask the server which version it serves (sw.js carries the same VER); update on demand
    b.textContent = 'Checking…';
    b.disabled = true;
    let v = null;
    try {
      const r = await fetch('sw.js?check=' + Date.now(), { cache: 'no-store' });
      if (r.ok) v = (/const VER='(\d+\.\d+)';/.exec(await r.text()) || [])[1] || null;
    } catch {}
    b.textContent = 'Check for updates';
    b.disabled = false;
    if (!v) return toast("Couldn't reach the server. Check the connection and try again.");
    const n = x => x.split('.').map(Number),
      [a1, a2] = n(v),
      [c1, c2] = n(VER);
    if (a1 < c1 || (a1 == c1 && a2 <= c2)) return toast(`You're on the latest version (v${VER}).`);
    if (!confirm(`Version v${v} is available (you have v${VER}). Update now?`)) return;
    b.textContent = 'Updating…';
    b.disabled = true;
    try {
      const g = await navigator.serviceWorker?.getRegistration();
      if (g) await g.update();
    } catch {}
    try {
      for (const k of await caches.keys())
        if (k.startsWith('lift-log-') || k.startsWith('liftlog-')) await caches.delete(k);
    } catch {} // only this app's caches
    location.reload();
  },
  backup: () => exportData(),
  restore: () => $('#imp').click(),
  tab: async (s, d) => {
    PICK = null;
    S.tab = d.i;
    S.view = null;
    E = null;
    await load();
    render();
    scTo(0, 0);
  },
  back,
  start: (s, d) => {
    if (
      W &&
      !confirm(
        `You have a workout in progress (${W.name}). Start a new one instead? Sets you already logged stay in History.`,
      )
    )
      return;
    start(+d.i || null, +d.d || 0);
  },
  toLanding: () => {
    LAND = true;
    render();
    scTo(0, 0);
  },
  resume: () => {
    LAND = false;
    render();
    scTo(0, 0);
  },
  finish: async () => {
    if (confirm('Finish workout?')) {
      W = null;
      LAND = false;
      saveW();
      await load();
      render();
    }
  },
  pickAdd: () => {
    PICK = { t: 'add', y: scY() };
    PQ = '';
    PALL = false;
    render();
    scTo(0, 0);
    $('#pq')?.focus();
  },
  pickAll: () => {
    PALL = true;
    $('#plist').innerHTML = pickBox();
  },
  pickNew: async () => {
    const id = await newEx($('#pq').value);
    if (id) A.pickGo(null, { x: id });
  },
  tplMode: (s, d) => {
    const it = E.days[+d.k].items[+d.i],
      x = EX(it.exId);
    it.mode = d.m;
    rememberMode(x, d.m);
    if (d.m == 'pct' && !it.lines?.length) it.lines = [newLine()];
    if (d.m == 'rir') {
      it.n ??= 3;
      it.lo ??= x?.lo ?? 8;
      it.hi ??= x?.hi ?? 12;
    }
    render();
  },
  tplAddLine: (s, d) => {
    const it = E.days[+d.k].items[+d.i],
      l = it.lines[it.lines.length - 1];
    it.lines.push(l ? { ...l } : newLine());
    render();
  },
  tplRmLine: (s, d) => {
    const it = E.days[+d.k].items[+d.i];
    it.lines.splice(+d.l, 1);
    if (!it.lines.length) it.lines.push(newLine());
    render();
  },
  tplSwap: (s, d) => {
    TR = { k: +d.k, j: +d.i, q: '' };
    render();
    const q = $('[data-tr]');
    if (q) {
      q.focus();
      q.scrollIntoView({ block: 'center' });
    }
  },
  tplSwapX: () => {
    TR = null;
    render();
  },
  tplSet: (s, d) => {
    E.days[TR.k].items[TR.j].exId = +d.x;
    TR = null;
    render();
  },
  tplSetNew: async () => {
    const id = await newEx($('[data-tr]').value);
    if (id) A.tplSet(null, { x: id });
  },
  tplPick: (s, d) => {
    const x = EX(+d.x),
      pm = x?.mode == 'pct';
    E.days[+d.k].items.push(
      pm
        ? { exId: +d.x, mode: 'pct', lines: [newLine()] }
        : {
            exId: +d.x,
            mode: 'rir',
            n: 3,
            lo: x?.lo ?? 8,
            hi: x?.hi ?? 12,
            rirW: Array(Math.max(1, Math.round(+E.weeks || 8))).fill(x?.rir ?? 2),
          },
    );
    TQ = { k: +d.k, q: '' };
    render();
    const q = $(`[data-tq="${d.k}"]`);
    if (q) {
      q.focus();
      q.scrollIntoView({ block: 'center' });
    }
  },
  tplPickNew: async (s, d) => {
    const id = await newEx($(`[data-tq="${d.k}"]`).value);
    if (id) A.tplPick(null, { k: d.k, x: id });
  },
  repl: (s, d) => {
    PICK = { t: 'rep', i: +d.i, y: scY() };
    PQ = '';
    PALL = false;
    render();
    scTo(0, 0);
    $('#pq')?.focus();
  },
  pickCancel: () => {
    const y = PICK.y;
    PICK = null;
    render();
    scTo(0, y);
  },
  pickGo: async (s, d) => {
    const exId = +d.x,
      P = PICK;
    if (P.t == 'add') {
      await addItem({ exId, n: 3 });
      PICK = null;
      saveW();
      render();
      scTo(0, 1e9);
      return;
    }
    const it = W.items[P.i],
      done = it.rows.filter(x => x.done);
    if (
      done.length &&
      !confirm(
        `Replace ${EX(it.exId)?.name || 'this exercise'} with ${EX(exId).name}? Its ${done.length} logged set${done.length > 1 ? 's' : ''} in this workout will be deleted.`,
      )
    )
      return;
    for (const x of done) if (x.id) await del('sets', x.id);
    await addItem({ exId, n: it.rows.filter(x => !x.wu).length || 3 });
    W.items[P.i] = W.items.pop(); // swap the new item into the old one's place
    PICK = null;
    saveW();
    render();
    scTo(0, P.y);
  },
  rdec: () => setRest(W.rest - 15),
  rinc: () => setRest(W.rest + 15),
  rstop: () => {
    W.restEnd = 0;
    saveW();
    tickRest();
  },
  redit: () => {
    const v = prompt('Rest time (seconds or m:ss)', fmtT(W.rest));
    if (v == null) return;
    const m = v.trim().match(/^(\d+):(\d{1,2})$/),
      n = m ? +m[1] * 60 + +m[2] : +v;
    n >= 15 && n <= 1800 ? setRest(n) : toast('Enter 15–1800 seconds, or m:ss');
  },
  planStart: async (s, d) => {
    const t = S.tpl.find(x => x.id == d.i),
      o = S.tpl.find(x => x.active && x.id != t.id);
    if (o && !confirm(`Switch from "${o.name}" to "${t.name}"? The current plan will be closed.`)) return;
    if (o) {
      o.active = false;
      await put('templates', o);
    }
    t.active = true;
    t.runStart = Date.now();
    await put('templates', t);
    await load();
    render();
  },
  planStop: async (s, d) => {
    const t = S.tpl.find(x => x.id == d.i);
    if (!planRun(t).done && !confirm('End this plan now? Your logged workouts stay in History.')) return;
    t.active = false;
    await put('templates', t);
    await load();
    render();
  },
  rms: async s => {
    const it = W.items[s.dataset.i],
      r = it.rows[s.dataset.j];
    if (r.done && !confirm('Remove this logged set?')) return;
    if (r.id) await del('sets', r.id);
    it.rows.splice(+s.dataset.j, 1);
    saveW();
    render();
  },
  rmx: async (s, d) => {
    const it = W.items[d.i],
      done = it.rows.filter(x => x.done);
    if (
      !confirm(
        done.length
          ? `Remove ${EX(it.exId)?.name || 'this exercise'} and delete its ${done.length} logged set(s) from this workout?`
          : 'Remove this exercise from the workout?',
      )
    )
      return;
    for (const x of done) if (x.id) await del('sets', x.id);
    W.items.splice(+d.i, 1);
    saveW();
    render();
  },
  addset: (s, d) => {
    const rows = W.items[d.i].rows,
      l = rows[rows.length - 1] || {};
    rows.push({ w: l.w ?? '', r: l.r ?? '', p: l.p ?? '' });
    saveW();
    render();
  },
  step: (s, d) => {
    const it = W.items[s.dataset.i],
      r = it.rows[s.dataset.j]; // −/+ change the reps; the weight is typed
    if (r.r === '' || r.r == null) {
      if (+d.d < 0) return;
      r.r = 0;
    }
    r.r = Math.max(1, Math.round(+r.r) + +d.d);
    r.auto = false;
    delete r.adj;
    $('[data-f=r]', s).value = fmt(r.r);
    saveW();
    updInfo(s);
  },
  log: async s => {
    const it = W.items[s.dataset.i],
      r = it.rows[s.dataset.j],
      ex = EX(it.exId);
    if (!(r.r > 0)) return toast('Enter reps'); // empty or 0 weight = bodyweight (BW)
    if (r.rir !== '' && r.rir != null && !(+r.rir >= 0 && +r.rir <= 10))
      return toast(
        it.mode == 'pct'
          ? "RPE must be between 0 and 10. Leave it blank if you don't track it."
          : "RIR must be between 0 and 10. Leave it blank if you don't track it.",
      );
    const test = !r.wu && isTest(r);
    const rec = {
      exId: ex.id,
      sess: W.sess,
      wn: W.name,
      pd: W.pd,
      t: Date.now(),
      w: Math.round((+r.w || 0) * 100) / 100,
      r: r.r,
      rir: hasR(r) ? +r.rir : null,
      test,
    };
    if (r.wu) rec.wu = true;
    if (ex.bwl && BWv()) rec.bw = BWv();
    r.id = await put('sets', rec);
    r.done = true;
    delete r.adj;
    if (it.mode == 'pct') await adjustPct(it, +s.dataset.j, ex);
    else adjustNext(it, +s.dataset.j, ex);
    saveW();
    startRest();
    const x = info(r, ex),
      pr = S.pr[ex.id];
    if (test) {
      const pb = ex.pb || 0,
        beat = r.w > pb;
      if (beat) await put('exercises', { ...ex, pb: r.w });
      if (
        confirm(
          `Save ${fmt(r.w)} as your current 1RM for ${ex.name}?` +
            (pr ? `\nCurrent 1RM: ${fmt(pr.w)} (tested ${age(pr.t)})` : '') +
            (beat ? '\nNew lifetime PB!' : ''),
        )
      )
        await put('pr_history', { exId: ex.id, w: r.w, t: rec.t, setId: r.id });
      await load();
    } else if (x.w) toast(`${x.s}. This e1RM is over 3% above your 1RM. Consider testing a new max.`);
    render();
  },
  mode: async (s, d) => {
    const it = W.items[+d.i],
      ex = EX(it.exId);
    if (it.mode == d.m) return;
    if (d.m == 'pct' && !(it.ref > 0)) {
      const ref = await refFor(ex);
      if (!ref)
        return toast(
          `No 1RM for ${ex.name} yet. Add a tested 1RM in Exercises, or log a few RIR sets first.`,
        );
      it.ref = ref.w;
      it.refEst = ref.est;
    }
    it.mode = d.m;
    saveW();
    render();
    rememberMode(ex, d.m);
  },
  wu: async s => {
    const r = W.items[s.dataset.i].rows[s.dataset.j];
    r.wu = !r.wu;
    if (!r.wu) delete r.wu;
    if (r.done && r.id) {
      const x = await rq(st('sets').get(r.id));
      if (x) {
        if (r.wu) {
          x.wu = true;
          x.test = false;
        } else {
          delete x.wu;
          x.test = isTest(x);
        }
        await put('sets', x);
      }
    }
    saveW();
    render();
  },
  undo: async s => {
    const r = W.items[s.dataset.i].rows[s.dataset.j];
    if (r.id) await del('sets', r.id);
    r.done = false;
    delete r.id;
    saveW();
    render();
  },
  settings: () => {
    PICK = null;
    S.view = { t: 'set' };
    render();
  },
  exNew: () => {
    E = { name: '', mode: 'rir', inc: 2, lo: 8, hi: 12, rir: 2 };
    S.prl = [];
    S.hist = [];
    S.view = { t: 'exd' };
    render();
  },
  exOpen: async (s, d) => {
    E = structuredClone(EX(+d.i));
    S.view = { t: 'exd' };
    await loadEx(E.id);
  },
  exSave: async () => {
    if (!E.name.trim()) return toast('Name required');
    E.inc = +E.inc || 0;
    if (E.inc < 0) return toast("Increment can't be negative");
    E.mode = E.mode == 'pct' ? 'pct' : 'rir';
    if (E.bwl) E.bwl = true;
    else delete E.bwl;
    E.lo ||= 8;
    E.hi ||= Math.max(E.lo, 12);
    E.rir ??= 2;
    if (E.hi < E.lo) return toast('Reps max must be at least reps min');
    E.wu = Math.min(4, Math.max(0, Math.round(+E.wu || 0)));
    if (!E.wu) delete E.wu;
    const cur = +E.cur || 0;
    delete E.cur;
    if (E.pb === '' || E.pb == null || !(+E.pb > 0)) delete E.pb;
    else E.pb = +E.pb;
    if (cur > 0 && !(E.pb >= cur)) E.pb = cur; // PB can't be below your current 1RM
    const id = await put('exercises', E);
    if (cur > 0 && cur !== S.pr[id]?.w) await put('pr_history', { exId: id, w: cur, t: Date.now() });
    await load();
    back();
  },
  exDel: async () => {
    if (!confirm('Delete exercise with its PRs and set history?')) return;
    for (const s of await all('sets', 'ex', E.id)) await del('sets', s.id);
    for (const p of await all('pr_history', 'ex', E.id)) await del('pr_history', p.id);
    await del('exercises', E.id);
    await load();
    back();
  },
  prAdd: async () => {
    const w = +$('#prw').value,
      d = $('#prd').value;
    if (!(w > 0)) return toast('Enter the tested weight');
    await put('pr_history', { exId: E.id, w, t: new Date(d + 'T12:00').getTime() });
    const ex = EX(E.id);
    if (ex && w > (ex.pb || 0)) await put('exercises', { ...ex, pb: w });
    await loadEx(E.id);
    E.pb = EX(E.id)?.pb;
    E.cur = S.pr[E.id]?.w ?? '';
    render();
  },
  prDel: async (s, d) => {
    await del('pr_history', +d.i);
    await loadEx(E.id);
    E.cur = S.pr[E.id]?.w ?? '';
    render();
  },
  calnav: (s, d) => {
    let m = CAL.m + +d.d,
      y = CAL.y;
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    CAL.m = m;
    CAL.y = y;
    CAL.sel = null;
    render();
  },
  caltoday: () => {
    const n = new Date();
    CAL.y = n.getFullYear();
    CAL.m = n.getMonth();
    CAL.sel = null;
    render();
  },
  calday: (s, d) => {
    CAL.sel = CAL.sel == d.k ? null : d.k;
    render();
  },
  wedOpen: (s, d) => wedOpen(+d.i),
  wedCancel: () => {
    WE = null;
    back();
  },
  wedSave: () => wedSave(),
  wedRm: (s, d) => {
    WE.items[+d.k].rows.splice(+d.j, 1);
    render();
  },
  wedWu: (s, d) => {
    const r = WE.items[+d.k].rows[+d.j];
    r.wu = !r.wu;
    render();
  },
  wedRmx: (s, d) => {
    WE.items.splice(+d.k, 1);
    render();
  },
  wedAddSet: (s, d) => {
    const rs = WE.items[+d.k].rows,
      l = rs.filter(x => !x.wu).pop() || rs[rs.length - 1] || {};
    rs.push({ w: l.w ?? '', r: l.r ?? '', rir: l.rir ?? '', wu: false });
    render();
  },
  wedAdd: (s, d) => {
    WE.items.push({ exId: +d.x, rows: [{ w: '', r: '', rir: '', wu: false }] });
    WQ = '';
    render();
    const q = $('#wq');
    if (q) {
      q.scrollIntoView({ block: 'center' });
    }
  },
  wedAddNew: async () => {
    const id = await newEx($('#wq').value);
    if (id) A.wedAdd(null, { x: id });
  },
  wdel: async (s, d) => {
    if (!confirm('Delete this workout?')) return;
    for (const x of S.sets.filter(x => x.sess == d.i)) await del('sets', x.id);
    await load();
    render();
  },
  sdel: async (s, d) => {
    await del('sets', +d.i);
    await loadEx(E.id);
  },
  tplNew: () => {
    TQ = { k: null, q: '' };
    TR = null;
    E = { name: '', weeks: 8, days: [{ name: 'Day 1', items: [] }] };
    S.view = { t: 'tple' };
    render();
  },
  tplEdit: (s, d) => {
    TQ = { k: null, q: '' };
    TR = null;
    E = structuredClone(S.tpl.find(t => t.id == d.i));
    S.view = { t: 'tple' };
    render();
  },
  tplAdd: (s, d) => {
    if (!S.ex.length) return toast('Create an exercise first');
    E.days[+d.i].items.push({ exId: S.ex[0].id, n: 3, text: '' });
    render();
  },
  tplDelItem: (s, d) => {
    E.days[+d.k].items.splice(+d.i, 1);
    render();
  },
  tplSave: async () => {
    if (!E.name.trim()) return toast('Name required');
    E.weeks = Math.min(52, Math.max(1, Math.round(+E.weeks || 8)));
    for (const dy of E.days) {
      if (!dy.name.trim()) dy.name = 'Day';
      for (const it of dy.items) {
        const x = EX(it.exId),
          nm = x?.name || 'an exercise';
        delete it.text;
        if (it.mode != 'pct') {
          delete it.lines;
          const pk = (a, b) => (a === '' || a == null ? b : a);
          it.n = Math.round(+pk(it.n, 3));
          it.lo = Math.round(+pk(it.lo, x?.lo ?? 8));
          it.hi = Math.round(+pk(it.hi, x?.hi ?? 12));
          it.rirW = rirWeeks(it, E.weeks, x).map(v => (v === '' || v == null ? (x?.rir ?? 2) : +v));
          delete it.rir;
          if (!(it.n >= 1 && it.n <= 20 && it.lo >= 1 && it.hi >= it.lo && it.hi <= 50))
            return toast(`Check ${nm}: sets 1–20, and reps min ≤ reps max`);
          if (!it.rirW.every(v => v >= 0 && v <= 10))
            return toast(`Check ${nm}: target RIR must be 0–10 each week`);
          continue;
        }
        for (const l of it.lines || []) {
          l.n = Math.round(+l.n);
          l.r = Math.round(+l.r);
          l.p = +l.p;
          delete l.rpe;
          if (!(l.n >= 1 && l.n <= 20 && l.r >= 1 && l.r <= 50 && l.p > 0 && l.p <= 150))
            return toast(`Check the % lines for ${nm}: sets 1–20, reps 1–50, % up to 150`);
        }
      }
    }
    await put('templates', E);
    await load();
    back();
  },
  tplDel: async () => {
    if (confirm('Delete this plan?')) {
      await del('templates', E.id);
      await load();
      back();
    }
  },
};
