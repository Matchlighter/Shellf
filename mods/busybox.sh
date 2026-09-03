# busybox — hundreds of applets in one static binary, from busybox.net.
#
# SYSTEM_OK, for the same reason as curl: on any box where busybox matters it
# is already there, and that copy is the one other scripts expect. Only a box
# without one pays for the download. It is a multi-call binary, so the applet
# is the first argument: `shlf busybox unxz file.xz`.
DESC="hundreds of applets in one static binary"
SYSTEM_OK=1
V=${SHLF_V_BUSYBOX:-1.35.0}

# busybox.net publishes x86_64 and i686, and nothing else: no arm of any kind.
# Its directory names are not the spellings used elsewhere here either, so name
# them literally rather than reaching for A_UN, which calls i686 "x86".
case $OS/$(uname -m) in
  linux/x86_64|linux/amd64) SHLF_BB_A=x86_64 ;;
  linux/i686|linux/i386)    SHLF_BB_A=i686 ;;
  *)                        SHLF_BB_A= ;;
esac

if [ -n "$SHLF_BB_A" ]; then
  URL="https://busybox.net/downloads/binaries/$V-$SHLF_BB_A-linux-musl/busybox"
else
  # SYSTEM_OK is checked first, so this is only ever reached on a box that has
  # no busybox of its own, which on arm is unusual: busybox is normally how
  # such a box got a userland in the first place.
  UNSUP="busybox.net publishes x86_64 and i686 only, and this box has no busybox of its own"
fi
