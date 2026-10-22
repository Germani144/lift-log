/* ---------- events ---------- */
const setPath = (o, p, v) => {
  const k = p.split('.'),
    l = k.pop();
  k.forEach(x => (o = o[x]));
  o[l] = v;
};
app.addEventListener('input', e => {
  const t = e.target,
    s = t.closest('.set');
  if (WE && S.view?.t == 'wed') {
    if (t.dataset.wf != null) {
      const e = t.closest('.eset');
      WE.items[e.dataset.k].rows[e.dataset.j][t.dataset.wf] = t.value === '' ? '' : +t.value;
      if (t.tagName == 'SELECT') t.classList.toggle('ph', t.value === '');
      return;
    }
    if (t.dataset.wn != null) {
      WE.wn = t.value;
      return;
    }
    if (t.dataset.wd != null) {
      WE.date = t.value;
      return;
    }
    if (t.id == 'wq') {
      WQ = t.value;
      $('#wqs').innerHTML = wqBox();
      return;
    }
  }
  if (t.id == 'bwi') {
    const v = +t.value;
    if (t.value === '') {
      ls('bw', '');
      touch();
    } else if (v >= 20 && v <= 400) {
      ls('bw', v);
      touch();
    }
    $('#bmi').innerHTML = bmiTxt();
    return;
  }
  if (t.id == 'hti') {
    const v = +t.value;
    if (t.value === '') {
      ls('ht', '');
      touch();
    } else if (v >= 100 && v <= 250) {
      ls('ht', v);
      touch();
    }
    $('#bmi').innerHTML = bmiTxt();
    return;
  }
  if (t.id == 'exq') {
    EQ = t.value;
    let any = false;
    document.querySelectorAll('.exr').forEach(b => {
      const h = exHit(b.dataset.q);
      b.hidden = !h;
      any ||= h;
    });
    $('#exnone').hidden = any;
    return;
  }
  if (t.id == 'pq') {
    PQ = t.value;
    $('#plist').innerHTML = pickBox();
    return;
  }
  if (t.dataset.tr != null && TR) {
    TR.q = t.value;
    $('#trs').innerHTML = trBox();
    return;
  }
  if (t.dataset.tq != null) {
    TQ = { k: +t.dataset.tq, q: t.value };
    $('#tqs' + t.dataset.tq).innerHTML = tqBox(TQ.k);
    return;
  }
  if (s && t.dataset.f) {
    const r = W.items[s.dataset.i].rows[s.dataset.j],
      f = t.dataset.f;
    const it = W.items[s.dataset.i],
      v = t.value === '' ? '' : +t.value;
    r.auto = false;
    delete r.adj;
    if (it.mode == 'pct' && f == 'w')
      r.w = v === '' ? '' : it.ref > 0 ? Math.max(0, (v / 100) * it.ref - (it.bwo || 0)) : '';
    else r[f] = v;
    if (t.tagName == 'SELECT') t.classList.toggle('ph', t.value === '');
    saveW();
    updInfo(s);
  } else if (t.dataset.b && E) {
    setPath(
      E,
      t.dataset.b,
      t.type == 'checkbox' ? t.checked : t.dataset.n != null ? (t.value === '' ? '' : +t.value) : t.value,
    );
    if (t.type == 'checkbox') render();
  }
});
app.addEventListener('change', e => {
  if (e.target.id == 'imp') importData(e.target.files[0]);
  else if (e.target.dataset.dpw != null) resizeDays(+e.target.value);
  else if (e.target.dataset.rr != null) render();
});
app.addEventListener('focusin', e => {
  const t = e.target;
  if (t.dataset?.tq == null || TQ.k === +t.dataset.tq) return;
  const old = TQ.k;
  TQ = { k: +t.dataset.tq, q: t.value };
  if (old != null) {
    const ob = $('#tqs' + old);
    if (ob) ob.innerHTML = '';
  }
  $('#tqs' + TQ.k).innerHTML = tqBox(TQ.k);
});
app.addEventListener('keydown', e => {
  if (e.key != 'Enter') return;
  const t = e.target,
    box =
      t.id == 'pq'
        ? $('#plist')
        : t.id == 'wq'
          ? $('#wqs')
          : t.dataset?.tr != null
            ? $('#trs')
            : t.dataset?.tq != null
              ? $('#tqs' + t.dataset.tq)
              : null;
  if (!box) return;
  e.preventDefault();
  box.querySelector('.sg,.chip')?.click();
});
app.addEventListener('submit', e => {
  if (e.target.id == 'ghf') {
    e.preventDefault();
    A.ghSave();
  }
});
const TABS = ['train', 'hist', 'tpl', 'ex'],
  TN = { train: 'Train', hist: 'History', tpl: 'Plans', ex: 'Exercises' };
let sx,
  sy,
  sm,
  sd,
  SL = 0;
const TH = 70;
const hint = () => {
  let h = $('#sh');
  if (!h) {
    h = document.createElement('div');
    h.id = 'sh';
    document.body.appendChild(h);
  }
  return h;
};
const swEnd = () => {
  const m = $('main');
  if (m) {
    m.style.transition = 'transform .18s,opacity .18s';
    m.style.transform = '';
    m.style.opacity = '';
  }
  $('#sh')?.remove();
  document.querySelectorAll('nav button.nx').forEach(x => x.classList.remove('nx'));
  sm = 0;
};
document.addEventListener(
  'touchstart',
  e => {
    sm = 0;
    if (e.touches.length != 1 || S.view || e.target.closest('input,textarea,select,nav,[data-noswipe]'))
      return;
    const t = e.touches[0];
    sx = t.clientX;
    sy = t.clientY;
    sm = 1;
    sd = 0;
    const m = $('main');
    if (m) m.style.transition = 'none';
  },
  { passive: true },
);
document.addEventListener(
  'touchmove',
  e => {
    if (!sm) return;
    const t = e.touches[0],
      dx = t.clientX - sx,
      dy = t.clientY - sy;
    if (sm == 1) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        sm = 0;
        return;
      }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      sm = 2;
    }
    const i = TABS.indexOf(S.tab),
      j = i + (dx < 0 ? 1 : -1),
      ok = j >= 0 && j < TABS.length,
      m = $('main');
    if (!m) return;
    const k = Math.min(1, Math.abs(dx) / TH);
    sd = ok ? dx : 0;
    m.style.transform = `translateX(${dx * (ok ? 0.55 : 0.15)}px)`;
    m.style.opacity = ok ? 1 - 0.35 * k : 1;
    document
      .querySelectorAll('nav button')
      .forEach((x, n) => x.classList.toggle('nx', ok && n == j && k >= 1));
    const h = hint();
    if (ok) {
      h.textContent = (dx < 0 ? '' : '‹ ') + TN[TABS[j]] + (dx < 0 ? ' ›' : '');
      h.className = (dx < 0 ? 'r ' : 'l ') + (k >= 1 ? 'go' : '');
      h.style.opacity = Math.min(1, k * 1.4);
    } else h.style.opacity = 0;
  },
  { passive: true },
);
document.addEventListener(
  'touchend',
  e => {
    if (sm != 2) {
      sm = 0;
      return;
    }
    const dx = sd,
      i = TABS.indexOf(S.tab),
      j = i + (dx < 0 ? 1 : -1);
    if (Math.abs(dx) >= TH && j >= 0 && j < TABS.length) {
      $('#sh')?.remove();
      sm = 0;
      SL = dx < 0 ? 1 : -1;
      A.tab(null, { i: TABS[j] });
    } else swEnd();
  },
  { passive: true },
);
document.addEventListener('touchcancel', swEnd, { passive: true });
app.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (b && !b.disabled) A[b.dataset.a]?.(b.closest('.set'), b.dataset);
});
