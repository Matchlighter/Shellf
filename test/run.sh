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
