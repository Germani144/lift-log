const $ = (s, e = document) => e.querySelector(s),
  app = $('#app');
const esc = s =>
  String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const scTo = (x, y) => {
    const m = $('main');
    if (m) m.scrollTop = y;
  },
  scY = () => $('main')?.scrollTop || 0; // the page scrolls inside <main>, not the window
const fmt = x => (x === '' || x == null || isNaN(x) ? '' : +(+x).toFixed(2));
const age = t => {
  const d = Math.floor((Date.now() - t) / 864e5);
  return d < 1 ? 'today' : d < 60 ? d + 'd ago' : Math.round(d / 30.4) + 'mo ago';
};
const dstr = t =>
  new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
let tt;
const toast = m => {
  const t = $('#toast');
  t.textContent = m;
  t.hidden = false;
  clearTimeout(tt);
  tt = setTimeout(() => (t.hidden = true), 4000);
};
