/* ---------- phone back gesture / back button: close the open page instead of leaving the app ---------- */
const pageDepth = () => (state.view || picker || (workout && !showTrainHome && state.tab == 'train') ? 1 : 0);
let ignoreNextPop = false;
function syncBackGesture() {
  const d = pageDepth(),
    cur = history.state?.ll || 0;
  if (d && !cur) history.pushState({ ll: 1 }, '');
  else if (!d && cur) {
    ignoreNextPop = true;
    history.back();
  }
}
addEventListener('popstate', () => {
  if (ignoreNextPop) {
    ignoreNextPop = false;
    return;
  }
  if (!pageDepth()) return;
  if (picker) actions.pickCancel();
  else if (state.view) actions.back();
  else actions.toLanding();
});
try {
  history.replaceState({ ll: 0 }, '');
} catch {}

// The bottom bar is built once and kept; only <main> is redrawn. Rebuilding the bar on every
// render made it flicker on tab changes (the phone repainted it after long pages like History).
let renderedPage = '',
  listScrollY = 0;
function render() {
  const v = state.view?.t,
    body =
      v == 'exd'
        ? renderExerciseDetail()
        : v == 'tple'
          ? renderPlanEditor()
          : v == 'wed'
            ? renderWorkoutEditor()
            : v == 'set'
              ? renderSettings()
              : { train: renderTrain, hist: renderHistory, tpl: renderPlans, ex: renderExercises }[
                  state.tab
                ]();
  let m = $('main', app),
    nav = $('nav', app);
  if (!m || !nav) {
    app.innerHTML = `<main></main><nav>${[
      ['train', 'Train'],
      ['hist', 'History'],
      ['tpl', 'Plans'],
      ['ex', 'Exercises'],
    ]
      .map(([k, l]) => `<button data-a=tab data-i=${k}>${NAV_ICONS[k]}${l}</button>`)
      .join('')}</nav>`;
    m = $('main', app);
    nav = $('nav', app);
  }
  m.removeAttribute('style');
  m.className = '';
  if (slideDir) {
    void m.offsetWidth;
    m.className = 'sl' + (slideDir > 0 ? 'r' : 'l');
  } // restart the slide-in animation
  const vk = state.view ? state.view.t : '',
    open = vk && !renderedPage,
    close = !vk && renderedPage;
  if (open) listScrollY = m.scrollTop;
  m.innerHTML = body;
  if (open) m.scrollTop = 0;
  else if (close) m.scrollTop = listScrollY;
  renderedPage = vk; // pages open at the top; Back returns to where you were in the list
  nav.querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.i == state.tab);
    b.classList.remove('nx');
  });
  slideDir = 0;
  syncBackGesture();
}
