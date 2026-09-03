# fd — friendlier find. Rust target triple.
DESC="friendlier find"
V=${SHLF_V_FD:-10.5.0}
KIND=targz
if [ -n "$A_RS" ]; then
  URL="https://github.com/sharkdp/fd/releases/download/v$V/fd-v$V-${A_RUST}.tar.gz"
else
  UNSUP="fd publishes no build for $(uname -m)"
fi
