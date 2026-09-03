#!/bin/sh
# Everything that can be checked without Docker: shell syntax under three
# shells, the Python app, and the UI suites.
set -eu

cd "$(dirname "$0")/.."
fail=0
say() { printf '%s\n' "$*"; }

say "== shell syntax"
for sh in sh dash bash; do
  command -v "$sh" >/dev/null 2>&1 || continue
  if "$sh" -n shlf; then
    say "   ok   shlf under $sh"
  else
    say "   FAIL shlf under $sh"; fail=1
  fi
done
for f in mods/*.sh test/*.sh; do
  if sh -n "$f"; then :; else say "   FAIL $f"; fail=1; fi
done
say "   ok   $(ls mods/*.sh | wc -l | tr -d ' ') modules parse"

say "== the portable region slices out and stands alone"
b=$(grep -n '^# --- portable:begin ---$' shlf | cut -d: -f1)
e=$(grep -n '^# --- portable:end ---$' shlf | cut -d: -f1)
if [ -n "$b" ] && [ -n "$e" ] && [ "$b" -lt "$e" ]; then
  sed -n "${b},$((e - 1))p" shlf > "${TMPDIR:-/tmp}/shlf-portable.$$"
  if sh -n "${TMPDIR:-/tmp}/shlf-portable.$$"; then
    say "   ok   region parses on its own"
  else
    say "   FAIL region does not parse"; fail=1
  fi
  rm -f "${TMPDIR:-/tmp}/shlf-portable.$$"
else
  say "   FAIL portable markers missing or out of order"; fail=1
fi

say "== index flags agree with the modules"
# usesys is the index's summary of a module's SYSTEM_OK. Two files, one fact,
# so check they still say the same thing.
drift=0
for f in mods/*.sh; do
  n=$(basename "$f" .sh)
  if grep -q '^SYSTEM_OK=1' "$f"; then mod=1; else mod=0; fi
  if grep -qE "^$n[[:space:]]+[^[:space:]]*usesys" mods/index; then idx=1; else idx=0; fi
  if [ "$mod" != "$idx" ]; then
    say "   FAIL $n: module SYSTEM_OK=$mod but index usesys=$idx"
    fail=1; drift=1
  fi
done
if [ "$drift" = 0 ]; then
  say "   ok   $(grep -cE '^[a-z].*usesys' mods/index) tools marked usesys, matching their modules"
fi

say "== python"
if python3 -c 'import ast,sys; ast.parse(open("server/app.py").read())'; then
  say "   ok   server/app.py parses"
else
  say "   FAIL server/app.py"; fail=1
fi

say "== the UI"
if command -v node >/dev/null 2>&1; then
  for t in test/ui-basics.js test/ui-options.js test/ui-popups.js; do
    printf '   %s: ' "$(basename "$t" .js)"
    if node "$t" >"${TMPDIR:-/tmp}/shlf-test.$$" 2>&1; then
      tail -1 "${TMPDIR:-/tmp}/shlf-test.$$"
    else
      echo "FAILED"; cat "${TMPDIR:-/tmp}/shlf-test.$$"; fail=1
    fi
    rm -f "${TMPDIR:-/tmp}/shlf-test.$$"
  done
else
  say "   skipped, no node"
fi

[ "$fail" = 0 ] && say "" && say "all good"
exit $fail
