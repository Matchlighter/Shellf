# dust — disk usage, sorted and visual. Rust target triple.
DESC="disk usage, sorted and visual"
V=${SHLF_V_DUST:-1.2.5}
KIND=targz
if [ -n "$A_RS" ]; then
  URL="https://github.com/bootandy/dust/releases/download/v$V/dust-v$V-${A_RUST}.tar.gz"
else
  UNSUP="dust publishes no build for $(uname -m)"
fi
