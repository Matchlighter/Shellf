# curl — statically linked, for boxes that have no HTTP client at all.
# Deliberately flagged nolink in the index: a curl stub ahead of the real one
# on PATH would hijack every other script on the box.
DESC="HTTP client, statically linked"
V=${SHLF_V_CURL:-8.21.0}
KIND=tarxz
if [ "$OS" = linux ]; then
  URL="https://github.com/stunnel/static-curl/releases/download/$V/curl-linux-${A_UN}-${LIBC}-$V.tar.xz"
else
  UNSUP="static curl is published for Linux only"
fi
