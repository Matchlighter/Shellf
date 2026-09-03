"""Shellf server.

Serves the bootstrap script to shells and a WebUI to browsers, off the same URL.

    GET /             Accept: text/html  ->  the WebUI
    GET /             anything else      ->  the shlf script, text/plain
    GET /shlf                            ->  the shlf script, always
    GET /bootstrap                       ->  paste-in bootstrap, no curl needed
    GET /mods/index                      ->  the module index
    GET /mods/<name>.sh                  ->  one module
    GET /sums.txt                        ->  checksums, when present
    GET /healthz                         ->  ok

The UI is entirely client-side: it reads the index, builds an install command
from its own location, and keeps preferences in localStorage. Nothing here
holds state, so the server stays a static file server with one content
negotiation rule.
"""

import os
import re
from pathlib import Path

from bottle import Bottle, HTTPError, request, response, static_file

# Where shlf and mods/ live. The image sets this; a checkout defaults to the
# repo root just above this file.
ROOT = Path(os.environ.get("SHELLF_ROOT", Path(__file__).resolve().parent.parent))
UI = Path(__file__).resolve().parent / "ui"

# Module names are turned into paths, so allow nothing that could escape.
MOD_NAME = re.compile(r"\A[A-Za-z0-9][A-Za-z0-9._-]{0,63}\Z")

# The one line in shlf that says where it lives. A piped script cannot know its
# own origin, so we stamp it in on the way out and `curl host | sh` just works.
# Only the default is touched, so an explicit SHLF_BASE= still wins.
BASE_DEFAULT = re.compile(r"(?m)^(SHLF_BASE=\$\{SHLF_BASE:-)([^}]*)(\})")

# The self-contained region of shlf, sliced out to build the paste-in
# bootstrap. Assembling it from shlf itself means the detection a bare box runs
# can never drift from the detection shlf runs.
PORTABLE = re.compile(r"^# --- portable:begin ---\n(.*?)^# --- portable:end ---\n", re.S | re.M)

# This value is interpolated into a shell script, so it is allowlisted, not
# escaped: a hostile Host header must not be able to inject anything.
HOST_OK = re.compile(r"\A[A-Za-z0-9][A-Za-z0-9.-]{0,252}(:[0-9]{1,5})?\Z")

app = Bottle()


def _origin() -> str | None:
    """The public base URL to stamp into the script, or None to leave it alone.

    SHELLF_PUBLIC_URL wins, which is what to set behind a proxy that rewrites
    paths. Otherwise derive it from the forwarded headers, then the Host.
    """
    pinned = os.environ.get("SHELLF_PUBLIC_URL", "").strip().rstrip("/")
    if pinned:
        scheme, _, host = pinned.partition("://")
        return pinned if scheme in ("http", "https") and HOST_OK.match(host) else None

    fwd = request.get_header("X-Forwarded-Proto") or ""
    scheme = (fwd.split(",")[0].strip() or request.urlparts.scheme or "http").lower()
    host = (request.get_header("X-Forwarded-Host") or request.get_header("Host") or "")
    host = host.split(",")[0].strip()
    if scheme not in ("http", "https") or not HOST_OK.match(host):
        return None
    return f"{scheme}://{host}"


BOOTSTRAP = """#!/bin/sh
# Shellf bootstrap — for a box with no curl and no wget.
#
# Paste the whole thing into a shell. It tries every HTTP client the box might
# have, pulls shlf, and hands over. If none of them can fetch, it says so and
# stops rather than failing obscurely.
#
# There is deliberately no `set -e` here: this gets pasted into interactive
# shells, and killing someone's shell on the next stray failure would be rude.
#
# Configure it by setting variables first, for example:
#     SHLF_DEFAULT=bash SHLF_EAGER='croc rg'
# and to run one tool instead of a shell:
#     set -- croc send file.tgz
# SHLF_NO_PATH=1 keeps this shell's PATH untouched.

SHLF_BASE=${SHLF_BASE:-@@ORIGIN@@}
export SHLF_BASE

@@PORTABLE@@
# Somewhere to land, which is not the cache: shlf picks that itself with a
# proper write-and-exec probe. This spot only has to be writable, because we
# hand the script to sh rather than executing it, so a noexec /tmp is fine.
shlf_boot_tmp=
for shlf_boot_d in "${TMPDIR:-/tmp}" /tmp /dev/shm "${HOME:-.}" .; do
  shlf_boot_try=$shlf_boot_d/shlf-boot.$$
  # The subshell matters: a failed redirection on a special built-in exits a
  # non-interactive shell outright.
  if ( true > "$shlf_boot_try" ) 2>/dev/null; then
    shlf_boot_tmp=$shlf_boot_try
    break
  fi
done

if [ -z "$shlf_boot_tmp" ]; then
  shlf_say "nowhere writable to put the download; set TMPDIR to somewhere you can write"
  shlf_boot_rc=1
elif shlf_say "downloading to $shlf_boot_tmp" && shlf_dl "$SHLF_BASE/shlf" "$shlf_boot_tmp"; then
  if [ "${SHLF_NO_PATH:-0}" = 1 ]; then
    sh "$shlf_boot_tmp" "$@"
    shlf_boot_rc=$?
  else
    # Pasted into a shell, this line runs in that shell, so the eval leaves
    # shlf and its tools on PATH once you are done. Saved to a file and run
    # with sh, it is scoped to the script, which is the expected difference.
    eval "$(sh "$shlf_boot_tmp" setup)"
    shlf "$@"
    shlf_boot_rc=$?
  fi
  rm -f "$shlf_boot_tmp"
else
  shlf_boot_rc=1
  rm -f "$shlf_boot_tmp"
fi

unset -f shlf_say shlf_die shlf_dl 2>/dev/null
unset shlf_boot_tmp shlf_boot_try shlf_boot_d
# Sets $? without exiting, because `exit` in a pasted script would close an
# interactive shell. A saved file still ends with the right status.
( exit $shlf_boot_rc )
"""


def _base_default(text: str) -> str:
    m = BASE_DEFAULT.search(text)
    return m.group(2) if m else ""


def _bootstrap() -> str:
    """The paste-in bootstrap, assembled from shlf's own portable region."""
    text = _text(ROOT / "shlf")
    m = PORTABLE.search(text)
    if not m:
        raise HTTPError(500, "shlf has no portable region to slice")
    origin = _origin() or _base_default(text)
    return (BOOTSTRAP
            .replace("@@ORIGIN@@", origin)
            .replace("@@PORTABLE@@", m.group(1).rstrip("\n")))


def _script() -> str:
    """The bootstrap script, with its own origin stamped in."""
    text = _text(ROOT / "shlf")
    origin = _origin()
    if not origin:
        return text
    stamped, count = BASE_DEFAULT.subn(lambda m: m.group(1) + origin + m.group(3), text, count=1)
    return stamped if count == 1 else text


def _text(path: Path, content_type: str = "text/plain; charset=utf-8") -> str:
    if not path.is_file():
        raise HTTPError(404, f"no {path.name} here")
    response.content_type = content_type
    # The script changes rarely but must never be stale on a fresh box.
    response.set_header("Cache-Control", "no-cache")
    return path.read_text(encoding="utf-8")


def _wants_html() -> bool:
    """True for a browser, false for curl, wget, and friends.

    Browsers ask for text/html explicitly. curl sends `Accept: */*` or no
    Accept at all, which must never match, or `curl example.com | sh` would
    pipe an HTML page into a shell.
    """
    accept = request.get_header("Accept") or ""
    return "text/html" in accept.lower()


@app.get("/")
def root():
    if _wants_html():
        return static_file("index.html", root=str(UI))
    return _script()


@app.get("/shlf")
def script():
    return _script()


@app.get("/bootstrap")
def bootstrap():
    return _bootstrap()


@app.get("/sums.txt")
def sums():
    return _text(ROOT / "sums.txt")


@app.get("/mods/index")
def mod_index():
    return _text(ROOT / "mods" / "index")


@app.get("/mods/<name>.sh")
def module(name):
    if not MOD_NAME.match(name):
        raise HTTPError(400, "bad module name")
    return _text(ROOT / "mods" / f"{name}.sh")


@app.get("/healthz")
def healthz():
    response.content_type = "text/plain; charset=utf-8"
    return "ok\n"


def main():
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8080"))
    # waitress in the image; bottle's own server is fine for a local run.
    try:
        from waitress import serve

        serve(app, host=host, port=port, threads=8, ident="shellf")
    except ImportError:
        app.run(host=host, port=port, quiet=False)


if __name__ == "__main__":
    main()
