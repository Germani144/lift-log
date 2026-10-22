const exercisesByName = () =>
  state.ex.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
/* ---------- type-to-find exercises (like Home log): most-used chips when empty, ranked matches while typing ---------- */
let planAddSearch = { k: null, q: '' },
  pickerShowAll = false,
  planReplace = null; // TR: plan item being replaced {k,j,q}   // plan-editor search (day index + text); picker "show all" toggle
function matchExercises(q, skip) {
  const u = {};
  for (const x of state.sets) u[x.exId] = (u[x.exId] || 0) + 1;
  const l = state.ex.filter(e => e.id != skip),
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
function exerciseSuggestions(q, skip, go, mk) {
  const l = matchExercises(q, skip),
    t = q.trim();
  if (!t)
    return l.length
      ? `<div class=chips>${l.map(e => `<button class=chip ${go(e)}>${esc(e.name)}</button>`).join('')}</div>`
      : '';
  const exact = state.ex.some(e => e.name.toLowerCase() == t.toLowerCase());
  return `<div class=sugg>${l.map(e => `<button class=sg ${go(e)}><span>${esc(e.name)}</span><span class=m>${e.inc > 0 ? `${e.lo}–${e.hi} reps` : 'bodyweight'}</span></button>`).join('')}${exact ? '' : `<button class="sg new" ${mk}>＋ New exercise “${esc(t.slice(0, 80))}”</button>`}</div>`;
}
const pickerResults = () => {
  const skip = picker.t == 'rep' ? workout.items[picker.i]?.exId : null;
  return (
    exerciseSuggestions(pickerQuery, skip, e => `data-a=pickGo data-x=${e.id}`, 'data-a=pickNew') +
    (pickerQuery.trim()
      ? ''
      : pickerShowAll
        ? `<div style="margin-top:8px">${pickerFullList()}</div>`
        : `<button class=lk data-a=pickAll>Show all exercises</button>`)
  );
};
const planReplaceResults = () => {
  const it = draft.days[planReplace.k].items[planReplace.j];
  return exerciseSuggestions(planReplace.q, it.exId, e => `data-a=tplSet data-x=${e.id}`, 'data-a=tplSetNew');
};
const planAddResults = k =>
  exerciseSuggestions(
    planAddSearch.k == k ? planAddSearch.q : '',
    null,
    e => `data-a=tplPick data-k=${k} data-x=${e.id}`,
    `data-a=tplPickNew data-k=${k}`,
  );
const createExercise = async name => {
  name = name.trim().slice(0, 80);
  if (!name) return null;
  const id = await dbPut('exercises', { name, mode: 'rir', inc: 2, lo: 8, hi: 12, rir: 2 });
  await loadState();
  toast(`Created ${name}: RIR, 8–12 reps, 2 kg steps. Change it in Exercises.`);
  return id;
};
function pickerFullList() {
  const q = pickerQuery.trim().toLowerCase(),
    skip = picker.t == 'rep' ? workout.items[picker.i]?.exId : null,
    l = exercisesByName().filter(e => e.id != skip && e.name.toLowerCase().includes(q));
  return (
    l
      .map(
        e =>
          `<button class="b big" data-a=pickGo data-x=${e.id}>${esc(e.name)}<small>${e.inc > 0 ? `${e.lo}–${e.hi} reps` : 'bodyweight'}</small></button>`,
      )
      .join('') || '<p class=m>No exercise matches.</p>'
  );
}
