/* Turning numbers and dates into text. Pure functions, no DOM. */

// A number for display: at most 2 decimals, no trailing zeros; '' for empty or invalid input.
const fmt = x => (x === '' || x == null || isNaN(x) ? '' : +(+x).toFixed(2));

const ageText = t => {
  const days = Math.floor((Date.now() - t) / 864e5);
  return days < 1 ? 'today' : days < 60 ? days + 'd ago' : Math.round(days / 30.4) + 'mo ago';
};

const dateText = t =>
  new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// 0 kg on the bar means a bodyweight set.
const weightLabel = w => (w > 0 ? fmt(w) : 'BW');

// RIR is stored as a number; 6 means "5+" (more than 5 reps left). RPE = 10 − RIR.
const rirLabel = v => (v == null || v === '' ? '' : +v > 5 ? '5+' : fmt(v));
const rpeLabel = v => (v == null || v === '' ? '' : +v > 5 ? '<5' : fmt(10 - v));
