# bash — GNU bash, statically linked, from robxu9/bash-static.
# Asset names carry no version, so the latest/download redirect stays current.
#
# Nothing here redirects HISTFILE: the core hands every session its own $HOME,
# so ~/.bash_history already lands inside $SHLF_HOME.
DESC="GNU bash, statically linked"
SESSION=1
case ${OS_M}/${A_UN} in
  linux/x86_64|linux/aarch64|macos/x86_64|macos/aarch64)
    URL="https://github.com/robxu9/bash-static/releases/latest/download/bash-${OS_M}-${A_UN}" ;;
  *)
    UNSUP="bash-static publishes no build for $OS/$(uname -m)" ;;
esac
