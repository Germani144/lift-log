#!/usr/bin/env python3
"""Lift Log test suite. Runs the real app in headless Chromium and checks that nothing broke.

    pip install playwright && python3 -m playwright install chromium   # once
    python3 tests/run.py                  # run everything
    python3 tests/run.py suggest backup   # run tests whose name contains any of these words

Each test gets a fresh browser profile (empty IndexedDB). Exit code 0 = all passed.
"""
import functools, http.server, json, pathlib, socket, subprocess, sys, threading, time, traceback
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
TESTS = []


def test(fn):
    TESTS.append(fn)
    return fn


def serve():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    H = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{port}/index.html"


class App:
    """A fresh app instance in its own browser context."""

    def __init__(self, browser, url):
        self.ctx = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, service_workers="block")
        self.pg = self.ctx.new_page()
        self.errors, self.dialogs = [], []
        self.pg.on("pageerror", lambda e: self.errors.append(str(e)))
        self.pg.on("console", lambda m: m.type == "error" and self.errors.append(m.text))
        self.pg.on("dialog", lambda d: (self.dialogs.append(d.message), d.accept("90")))
        self.pg.goto(url)
        try:
            self.pg.wait_for_function("typeof S!=='undefined'&&document.querySelector('nav')", timeout=8000)
        except Exception:
            raise AssertionError("app didn't start (blocked script? wrong CSP hash?) " + "; ".join(self.errors)[:300])

    def js(self, expr, arg=None):
        return self.pg.evaluate(expr, arg)

    def click(self, sel):
        self.pg.locator(sel).first.click(); self.pg.wait_for_timeout(120)

    def fill(self, sel, v):
        self.pg.locator(sel).first.fill(str(v))

    def tab(self, name):
        self.click(f'nav button:has-text("{name}")')

    def state(self):
        return self.js("({tab:S.tab,ex:S.ex.length,tpl:S.tpl.length,sets:S.sets.length,w:!!W,"
                       "rows:W?W.items.map(i=>i.rows.length+':'+i.rows.filter(r=>r.done).length).join(','):'',"
                       "view:S.view&&S.view.t,pick:!!PICK})")

    def new_exercise(self, name, **f):
        self.tab("Exercises"); self.click("[data-a=exNew]"); self.fill("input[data-b=name]", name)
        if f.pop("mode", None) == "pct":
            self.pg.select_option("select[data-b=mode]", "pct")
        for k, v in f.items():
            self.fill(f"input[data-b={k}]", v)
        self.click("[data-a=exSave]")

    def seed_sets(self, ex_name, sessions):
        """sessions: list of lists of (w, r, rir[, warmup]) — oldest first, one day apart."""
        self.js("""async([n,ss])=>{const ex=S.ex.find(e=>e.name==n);let t=Date.now()-(ss.length+1)*864e5;
          for(const s of ss){t+=864e5;let k=0;for(const [w,r,rir,wu] of s){const o={exId:ex.id,sess:t,wn:'Seed',t:t+(k++)*1000,w,r,rir};if(wu)o.wu=true;await put('sets',o)}}
          await load();render()}""", [ex_name, sessions])

    def suggest(self, ex_name, n=3, **over):
        return self.js("async([n,k,o])=>{const ex={...S.ex.find(e=>e.name==n),...o};const g=await suggest(ex,k);return g.rows.map(r=>[r.w,r.r])}",
                       [ex_name, n, over])

    def close(self):
        self.ctx.close()


def eq(a, b, msg=""):
    if a != b:
        raise AssertionError(f"{msg}\n    expected: {b!r}\n    got:      {a!r}")


def ok(cond, msg):
    if not cond:
        raise AssertionError(msg)


# ---------------------------------------------------------------- tests

@test
def build_and_security_checks(app):
    r = subprocess.run([sys.executable, str(ROOT / "tools/build.py"), "--check"], capture_output=True, text=True)
    ok(r.returncode == 0, r.stdout + r.stderr)


@test
def loads_without_errors(app):
    eq(app.errors, [], "console errors on load (a wrong CSP hash shows up here)")
    eq(app.js("document.querySelectorAll('nav button').length"), 4)
    app.pg.wait_for_selector("#splash", state="detached", timeout=6000)


@test
def main_flow(app):
    """Exercises -> plan -> workout (log, undo, add/remove set, rest timer, replace) -> finish -> history."""
    app.new_exercise("Weighted dips", inc=2)
    app.new_exercise("Deadlift", mode="pct", cur=170, pb=216)
    app.new_exercise("Bench")
    eq(app.state()["ex"], 3)
    eq(app.js("S.pr[S.ex.find(e=>e.name=='Deadlift').id].w"), 170, "current 1RM saved")
    app.tab("Plans"); app.click("[data-a=tplNew]"); app.fill("input[data-b=name]", "Upper lower")
    app.pg.select_option("select[data-dpw]", "2"); app.fill('input[data-b="days.0.name"]', "Upper")
    app.click('[data-tq="0"]'); app.pg.keyboard.type("Weighted"); app.pg.keyboard.press("Enter"); app.pg.wait_for_timeout(150)
    app.click("[data-a=tplSave]")
    eq(app.js("S.tpl[0].days[0].items.map(i=>EX(i.exId).name)"), ["Weighted dips"])
    app.tab("Train"); app.click("[data-a=planStart]"); app.click('[data-a=start][data-d="0"]')
    eq(app.state()["rows"], "3:0", "plan day starts with 3 sets")
    app.click("[data-a=pickAdd]"); app.pg.keyboard.type("Bench"); app.pg.keyboard.press("Enter"); app.pg.wait_for_timeout(200)
    eq(app.state()["rows"], "3:0,3:0")
    row = '.set[data-j="0"] >> nth=0 >> '
    app.fill(row + "input[data-f=w]", 40); app.fill(row + "input[data-f=r]", 10); app.fill(row + "input[data-f=rir]", 2)
    app.click(row + "[data-a=log]")
    eq(app.state()["rows"], "3:1,3:0", "set logged")
    ok(app.js("W.restEnd>Date.now()"), "rest timer starts after logging")
    rest = app.js("W.rest"); app.click("[data-a=rinc]"); eq(app.js("W.rest"), rest + 15, "+15 s")
    app.click("[data-a=undo]"); eq(app.state()["rows"], "3:0,3:0", "undo")
    app.click(row + "[data-a=log]"); app.click("[data-a=addset]"); eq(app.state()["rows"], "4:1,3:0", "add set")
    app.click(".card:has([data-a=addset]) >> nth=1 >> [data-a=rms] >> nth=-1"); eq(app.state()["rows"], "4:1,2:0", "remove set")
    app.click("[data-a=toLanding]"); ok(app.js("LAND"), "back to landing"); app.click("[data-a=resume]")
    app.click("[data-a=finish]"); app.pg.wait_for_timeout(200)
    st = app.state(); eq((st["w"], st["sets"]), (False, 1), "finish saves the logged set")
    app.tab("History"); app.click(".cd.tr"); ok("Weighted dips" in app.pg.inner_text("main"), "history shows the workout")
    eq(app.js("planRun(S.tpl[0]).total"), 1, "plan progress counts the workout")
    eq(app.errors, [])


@test
def suggestions_progress_and_ignore_warmups(app):
    app.new_exercise("Squat", lo=5, hi=8)
    # steady progress, with a warm-up ladder each session
    app.seed_sets("Squat", [[(40, 8, None, 1), (60, 5, None, 1)] + [(100 + 2 * i, 6, 2)] * 3 for i in range(4)])
    rows = app.suggest("Squat")
    eq(rows[0], [106, 7], "one more rep at last session's weight (warm-ups ignored)")
    eq([r[1] for r in rows], [7, 7, 6], "fatigue: a rep fewer from the 3rd set")
    eq(len({r[0] for r in rows}), 1, "same weight on all working sets")


@test
def suggestions_never_use_warmup_weights(app):
    app.new_exercise("Deadlift", lo=5, hi=8)
    # a heavy warm-up (94x5) sits inside today's 5-8 range; the working sets (100x4) are below it.
    # Counting the warm-up would suggest 94x7; from the working sets alone it's 98x5.
    app.seed_sets("Deadlift", [[(94, 5, 3, 1), (100, 4, 2), (100, 4, 2)]] * 3)
    eq(app.suggest("Deadlift")[0], [98, 5], "suggestion must come from the working sets, not the warm-up")


@test
def suggestions_move_weight_at_range_edges(app):
    app.new_exercise("Row", lo=6, hi=10)
    app.seed_sets("Row", [[(60, 10, 2)] * 3] * 3)  # top of range at target RIR -> heavier, reset reps
    w, r = app.suggest("Row")[0]
    ok(w > 60 and r == 6, f"expected heavier weight at 6 reps, got {w}x{r}")
    app.new_exercise("Press", lo=8, hi=12)
    app.seed_sets("Press", [[(50, 6, 0)] * 3] * 3)  # couldn't reach the range -> lighter
    w, r = app.suggest("Press")[0]
    ok(w < 50 and r == 8, f"expected lighter weight at 8 reps, got {w}x{r}")


@test
def suggestions_guard_against_one_bad_day(app):
    app.new_exercise("Bench", lo=5, hi=8)
    app.seed_sets("Bench", [[(80, 7, 2)] * 3] * 3 + [[(80, 4, 0)] * 3])  # last session was awful
    w, r = app.suggest("Bench")[0]
    ok(w == 80 and r >= 5, f"one bad day shouldn't crater the suggestion, got {w}x{r}")


@test
def suggestions_bodyweight_and_no_history(app):
    app.new_exercise("Pull-ups", inc=0, lo=6, hi=12)
    eq(app.suggest("Pull-ups")[0], ["", 6], "no history: bottom of range, no weight")
    app.seed_sets("Pull-ups", [[(0, 8, 2)] * 3] * 3)
    eq(app.suggest("Pull-ups")[0][1], 9, "bodyweight: one more rep")


@test
def warmup_sets(app):
    app.new_exercise("Squat", lo=5, hi=8, wu=3)
    eq(app.js("S.ex[0].wu"), 3)
    app.seed_sets("Squat", [[(100, 6, 2)] * 3] * 3)
    app.tab("Train"); app.click("[data-a=start]"); app.click("[data-a=pickAdd]"); app.click("#plist .chip")
    rows = app.js("W.items[0].rows")
    eq([bool(r.get("wu")) for r in rows], [True, True, True, False, False, False], "3 warm-ups before 3 working sets")
    ok(rows[0]["w"] < rows[1]["w"] < rows[2]["w"] < rows[3]["w"], "warm-up ramp climbs to the working weight")
    app.click('.set[data-j="0"] [data-a=log]')
    last = app.js("(async()=>(await all('sets')).sort((a,b)=>a.t-b.t).pop())()")
    eq((last.get("wu"), last["test"]), (True, False), "logged warm-up is flagged")
    app.click('.set[data-j="0"] [data-a=wu]')
    last = app.js("(async()=>(await all('sets')).sort((a,b)=>a.t-b.t).pop())()")
    ok("wu" not in last, "toggling a logged set updates the saved record")


@test
def backup_round_trip_and_validation(app):
    app.new_exercise("Squat", wu=2, pb=150)
    app.seed_sets("Squat", [[(40, 8, None, 1), (100, 5, 2)]])
    d = app.js("(async()=>{const d={app:'liftlog',v:1,t:Date.now()};for(const n of STORES)d[n]=await all(n);return d})()")
    c = app.js("d=>clean(d)", d)
    eq((c["exercises"][0]["wu"], c["exercises"][0]["pb"]), (2, 150), "exercise settings survive backup")
    eq(sum(1 for s in c["sets"] if s.get("wu")), 1, "warm-up flag survives backup")
    for bad in ({**d, "sets": "nope"}, {**d, "exercises": [{"id": 1, "name": "x", "mode": "evil", "inc": 2}]}):
        ok(app.js("async d=>(await applyBackup(d))===false", bad), "invalid backup must be rejected")
    eq(app.js("S.ex.length"), 1, "a rejected backup changes nothing")


@test
def user_text_cannot_inject_html(app):
    """Security: names you type are shown as text, never run as code (XSS)."""
    evil = '<img src=x onerror="window.__pwned=1">'
    app.new_exercise(evil)
    app.seed_sets(evil, [[(50, 5, 2)]])
    app.tab("Plans"); app.click("[data-a=tplNew]"); app.fill("input[data-b=name]", evil)
    app.click('[data-tq="0"]'); app.pg.keyboard.type("img"); app.pg.wait_for_timeout(100)
    app.pg.keyboard.press("Enter"); app.pg.wait_for_timeout(100); app.click("[data-a=tplSave]")
    def clean(where):
        eq(app.js("document.querySelectorAll('main img[src=x]').length"), 0, f"{where}: an <img> tag from a name was rendered")
        ok(not app.js("window.__pwned"), f"{where}: injected script ran")
    for t in ("Exercises", "Plans", "Train", "History"):
        app.tab(t); clean(t + " tab")
    app.click(".cd.tr"); clean("history day")
    app.tab("Exercises"); app.click("[data-a=exOpen]"); clean("exercise page"); app.click("[data-a=back]")
    app.tab("Plans"); app.click("[data-a=tplEdit]"); clean("plan editor"); app.click("[data-a=back]")
    app.tab("Train"); app.click("[data-a=start]"); app.click("[data-a=pickAdd]"); clean("picker chips")
    app.pg.keyboard.type("img"); app.pg.wait_for_timeout(200); clean("picker search")
    app.pg.keyboard.press("Enter"); app.pg.wait_for_timeout(200); clean("workout card")


@test
def back_gesture_closes_pages(app):
    app.new_exercise("Bench")
    app.click("[data-a=exOpen]"); eq(app.state()["view"], "exd")
    app.pg.go_back(); app.pg.wait_for_timeout(200)
    eq((app.state()["view"], app.pg.url.endswith("index.html")), (None, True), "back closes the exercise page, stays in app")
    app.tab("Train"); app.click("[data-a=start]"); app.click("[data-a=pickAdd]"); eq(app.state()["pick"], True)
    app.pg.go_back(); app.pg.wait_for_timeout(200); eq((app.state()["pick"], app.state()["w"]), (False, True), "back closes the picker")
    app.pg.go_back(); app.pg.wait_for_timeout(200); ok(app.js("LAND"), "back from a workout goes to the Train page")


@test
def search_and_order(app):
    for n in ["Squats", "front squats", "Bench", "Deadlift", "Pause Back Squats"]:
        app.new_exercise(n)
    names = lambda: [x.split("\n")[0] for x in app.pg.locator(".exr:visible .l").all_inner_texts()]
    eq(names(), ["Bench", "Deadlift", "front squats", "Pause Back Squats", "Squats"], "alphabetical, case-insensitive")
    app.fill("#exq", "squ"); app.pg.locator("#exq").dispatch_event("input")
    eq(names(), ["front squats", "Pause Back Squats", "Squats"], "filter as you type")
    app.fill("#exq", "zzz"); app.pg.locator("#exq").dispatch_event("input"); ok(app.pg.is_visible("#exnone"), "no-match message")
    app.tab("Train"); app.click("[data-a=start]"); app.click("[data-a=pickAdd]"); app.pg.keyboard.type("squ")
    app.pg.wait_for_timeout(100)
    eq(app.pg.locator("#plist .sg").all_inner_texts()[0].split("\n")[0], "Squats", "starts-with ranks first")
    app.pg.keyboard.press("Enter"); app.pg.wait_for_timeout(150)
    eq(app.js("W.items.map(i=>EX(i.exId).name)"), ["Squats"])


@test
def swipe_changes_tabs(app):
    cdp = app.ctx.new_cdp_session(app.pg)

    def swipe(x0, x1):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x0, "y": 150}]})
        for k in range(1, 9):
            cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x0 + (x1 - x0) * k / 8, "y": 152}]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); app.pg.wait_for_timeout(300)

    swipe(300, 100); eq(app.state()["tab"], "hist")
    swipe(300, 100); swipe(300, 100); swipe(300, 100); eq(app.state()["tab"], "ex", "stops at the last tab")
    swipe(100, 300); eq(app.state()["tab"], "tpl")
    swipe(200, 230); eq(app.state()["tab"], "tpl", "a short drag does nothing")


# ---------------------------------------------------------------- runner

def main():
    words = [w.lower() for w in sys.argv[1:]]
    chosen = [t for t in TESTS if not words or any(w in t.__name__ for w in words)]
    url, failed = serve(), []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for t in chosen:
            t0, app = time.time(), None
            try:
                app = App(browser, url); t(app); print(f"  ok    {t.__name__} ({time.time() - t0:.1f}s)")
            except Exception as e:
                failed.append(t.__name__)
                print(f"  FAIL  {t.__name__}\n{''.join(traceback.format_exception_only(e)).rstrip()}")
            finally:
                app and app.close()
        browser.close()
    print(f"\n{len(chosen) - len(failed)}/{len(chosen)} passed" + (f" — failed: {', '.join(failed)}" if failed else ""))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
