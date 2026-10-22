const $ = (s, e = document) => e.querySelector(s),
  app = $('#app');
const esc = s =>
  String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const scrollMainTo = (x, y) => {
    const m = $('main');
    if (m) m.scrollTop = y;
  },
  mainScrollY = () => $('main')?.scrollTop || 0; // the page scrolls inside <main>, not the window
const fmt = x => (x === '' || x == null || isNaN(x) ? '' : +(+x).toFixed(2));
const ageText = t => {
  const d = Math.floor((Date.now() - t) / 864e5);
  return d < 1 ? 'today' : d < 60 ? d + 'd ago' : Math.round(d / 30.4) + 'mo ago';
};
const dateText = t =>
  new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
let toastTimer;
const toast = m => {
  const t = $('#toast');
  t.textContent = m;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4000);
};
