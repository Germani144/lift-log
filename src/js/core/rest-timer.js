/* Rest timer between sets. It starts when you log a set, beeps and vibrates when time's up, and survives
   closing the app (the end time is saved with the workout). The bar at the bottom of the workout screen. */
let audioCtx,
  alarmedAt = 0;
const clockText = x => Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0');
function restText() {
  const rem = workout.restEnd ? workout.restEnd - Date.now() : 0;
  return workout.restEnd && rem <= 0
    ? 'Go!'
    : clockText(workout.restEnd ? Math.ceil(rem / 1000) : workout.rest);
}
function restClass() {
  return 'rt' + (workout.restEnd ? (workout.restEnd - Date.now() > 0 ? ' run' : ' go') : '');
}
const restBarWidth = () => {
  const rem = workout.restEnd ? workout.restEnd - Date.now() : 0;
  return rem > 0 ? Math.min(100, (rem / (workout.rest * 1000)) * 100).toFixed(1) + '%' : '0%';
};
const elapsedText = () => {
  const x = Math.floor((Date.now() - workout.sess) / 1000);
  return x >= 0 && x < 21600 ? clockText(x) : '';
};
const restTimerBar = () =>
  `<div class=rest><div class=rb><i id=rbi style="width:${restBarWidth()}"></i></div><div class=rr><button class=s data-a=rdec>−15</button><button id=rt class="${restClass()}" data-a=redit>${restText()}</button><button class=s data-a=rinc>+15</button><button class=s data-a=rstop aria-label="Stop timer">✕</button></div></div>`;
function startRest() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume?.();
  } catch {}
  workout.restEnd = Date.now() + (workout.rest || 120) * 1000;
  saveWorkout();
}
function alarm() {
  try {
    navigator.vibrate?.([250, 120, 250]);
  } catch {}
  try {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(),
      g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.25;
    o.start();
    o.stop(audioCtx.currentTime + 0.6);
  } catch {}
}
function setRest(n) {
  n = Math.min(1800, Math.max(15, n));
  const d = n - workout.rest;
  workout.rest = n;
  if (workout.restEnd && workout.restEnd > Date.now()) workout.restEnd += d * 1000;
  lsSet('rest', n);
  saveWorkout();
  tickRest();
}
function tickRest() {
  if (!workout) return;
  if (workout.restEnd) {
    const rem = workout.restEnd - Date.now();
    if (rem <= 0 && rem > -4000 && alarmedAt !== workout.restEnd) {
      alarmedAt = workout.restEnd;
      alarm();
    }
  }
  const b = $('#rt');
  if (b) {
    b.textContent = restText();
    b.className = restClass();
  }
  const bi = $('#rbi');
  if (bi) bi.style.width = restBarWidth();
  const el = $('#el');
  if (el) el.textContent = elapsedText();
}
setInterval(tickRest, 250);
