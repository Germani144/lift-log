/* ---------- phone back gesture / back button: close the open page instead of leaving the app ---------- */
const depth = () => (S.view || PICK || (W && !LAND && S.tab == 'train') ? 1 : 0);
let popping = false;
function navSync() {
  const d = depth(),
    cur = history.state?.ll || 0;
  if (d && !cur) history.pushState({ ll: 1 }, '');
  else if (!d && cur) {
    popping = true;
    history.back();
  }
}
addEventListener('popstate', () => {
  if (popping) {
    popping = false;
    return;
  }
  if (!depth()) return;
  if (PICK) A.pickCancel();
  else if (S.view) A.back();
  else A.toLanding();
});
try {
  history.replaceState({ ll: 0 }, '');
} catch {}

// The bottom bar is built once and kept; only <main> is redrawn. Rebuilding the bar on every
// render made it flicker on tab changes (the phone repainted it after long pages like History).
let RV = '',
  LY = 0;
function render() {
  const v = S.view?.t,
    body =
      v == 'exd'
        ? rExd()
        : v == 'tple'
          ? rTple()
          : v == 'wed'
            ? rWed()
            : v == 'set'
              ? rSet()
              : { train: rTrain, hist: rHist, tpl: rTpl, ex: rEx }[S.tab]();
  let m = $('main', app),
    nav = $('nav', app);
  if (!m || !nav) {
    app.innerHTML = `<main></main><nav>${[
      ['train', 'Train'],
      ['hist', 'History'],
      ['tpl', 'Plans'],
      ['ex', 'Exercises'],
    ]
      .map(([k, l]) => `<button data-a=tab data-i=${k}>${NI[k]}${l}</button>`)
      .join('')}</nav>`;
    m = $('main', app);
    nav = $('nav', app);
  }
  m.removeAttribute('style');
  m.className = '';
  if (SL) {
    void m.offsetWidth;
    m.className = 'sl' + (SL > 0 ? 'r' : 'l');
  } // restart the slide-in animation
  const vk = S.view ? S.view.t : '',
    open = vk && !RV,
    close = !vk && RV;
  if (open) LY = m.scrollTop;
  m.innerHTML = body;
  if (open) m.scrollTop = 0;
  else if (close) m.scrollTop = LY;
  RV = vk; // pages open at the top; Back returns to where you were in the list
  nav.querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.i == S.tab);
    b.classList.remove('nx');
  });
  SL = 0;
  navSync();
}
