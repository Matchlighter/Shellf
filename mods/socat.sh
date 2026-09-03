# socat — bidirectional data relay, static build from ernw/static-toolbox.
DESC="bidirectional data relay"
V=${SHLF_V_SOCAT:-1.7.4.4}
if [ "$OS" = linux ]; then
  URL="https://github.com/ernw/static-toolbox/releases/download/socat-v$V/socat-$V-${A_UN}"
else
  UNSUP="static socat is published for Linux only"
fi
