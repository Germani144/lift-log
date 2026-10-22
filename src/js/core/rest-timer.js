/* ---------- rest timer ---------- */
let AC,
  alarmedFor = 0;
const fmtT = x => Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0');
function restText() {
  const rem = W.restEnd ? W.restEnd - Date.now() : 0;
  return W.restEnd && rem <= 0 ? 'Go!' : fmtT(W.restEnd ? Math.ceil(rem / 1000) : W.rest);
}
function restCls() {
  return 'rt' + (W.restEnd ? (W.restEnd - Date.now() > 0 ? ' run' : ' go') : '');
}
const rbw = () => {
  const rem = W.restEnd ? W.restEnd - Date.now() : 0;
  return rem > 0 ? Math.min(100, (rem / (W.rest * 1000)) * 100).toFixed(1) + '%' : '0%';
};
const elapsed = () => {
  const x = Math.floor((Date.now() - W.sess) / 1000);
  return x >= 0 && x < 21600 ? fmtT(x) : '';
};
const restBar = () =>
  `<div class=rest><div class=rb><i id=rbi style="width:${rbw()}"></i></div><div class=rr><button class=s data-a=rdec>−15</button><button id=rt class="${restCls()}" data-a=redit>${restText()}</button><button class=s data-a=rinc>+15</button><button class=s data-a=rstop aria-label="Stop timer">✕</button></div></div>`;
function startRest() {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    AC.resume?.();
  } catch {}
  W.restEnd = Date.now() + (W.rest || 120) * 1000;
  saveW();
}
function alarm() {
  try {
    navigator.vibrate?.([250, 120, 250]);
  } catch {}
  try {
    if (!AC) return;
    const o = AC.createOscillator(),
      g = AC.createGain();
    o.connect(g);
    g.connect(AC.destination);
    o.frequency.value = 880;
    g.gain.value = 0.25;
    o.start();
    o.stop(AC.currentTime + 0.6);
  } catch {}
}
function setRest(n) {
  n = Math.min(1800, Math.max(15, n));
  const d = n - W.rest;
  W.rest = n;
  if (W.restEnd && W.restEnd > Date.now()) W.restEnd += d * 1000;
  ls('rest', n);
  saveW();
  tickRest();
}
function tickRest() {
  if (!W) return;
  if (W.restEnd) {
    const rem = W.restEnd - Date.now();
    if (rem <= 0 && rem > -4000 && alarmedFor !== W.restEnd) {
      alarmedFor = W.restEnd;
      alarm();
    }
  }
  const b = $('#rt');
  if (b) {
    b.textContent = restText();
    b.className = restCls();
  }
  const bi = $('#rbi');
  if (bi) bi.style.width = rbw();
  const el = $('#el');
  if (el) el.textContent = elapsed();
}
setInterval(tickRest, 250);
