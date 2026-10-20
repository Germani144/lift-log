# Working on Lift Log

- This repo is Lift Log only. Don't attach or edit other repos (cart-log, nap-log) from a Lift Log chat.
- After any edit to app files: `python3 tools/build.py`, then `python3 tests/run.py`. Don't push if either fails.
- Keep the README up to date: whenever a change adds, removes or changes a feature, a setting, the build/test steps or the backup setup, update README.md in the same commit.
- Add or adjust a test in `tests/run.py` for new behaviour.
- The user tests on an Android phone; after pushing, tell them the new version number (e.g. v1.4, from `tools/build.py` output) and to close the app from recent apps and reopen it to pick up the update.
- Versions: `tools/build.py` bumps the minor number (v1.4 -> v1.5) on every app change. Claude decides when to go to the next major (set `const VER='2.0';` by hand; the build keeps it): a big redesign, a change in how the app is used day to day, or a change to the data/backup format that older versions can't read. Fixes and normal features stay minor.

## Shared origin (all of Pedro's apps live on germani144.github.io)

Every app is served from the same origin, so they share one CacheStorage, one localStorage and one IndexedDB namespace. Keep these rules. Changes that apply to every app at once (caching and the like) are made from Pedro's orchestration chat; they never touch UI or calculations.

- **Service worker:** Cache names start with `lift-log-` (the old `liftlog-` prefix is also cleaned up); `tools/build.py` sets the hash. On activate, delete only caches with that prefix (never "every cache but the current one"). Read from this app's own cache (`caches.open(C).then(c => c.match(...))`), never the global `caches.match()`. Only handle requests whose URL starts with `self.registration.scope`; leave other apps, the GitHub API and other origins alone.
- **Updates:** fetch network-first with `{cache: 'no-cache'}`, store only `r.ok` responses, fall back to this app's own cache when offline. Register the worker with `{scope: './', updateViaCache: 'none'}`.
- **Storage:** every `localStorage` key starts with `lift-log:` (the `LSP` helper); the IndexedDB database is `liftlog`.
- **Manifest:** `scope` and `start_url` are `./`. `id` is unique to this app and stays stable: changing it makes phones treat the app as a new install, so only do it deliberately.
- `python3 tools/build.py --check` and `tests/run.py` fail if the service worker or storage break these rules, so keep them passing.
- The manifest `id` is `/lift-log/`.
