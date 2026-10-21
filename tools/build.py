#!/usr/bin/env python3
"""Lift Log build + security check.

Run after editing any app file:
    python3 tools/build.py           # update the CSP script hash and the service-worker cache version
    python3 tools/build.py --check   # verify only; exits 1 if anything is out of date or unsafe

What it does
  1. Recomputes the sha256 hash of the inline <script> and writes it into the Content-Security-Policy.
     If this hash is wrong the browser refuses to run the app and you get a blank screen.
  2. Bumps the app version (const VER='1.4' -> '1.5', shown in the app as v1.5) whenever the app
     differs from the last commit, so every update you push has its own number.
  3. Copies that version into sw.js (const VER), which the app's "Check for updates" button reads
     from the server. Sets the service-worker cache name to a hash of the app files, so phones always pick up a new
     version (no more manual "v23 -> v24" bumps).
  4. Security checks: strict CSP (no unsafe-inline/unsafe-eval for scripts, nothing loaded from other
     sites except the GitHub API for backups), exactly one inline script, no inline event handlers
     or javascript: URLs, no eval/new Function, and every file the app needs offline is precached.
     Shared origin: the service worker only deletes/reads its own prefixed caches and only handles its own
     scope, and every localStorage key is prefixed (all apps on germani144.github.io share both).
"""
import base64, hashlib, pathlib, re, subprocess, sys

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
    if csp.get("connect-src") != ["'self'", "https://api.github.com"]:
        fail("CSP connect-src must only allow 'self' (update check) and https://api.github.com (backups)")
    for k in ("base-uri", "form-action"):
        if csp.get(k) != ["'none'"]:
            fail(f"CSP {k} must be 'none'")
    if re.search(r"\beval\s*\(|new\s+Function\s*\(", js):
        fail("eval / new Function is not allowed")
    if re.search(r"""<[^>]*\son[a-z]+\s*=""", html.replace(js, "")) or re.search(r"""\son(click|load|error|input|change|submit|focus|key\w*)\s*=\s*["'\w]""", js):
        fail("inline event handlers (onclick= etc.) are blocked by the CSP; use addEventListener")
    if "javascript:" in html:
        fail("javascript: URLs are not allowed")


VER_RE = re.compile(r"const VER='(\d+)\.(\d+)';")
APP_FILES = ("index.html", "sw.js", "manifest.webmanifest")


def normalize(text):
    """App content without the parts the build itself writes (version, CSP hash, cache name)."""
    text = VER_RE.sub("const VER='';", text)
    text = re.sub(r"script-src 'sha256-[^']+'", "script-src ''", text)
    return re.sub(r"const C='[^']*';", "const C='';", text)


def committed(path):
    r = subprocess.run(["git", "-C", str(ROOT), "show", f"HEAD:{path}"], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


def expected_version(html, sw):
    m = VER_RE.search(html)
    if not m or len(VER_RE.findall(html)) != 1:
        fail("index.html must contain exactly one  const VER='X.Y';")
    cur = (int(m.group(1)), int(m.group(2)))
    head = {f: committed(f) for f in APP_FILES}
    hm = VER_RE.search(head["index.html"] or "")
    if not hm:
        return cur   # no git history to compare with: keep what's there
    hv = (int(hm.group(1)), int(hm.group(2)))
    now = {"index.html": html, "sw.js": sw, "manifest.webmanifest": (ROOT / "manifest.webmanifest").read_text()}
    changed = any(normalize(now[f]) != normalize(head[f] or "") for f in APP_FILES)
    if not changed:
        return hv
    return cur if cur > hv else (hv[0], hv[1] + 1)


def shared_origin_checks(html, js, sw):
    """All apps share germani144.github.io: one CacheStorage, one localStorage. Don't touch other apps' data."""
    if re.search(r"(?<![\w.])caches\.match\(", sw):
        fail("sw.js: read from this app's own cache (caches.open(C).then(c=>c.match(...))), not the global caches.match()")
    act = re.search(r"addEventListener\('activate'.*", sw)
    if not act or "startsWith" not in act.group(0):
        fail("sw.js: the activate handler may only delete caches whose name starts with this app's prefix")
    if "self.registration.scope" not in sw:
        fail("sw.js: only handle fetches inside self.registration.scope")
    if re.search(r"localStorage\.(get|set|remove)Item\('", js):
        fail("index.html: localStorage keys must be prefixed (use LSP + key, or ls()/lg())")


def manifest_checks():
    """Every app shares germani144.github.io. A manifest must claim only its own folder, and its id must be
    unique: Chrome resolves "id" against the site root, so "./" would mean the whole site."""
    import json
    m = json.loads((ROOT / "manifest.webmanifest").read_text())
    if m.get("scope") != "./":
        fail('manifest: "scope" must be "./" (this app\'s own folder)')
    if m.get("start_url") != "./":
        fail('manifest: "start_url" must be "./"')
    if m.get("id") != "/lift-log/":
        fail('manifest: "id" must be "/lift-log/" (resolved from the site root, so it must name the folder)')


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
    v = expected_version(html, sw)
    html_v = VER_RE.sub(f"const VER='{v[0]}.{v[1]}';", html)
    h, js = script_hash(html_v)
    new_html = re.sub(r"script-src 'sha256-[^']+'", f"script-src '{h}'", html_v)
    security_checks(new_html, js)
    shared_origin_checks(new_html, js, sw)
    manifest_checks()
    files = shell_files(sw)
    digest = hashlib.sha256()
    for f in files:
        digest.update(f.encode())
        digest.update(new_html.encode() if f == "index.html" else (ROOT / f).read_bytes())
    digest.update(re.sub(r"const C='[^']*';", "", sw).encode())
    version = "lift-log-" + digest.hexdigest()[:10]
    new_sw = re.sub(r"const C='[^']*';", f"const C='{version}';", sw)
    if len(VER_RE.findall(new_sw)) != 1:
        fail("sw.js must contain exactly one  const VER='X.Y';  (read by Check for updates)")
    new_sw = VER_RE.sub(f"const VER='{v[0]}.{v[1]}';", new_sw)   # server-side version = the app's version
    changed = [n for n, a, b in (("index.html", html, new_html), ("sw.js", sw, new_sw)) if a != b]
    if check:
        if changed:
            fail("out of date: " + ", ".join(changed) + " (run python3 tools/build.py)")
        print(f"OK: v{v[0]}.{v[1]}; CSP hash, cache version and security checks all pass")
        return
    INDEX.write_text(new_html)
    SW.write_text(new_sw)
    print(("Updated " + ", ".join(changed)) if changed else "Already up to date", f"| v{v[0]}.{v[1]} | cache", version)


if __name__ == "__main__":
    main()
