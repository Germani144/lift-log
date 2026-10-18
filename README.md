# Lift Log

Offline workout tracker that runs as a single-file web app on your phone: https://germani144.github.io/lift-log/

Everything lives in the browser on your phone (IndexedDB), with optional automatic backup to a private GitHub repo.

## Features

- **Train:** start a day from your active plan or a quick workout. Log weight, reps and RIR per set (leave the weight empty or 0 for a bodyweight set; it shows as BW once logged). Tap the light checkmark to log a set; it turns into a filled red check; a rest timer starts after each set (tap the time to change it, ±15 s buttons). Add or replace exercises by typing a name.
- **Suggestions:** for RIR exercises, each set's weight and reps come from your estimated strength (average of your last 4 sessions, working sets only, preferring a similar rep range) and the target rep range and RIR. You get one more rep than last time; at the top of the range the weight goes up and reps reset. Later sets drop a rep every two sets for fatigue. If your last session of an exercise was all bodyweight, the suggestion stays at bodyweight and adds a rep.
- **% of 1RM exercises:** sets written as `3*80%x5` in a plan, using your current 1RM.
- **Warm-ups:** set 0–4 warm-up sets per exercise to get a ramp before your working sets; any set can be marked as a warm-up. Warm-ups never count toward suggestions or 1RM/PB.
- **1RM and PB:** a set of 1 rep at 0 RIR counts as a tested 1RM; lifetime PB rises automatically.
- **Plans:** days per week, number of weeks, per-day exercises with sets, rep range and RIR. Progress shows as a barbell bar on the Train page.
- **History:** month calendar of training days, every workout listed, and per-exercise charts (max weight and volume per session). Tap **Edit workout** on any past workout to change its date or name, edit any set (weight, reps, RIR, warm-up), remove sets or exercises, or add sets and exercises. The workout in progress is edited from the Train tab instead.
- **Exercises:** alphabetical list with a search box.
- **Navigation:** swipe left/right between tabs; the phone's back gesture closes the open page. The bottom bar is fixed and only the page above it scrolls; each tab opens at the top, and going back from an exercise returns you to the same place in the list.
- **Backup:** automatic backup to a private GitHub repo (fine-grained token, Contents read/write on that repo only), plus manual export/import of a JSON file.

## Making changes

1. Edit `index.html` (the whole app: HTML, CSS and JavaScript).
2. Run the build, which updates the security hash and the offline-cache version:
   ```
   python3 tools/build.py
   ```
   Skipping this step blanks the app, because the browser refuses to run a script whose hash doesn't match.
   It also bumps the version number (shown as e.g. **v1.4** on the startup screen and at the bottom of the Exercises tab) whenever the app changed since the last commit, so every pushed update has its own number.
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
