# zsh — from romkatv/zsh-bin, which publishes a relocatable tree rather than a
# single binary: bin/zsh plus the share/zsh functions it needs at runtime.
# That is why this module uses mod_install instead of URL alone.
#
# Two versions to track: the zsh version in the file name, and the zsh-bin
# release tag that holds it.
DESC="zsh, relocatable build with its function tree"
SESSION=1
V=${SHLF_V_ZSH:-5.8}
SHLF_ZSH_REL=${SHLF_ZSH_REL:-v6.1.1}

# zsh-bin spells arm64 differently per OS, so name each asset explicitly.
case $OS/$(uname -m) in
  linux/x86_64|linux/amd64)    SHLF_ZSH_A=linux-x86_64 ;;
  linux/aarch64|linux/arm64)   SHLF_ZSH_A=linux-aarch64 ;;
  darwin/x86_64)               SHLF_ZSH_A=darwin-x86_64 ;;
  darwin/arm64|darwin/aarch64) SHLF_ZSH_A=darwin-arm64 ;;
  *)                           SHLF_ZSH_A= ;;
esac

if [ -n "$SHLF_ZSH_A" ]; then
  URL="https://github.com/romkatv/zsh-bin/releases/download/$SHLF_ZSH_REL/zsh-$V-$SHLF_ZSH_A.tar.gz"
else
  UNSUP="zsh-bin publishes no build for $OS/$(uname -m)"
fi

# The tree lands beside the binary as tools/zsh.d, and tools/zsh becomes a shim
# pointing into it, so the core still gets one executable where it expects one.
mod_install() { # dest tmpdir
  shlf_dl "$URL" "$2/zsh.tar.gz" || return 1
  shlf_verify "$2/zsh.tar.gz" "${URL##*/}"
  rm -rf "$SHLF_HOME/tools/zsh.d"
  mkdir -p "$SHLF_HOME/tools/zsh.d" || return 1
  gzip -dc "$2/zsh.tar.gz" | tar -C "$SHLF_HOME/tools/zsh.d" -xf - || return 1
  [ -x "$SHLF_HOME/tools/zsh.d/bin/zsh" ] || return 1
  cat > "$1" <<SHIM
#!/bin/sh
exec "$SHLF_HOME/tools/zsh.d/bin/zsh" "\$@"
SHIM
  chmod +x "$1"
}
