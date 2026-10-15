#!/usr/bin/env python3
"""Lift Log build + security check.

Run after editing any app file:
    python3 tools/build.py           # update the CSP script hash and the service-worker cache version
    python3 tools/build.py --check   # verify only; exits 1 if anything is out of date or unsafe

What it does
  1. Recomputes the sha256 hash of the inline <script> and writes it into the Content-Security-Policy.
     If this hash is wrong the browser refuses to run the app and you get a blank screen.
  2. Sets the service-worker cache name to a hash of the app files, so phones always pick up a new
     version (no more manual "v23 -> v24" bumps).
  3. Security checks: strict CSP (no unsafe-inline/unsafe-eval for scripts, nothing loaded from other
     sites except the GitHub API for backups), exactly one inline script, no inline event handlers
     or javascript: URLs, no eval/new Function, and every file the app needs offline is precached.
"""
import base64, hashlib, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX, SW = ROOT / "index.html", ROOT / "sw.js"


def fail(msg):
    print("FAIL:", msg)
    sys.exit(1)


def script_hash(html):
    scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
    if len(re.findall(r"<script\b", html)) != 1 or len(scripts) != 1:
        fail("index.html must contain exactly one inline <script> and no external scripts")
    return "sha256-" + base64.b64encode(hashlib.sha256(scripts[0].encode()).digest()).decode(), scripts[0]


def security_checks(html, js):
    m = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)"', html)
    if not m:
        fail("Content-Security-Policy meta tag is missing")
    csp = {d.split()[0]: d.split()[1:] for d in (x.strip() for x in m.group(1).split(";")) if d}
    if csp.get("default-src") != ["'none'"]:
        fail("CSP default-src must be 'none'")
    src = csp.get("script-src", [])
    if len(src) != 1 or not src[0].startswith("'sha256-"):
        fail("CSP script-src must be exactly one sha256 hash (no 'unsafe-inline', no URLs)")
    if csp.get("connect-src") != ["https://api.github.com"]:
        fail("CSP connect-src must only allow https://api.github.com (backups)")
    for k in ("base-uri", "form-action"):
        if csp.get(k) != ["'none'"]:
            fail(f"CSP {k} must be 'none'")
    if re.search(r"\beval\s*\(|new\s+Function\s*\(", js):
        fail("eval / new Function is not allowed")
    if re.search(r"""<[^>]*\son[a-z]+\s*=""", html.replace(js, "")) or re.search(r"""\son(click|load|error|input|change|submit|focus|key\w*)\s*=\s*["'\w]""", js):
        fail("inline event handlers (onclick= etc.) are blocked by the CSP; use addEventListener")
    if "javascript:" in html:
        fail("javascript: URLs are not allowed")


def shell_files(sw):
    m = re.search(r"const SHELL=\[(.*?)\];", sw, re.S)
    if not m:
        fail("sw.js: SHELL list not found")
    listed = {x.strip().strip("'\"").lstrip("./") for x in m.group(1).split(",") if x.strip()}
    listed.discard("")
    needed = {"index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"}
    needed |= {f"fonts/{p.name}" for p in (ROOT / "fonts").glob("*.woff2")}
    missing = needed - listed
    if missing:
        fail("sw.js SHELL is missing files needed offline: " + ", ".join(sorted(missing)))
    for f in listed:
        if not (ROOT / f).exists():
            fail(f"sw.js SHELL lists a file that doesn't exist: {f}")
    return sorted(needed)


def main():
    check = "--check" in sys.argv
    html, sw = INDEX.read_text(), SW.read_text()
    h, js = script_hash(html)
    new_html = re.sub(r"script-src 'sha256-[^']+'", f"script-src '{h}'", html)
    security_checks(new_html, js)
    files = shell_files(sw)
    digest = hashlib.sha256()
    for f in files:
        digest.update(f.encode())
        digest.update(new_html.encode() if f == "index.html" else (ROOT / f).read_bytes())
    digest.update(re.sub(r"const C='[^']*';", "", sw).encode())
    version = "liftlog-" + digest.hexdigest()[:10]
    new_sw = re.sub(r"const C='[^']*';", f"const C='{version}';", sw)
    changed = [n for n, a, b in (("index.html", html, new_html), ("sw.js", sw, new_sw)) if a != b]
    if check:
        if changed:
            fail("out of date: " + ", ".join(changed) + " (run python3 tools/build.py)")
        print("OK: CSP hash, cache version and security checks all pass")
        return
    INDEX.write_text(new_html)
    SW.write_text(new_sw)
    print(("Updated " + ", ".join(changed)) if changed else "Already up to date", "| cache", version)


if __name__ == "__main__":
    main()
