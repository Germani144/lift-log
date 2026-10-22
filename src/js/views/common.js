const bb = (n, done, cur, label) =>
  `<div class=bb role=img aria-label="${esc(label)}"><i class="pl pb"></i><i class="pl pr"></i><i class=sl></i><div class=shaft>${Array.from({ length: n }, (_, i) => `<i${i < done ? ' class=d' : cur && i == done ? ' class=n' : ''}></i>`).join('')}</div><i class=sl></i><i class="pl pr"></i><i class="pl pb"></i></div>`;
const NI = {
  train: '<svg viewBox="0 0 24 24"><path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12"/></svg>',
  hist: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  tpl: '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  ex: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
};
function rirSel(attrs, v, { pct = false, max5 = false, blank = true } = {}) {
  const cur = v === '' || v == null ? '' : +v,
    vals = (max5 ? RIRS.filter(x => x <= 5) : RIRS).slice();
  if (cur !== '' && !vals.includes(cur)) {
    vals.push(cur);
    vals.sort((a, b) => a - b);
  }
  return `<select ${attrs} class="pick${cur === '' ? ' ph' : ''}">${blank ? `<option value=""${cur === '' ? ' selected' : ''}>${pct ? 'RPE' : 'RIR'}</option>` : ''}${(pct ? vals.slice().reverse() : vals).map(x => `<option value="${x}"${x === cur ? ' selected' : ''}>${pct ? rpeTxt(x) : rirTxt(x)}</option>`).join('')}</select>`;
}
/* ---------- views ---------- */
const opts = id =>
  S.ex.map(x => `<option value="${x.id}" ${x.id == id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');

const COG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const ttl = t =>
  `<div class=hd><h2>${t}</h2><button class=cog data-a=settings aria-label="Settings">${COG}</button></div>`; // every tab's title row, with the settings cog
