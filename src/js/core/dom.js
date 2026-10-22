/* Small DOM helpers. */

const $ = (selector, root = document) => root.querySelector(selector),
  app = $('#app');

// Escape text before putting it into HTML (every name you type goes through this).
const esc = s =>
  String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// The page scrolls inside <main>, not the window.
const scrollMainTo = (x, y) => {
    const m = $('main');
    if (m) m.scrollTop = y;
  },
  mainScrollY = () => $('main')?.scrollTop || 0;

let toastTimer;
const toast = message => {
  const t = $('#toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4000);
};
