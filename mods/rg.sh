# rg — ripgrep. Rust project, so the asset is a target triple.
DESC="ripgrep, fast recursive search"
EXE=rg
V=${SHLF_V_RG:-15.2.0}
KIND=targz
if [ -n "$A_RS" ]; then
  URL="https://github.com/BurntSushi/ripgrep/releases/download/$V/ripgrep-$V-${A_RUST}.tar.gz"
else
  UNSUP="ripgrep publishes no build for $(uname -m)"
fi
