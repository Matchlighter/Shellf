# fish — friendly interactive shell, and the default command.
#
# 4.x ships one static-pie binary with its data files embedded, which is what
# makes it usable here at all; older fish needed its share/fish tree alongside.
# Linux only: upstream publishes a .pkg installer for macOS, not a binary.
DESC="friendly interactive shell"
SESSION=1
V=${SHLF_V_FISH:-4.9.0}
KIND=tarxz
if [ "$OS" = linux ]; then
  URL="https://github.com/fish-shell/fish-shell/releases/download/$V/fish-$V-linux-${A_UN}.tar.xz"
else
  UNSUP="fish publishes a Linux binary only (macOS gets a .pkg installer)"
fi
