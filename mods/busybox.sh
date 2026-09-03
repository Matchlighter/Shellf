# busybox — hundreds of applets in one static binary, from busybox.net.
DESC="hundreds of applets in one static binary"
V=${SHLF_V_BUSYBOX:-1.35.0}
if [ "$OS" = linux ]; then
  URL="https://busybox.net/downloads/binaries/$V-${A_UN}-linux-musl/busybox"
else
  UNSUP="busybox.net publishes Linux binaries only"
fi
