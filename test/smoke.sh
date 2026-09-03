#!/bin/sh
# Runs a built image and checks what it actually hands out, ending with a real
# install driven from the served script. Takes the image tag, default shellf:test.
set -eu

IMAGE=${1:-shellf:test}
NET=shellf-smoke-$$
SRV=shellf-smoke-srv-$$
fail=0

cleanup() {
  docker rm -f "$SRV" >/dev/null 2>&1 || :
  docker network rm "$NET" >/dev/null 2>&1 || :
}
trap cleanup EXIT INT TERM

check() { # label expected-substring actual
  if printf '%s' "$3" | grep -q "$2"; then
    printf '   ok   %s\n' "$1"
  else
    printf '   FAIL %s\n        wanted %s in: %s\n' "$1" "$2" "$(printf '%s' "$3" | head -c 200)"
    fail=1
  fi
}

docker network create "$NET" >/dev/null
docker run -d --name "$SRV" --network "$NET" "$IMAGE" >/dev/null

# One helper container does every request, so nothing needs to be installed
# on the host and no ports are published.
in_net() { docker run --rm --network "$NET" alpine sh -c "$1"; }

printf '== waiting for the server\n'
in_net 'i=0; until wget -qO- http://'"$SRV"':8080/healthz >/dev/null 2>&1; do
          i=$((i+1)); [ "$i" -gt 60 ] && exit 1; sleep 1; done'
printf '   ok   healthy\n'

U=http://$SRV:8080

printf '== what it serves\n'
check "curl gets the script"    '^#!/bin/sh'   "$(in_net "wget -qO- $U/ | head -1")"
check "a browser gets the page" 'doctype html' "$(in_net "wget -qO- --header='Accept: text/html' $U/ | head -1")"
check "the module index"        'croc'         "$(in_net "wget -qO- $U/mods/index")"
check "one module"              'schollz/croc' "$(in_net "wget -qO- $U/mods/croc.sh")"
check "the paste-in bootstrap"  'Shellf bootstrap' "$(in_net "wget -qO- $U/bootstrap")"
check "its own origin stamped"  "$SRV"         "$(in_net "wget -qO- $U/ | grep '^SHLF_BASE='")"

printf '== traversal is refused\n'
for p in '/mods/../shlf.sh' '/mods/nope.sh'; do
  code=$(in_net "wget -qSO /dev/null $U$p 2>&1 | grep -m1 HTTP/ | awk '{print \$2}'" || echo none)
  check "$p is not served" '40[034]' "$code"
done

# A heredoc rather than nested quoting: the PATH form needs a $( ) to survive
# two shell layers intact, and escaping that inline is how mistakes happen.
run_script() { docker run --rm -i --network "$NET" alpine sh -s; }

printf '== a real install, driven from the served script\n'
out=$(run_script <<SCRIPT 2>&1
export SHLF_HOME=/tmp/s
wget -qO- $U/ | SHLF_DEFAULT=none SHLF_EAGER=jq sh
/tmp/s/tools/jq --version
SCRIPT
)
check "installs and links"   'linked:' "$out"
check "eager tool installed" 'jq-'     "$out"

printf '== the PATH form works in a real shell\n'
out=$(run_script <<SCRIPT 2>&1
export SHLF_HOME=/tmp/p
eval "\$(wget -qO- $U/ | sh -s -- setup)"
command -v shlf
shlf jq --version
SCRIPT
)
check "shlf lands on PATH" '/tmp/p/bin/shlf' "$out"
check "and runs a tool"    'jq-'             "$out"

[ "$fail" = 0 ] && printf '\nsmoke test passed\n'
exit $fail
