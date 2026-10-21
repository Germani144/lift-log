const VER='2.8';   // app version, kept equal to index.html by tools/build.py (read by "Check for updates")
const C='lift-log-dc91c85bff';
// Every app on germani144.github.io shares one CacheStorage. This worker only ever touches caches whose
// name starts with its own prefix ("liftlog-" was this app's old prefix), and only requests inside its scope.
const OWN=['lift-log-','liftlog-'];
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png','./fonts/barlow-condensed-latin-600-normal.woff2','./fonts/barlow-condensed-latin-700-normal.woff2','./fonts/barlow-latin-400-normal.woff2','./fonts/barlow-latin-500-normal.woff2','./fonts/barlow-latin-600-normal.woff2','./fonts/barlow-latin-700-normal.woff2'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&OWN.some(p=>x.startsWith(p))).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
// Network first (so a new deploy shows up on the next open), this app's own cached copy when offline.
// Requests outside this app's scope (other apps, the GitHub API for backups) are never touched.
self.addEventListener('fetch',e=>{const q=e.request;if(q.method!='GET'||q.cache=='no-store'||!q.url.startsWith(self.registration.scope))return;   // no-store = the update check: straight to the server
 e.respondWith(fetch(q,{cache:'no-cache'}).then(r=>{if(r.ok){const c=r.clone();caches.open(C).then(x=>x.put(q,c))}return r})
  .catch(async()=>{const c=await caches.open(C);return(await c.match(q))||(q.mode=='navigate'&&await c.match('./index.html'))||Response.error()}))});
