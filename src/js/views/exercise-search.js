const sortedEx = () =>
  S.ex.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
/* ---------- type-to-find exercises (like Home log): most-used chips when empty, ranked matches while typing ---------- */
let TQ = { k: null, q: '' },
  PALL = false,
  TR = null; // TR: plan item being replaced {k,j,q}   // plan-editor search (day index + text); picker "show all" toggle
function exMatches(q, skip) {
  const u = {};
  for (const x of S.sets) u[x.exId] = (u[x.exId] || 0) + 1;
  const l = S.ex.filter(e => e.id != skip),
    nm = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  q = q.trim().toLowerCase();
  if (!q)
    return [
      ...l.filter(e => u[e.id]).sort((a, b) => u[b.id] - u[a.id] || nm(a, b)),
      ...l.filter(e => !u[e.id]).sort(nm),
    ].slice(0, 8);
  const tier = e => {
    const n = e.name.toLowerCase();
    return n.startsWith(q) ? 0 : n.split(/[\s\-(/]+/).some(w => w.startsWith(q)) ? 1 : n.includes(q) ? 2 : 9;
  };
  return l
    .map(e => [e, tier(e)])
    .filter(x => x[1] < 9)
    .sort((a, b) => a[1] - b[1] || (u[b[0].id] || 0) - (u[a[0].id] || 0) || nm(a[0], b[0]))
    .slice(0, 8)
    .map(x => x[0]);
}
function exSugg(q, skip, go, mk) {
  const l = exMatches(q, skip),
    t = q.trim();
  if (!t)
    return l.length
      ? `<div class=chips>${l.map(e => `<button class=chip ${go(e)}>${esc(e.name)}</button>`).join('')}</div>`
      : '';
  const exact = S.ex.some(e => e.name.toLowerCase() == t.toLowerCase());
  return `<div class=sugg>${l.map(e => `<button class=sg ${go(e)}><span>${esc(e.name)}</span><span class=m>${e.inc > 0 ? `${e.lo}–${e.hi} reps` : 'bodyweight'}</span></button>`).join('')}${exact ? '' : `<button class="sg new" ${mk}>＋ New exercise “${esc(t.slice(0, 80))}”</button>`}</div>`;
}
const pickBox = () => {
  const skip = PICK.t == 'rep' ? W.items[PICK.i]?.exId : null;
  return (
    exSugg(PQ, skip, e => `data-a=pickGo data-x=${e.id}`, 'data-a=pickNew') +
    (PQ.trim()
      ? ''
      : PALL
        ? `<div style="margin-top:8px">${pickList()}</div>`
        : `<button class=lk data-a=pickAll>Show all exercises</button>`)
  );
};
const trBox = () => {
  const it = E.days[TR.k].items[TR.j];
  return exSugg(TR.q, it.exId, e => `data-a=tplSet data-x=${e.id}`, 'data-a=tplSetNew');
};
const tqBox = k =>
  exSugg(
    TQ.k == k ? TQ.q : '',
    null,
    e => `data-a=tplPick data-k=${k} data-x=${e.id}`,
    `data-a=tplPickNew data-k=${k}`,
  );
const newEx = async name => {
  name = name.trim().slice(0, 80);
  if (!name) return null;
  const id = await put('exercises', { name, mode: 'rir', inc: 2, lo: 8, hi: 12, rir: 2 });
  await load();
  toast(`Created ${name}: RIR, 8–12 reps, 2 kg steps. Change it in Exercises.`);
  return id;
};
function pickList() {
  const q = PQ.trim().toLowerCase(),
    skip = PICK.t == 'rep' ? W.items[PICK.i]?.exId : null,
    l = sortedEx().filter(e => e.id != skip && e.name.toLowerCase().includes(q));
  return (
    l
      .map(
        e =>
          `<button class="b big" data-a=pickGo data-x=${e.id}>${esc(e.name)}<small>${e.inc > 0 ? `${e.lo}–${e.hi} reps` : 'bodyweight'}</small></button>`,
      )
      .join('') || '<p class=m>No exercise matches.</p>'
  );
}
