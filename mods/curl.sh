# curl — statically linked, for boxes that have no HTTP client at all.
#
# SYSTEM_OK, because what you want here is a working HTTP client, not
# specifically this one. If the box already has curl, that is what runs and
# nothing is downloaded, which is what makes it safe to put on PATH ahead of
# the system copy.
DESC="HTTP client, statically linked"
SYSTEM_OK=1
V=${SHLF_V_CURL:-8.21.0}
KIND=tarxz
if [ "$OS" = linux ]; then
  URL="https://github.com/stunnel/static-curl/releases/download/$V/curl-linux-${A_UN}-${LIBC}-$V.tar.xz"
else
  UNSUP="static curl is published for Linux only"
fi
