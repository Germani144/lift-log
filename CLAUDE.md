# Working on Lift Log

- This repo is Lift Log only. Don't attach or edit other repos (cart-log, nap-log) from a Lift Log chat.
- After any edit to app files: `python3 tools/build.py`, then `python3 tests/run.py`. Don't push if either fails.
- Keep the README up to date: whenever a change adds, removes or changes a feature, a setting, the build/test steps or the backup setup, update README.md in the same commit.
- Add or adjust a test in `tests/run.py` for new behaviour.
- The user tests on an Android phone; after pushing, tell them the new version number (e.g. v1.4, from `tools/build.py` output) and to close the app from recent apps and reopen it to pick up the update.
- Versions: `tools/build.py` bumps the minor number (v1.4 -> v1.5) on every app change. Claude decides when to go to the next major (set `const VER='2.0';` by hand; the build keeps it): a big redesign, a change in how the app is used day to day, or a change to the data/backup format that older versions can't read. Fixes and normal features stay minor.
