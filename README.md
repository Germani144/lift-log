# Lift Log

Offline workout tracker that runs as a single-file web app on your phone: https://germani144.github.io/lift-log/

Everything lives in the browser on your phone (IndexedDB), with optional automatic backup to a private GitHub repo.

## Making changes

1. Edit `index.html` (the whole app: HTML, CSS and JavaScript).
2. Run the build, which updates the security hash and the offline-cache version:
   ```
   python3 tools/build.py
   ```
   Skipping this step blanks the app, because the browser refuses to run a script whose hash doesn't match.
3. Run the tests:
   ```
   pip install playwright && python3 -m playwright install chromium   # once
   python3 tests/run.py            # everything, ~45 s
   python3 tests/run.py suggest    # just the tests with "suggest" in the name
   ```
4. Commit and push. GitHub runs the same checks on every push (Actions → Tests), and emails you if one fails.

## What the checks cover

- **Security** (`tools/build.py --check`): strict Content-Security-Policy (no inline handlers, no `eval`, scripts only by hash, network only to the GitHub API for backups), and every file needed offline is precached.
- **Behaviour** (`tests/run.py`): main workout flow, weight/rep suggestions (progression, warm-ups, bad-day guard, bodyweight), warm-up sets, backup round trip and rejection of bad files, names can't inject HTML/script, back gesture, search and ordering, swipe between tabs.

Fonts: Barlow and Barlow Condensed, SIL Open Font License (`fonts/OFL.txt`).
