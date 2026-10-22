/* ---------- boot / PWA ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
  navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).catch(() => {});
navigator.storage?.persist?.();
$('#sver').textContent = 'v' + VER;
const hideSplash = () => {
  const e = $('#splash');
  if (!e) return;
  e.classList.add('out');
  setTimeout(() => e.remove(), 500);
};
setTimeout(hideSplash, 5000);
openDatabase()
  .then(async d => {
    db = d;
    await loadState();
    render();
    setTimeout(hideSplash, Math.max(0, 1000 - performance.now()));
    if (githubConfig() && lsGet('dirty') != '0') setTimeout(autoBackup, 3000);
  })
  .catch(e => {
    hideSplash();
    app.innerHTML = '<main><p class=wr>IndexedDB is unavailable: ' + esc(e.message || e) + '</p></main>';
  });
