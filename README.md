# Shellf

A lazy, universal entrypoint for boxes you can't install anything on.

```sh
curl -fsSL https://sh.example.com | sh                     # install, then a shell
curl -fsSL https://sh.example.com | sh -s -- croc send f   # install, then run one tool
./shlf zsh                                            # the full syntax
./shlf                                                # alias for the default
croc send f                                           # after `shlf link`, off PATH
```

`shlf` is one POSIX sh file that knows nothing about any particular tool. Each
tool is a module fetched on demand and cached. Adding a tool means dropping one
file on the host, with no change to the core.

Open the same URL in a browser and you get a small WebUI that picks your shell,
chooses which tools to install up front, saves that as a preset, and hands you
the exact command. For a box with no curl and no wget at all, it hands you a
short bootstrap script to paste in directly instead.

## Why it exists.

Pulling a file off a slimmed-down app server means either the box has the tool
you want or you have to figure out how to get it (or remember how you got it last
time - is it really ever just "once"?).
Shellf exists to try and simplify that, giving you a stronger foothold with just "one" line of
shell script - you could remember it if you're good at that sort of thing, or you can grab it
quickly from the online config page.

## Hosting
At the present time, I'm not advertising public hosting. Even if I did, I'd highly suggest you just
run it yourself anyway - wherever you host the scripts should be somewhere you highly trust as it would be
all too easy for a malicious hoster to inject something nasty.

## LLMs
If you couldn't tell, yes, this was largely LLM generated and refined further by additional prompting
and some intervention. It's probably not perfect, but I have made some effort to clean it up beyond
the raw output.

## Commands.

| Command | What it does |
| --- | --- |
| `shlf <tool> [args]` | Fetch once, then run a tool |
| `shlf` | Alias for `shlf $SHLF_DEFAULT`, which is `fish` |
| `shlf list` | Show tools and which are cached |
| `shlf which <tool>` | Print the cached path, fetching if needed |
| `shlf setup` | Install, then print shell code that puts it on `PATH` |
| `shlf install <tools>` | Install now, instead of on first use |
| `shlf link [tools]` | Symlink tool names next to `shlf`, busybox style |
| `shlf env` | Print the `PATH` export line |
| `shlf dirs` | Print every directory it writes to |
| `shlf self-install` | Copy `shlf` into the cache dir |
| `shlf clean` | Delete the cache |

`shlf <tool>` is the real syntax. A bare `shlf` just runs the default command,
and it's the one case that falls back to whatever shell the box already has if
the default can't be installed. `shlf zsh` asked for zsh, so it fails plainly
instead.

## What it tells you.

On a box you don't own, two questions matter: where did this thing just write,
and how do I get back in. So it says both.

```
$ curl -fsSL https://sh.example.com | sh
shlf: writing under /tmp/shlf-1000  (bin, tools, mods, home)
shlf: with its own $HOME at /tmp/shlf-1000/home, so your dotfiles stay untouched
shlf: linked: bash croc dust fd fish jq rclone rg socat wormhole yq zsh
…
                                        ← your shell session
shlf: back in with:  /tmp/shlf-1000/bin/shlf
```

`shlf dirs` prints the same thing as tab-separated pairs, for when you'd rather
pipe it than read it.

The re-entry hint comes *after* the session ends, when the terminal has
scrolled past everything else. That's what the module `SESSION` flag is for:
the core runs a session and waits, rather than exec'ing and losing the thread.
A plain tool still execs, since you never entered a session to leave.

That path works on its own: a copy of `shlf` inside a cache works out where
that cache is from its own location, so `$SHLF_HOME/bin/shlf` reuses it with
nothing exported, even if you'd picked a custom `SHLF_HOME` the first time.
Linked tools inherit that too — `croc` off `PATH` finds the same cache from a
fresh shell.

## Landing on PATH.

By default the WebUI hands you this shape, rather than a bare pipe:

```sh
eval "$(curl -fsSL https://sh.example.com/ | sh -s -- setup)" && shlf
```

A pipe runs in a subshell, so it cannot touch the PATH of the shell you pasted
into. `shlf setup` does the whole install and then prints two export lines on
stdout — every message it prints goes to stderr, which is what keeps stdout
clean enough to `eval`. What follows the `&&` then resolves through the PATH it
just set, which is also why the shell is named there instead of in
`SHLF_DEFAULT`.

The payoff is after you leave the session: `croc`, `rg`, and `shlf` are still
callable in the shell you started from. Nothing is persisted — no rc file is
touched, and a new terminal knows nothing about it.

The paste-in bootstrap does the same thing, since a pasted script runs in your
shell. `SHLF_NO_PATH=1` turns it off there; in the WebUI it's the *Put `shlf` on
`PATH`* option, and switching it off gives you the plain pipe back.

## One directory, including its own HOME.

Everything lives under `$SHLF_HOME`, and that includes a `$HOME` of its own at
`$SHLF_HOME/home`. Every shell and tool shlf launches runs with that `HOME` and
with the XDG variables pointed inside it, so:

- your real dotfiles are never read or written,
- a read-only or missing `$HOME` stops being a special case,
- and deleting one directory undoes all of it.

The XDG variables are overridden rather than defaulted, because an inherited
`XDG_CONFIG_HOME` would otherwise send a shell straight back out to your real
config. `SHLF_KEEP_HOME=1` opts out and uses your own `$HOME` instead.

The upshot for shell modules is that none of them handle history any more:
`~/.bash_history` and `~/.zsh_history` already land inside `$SHLF_HOME`.

## Shells.

Three of them, all static, all Linux (bash and zsh also have macOS builds):

| `SHLF_DEFAULT` | What you get |
| --- | --- |
| `fish` | fish 4.x, one static-pie binary with its data files embedded |
| `bash` | GNU bash from `robxu9/bash-static`, a single binary |
| `zsh` | zsh from `romkatv/zsh-bin`, a relocatable tree plus its functions |
| `none` | Install and link, then stop |

Each one sets `SESSION=1`, which is the whole of what a shell module needs to
say beyond where to download it.

In the WebUI the zsh card carries a `?` explaining why it is the big one, with
the same figures as above. Tests assert that the popup's structural claims —
where it unpacks, the shim, the `mod_install` hook — still match the module.

zsh is the one tool that isn't a single binary. Its module uses `mod_install`
to extract the tree to `tools/zsh.d` and drop a shim at `tools/zsh`, so the
core still finds one executable where it expects one. That costs about 24 MB
unpacked, against 3.6 MB down the wire.

## Modules.

A module is a sourced sh file describing one tool. It runs with every platform
variable in scope and sets:

| Variable | Meaning |
| --- | --- |
| `URL` | Where to get it. Required, unless you define `mod_install` |
| `KIND` | `bin`, `targz`, `tarxz`, or `zip`. Defaults to `bin` |
| `EXE` | Binary name inside the archive. Defaults to the tool name |
| `V` | Version, used in the URL and the progress line |
| `DESC` | One line, for `shlf list` |
| `UNSUP` | Why it can't run here. Blocks install with that message |
| `SESSION` | `1` for an interactive session, so the core waits and then prints how to get back in |

The whole of `mods/croc.sh`:

```sh
DESC="encrypted file transfer with a code phrase"
V=${SHLF_V_CROC:-11.3.6}
KIND=targz
URL="https://github.com/schollz/croc/releases/download/v$V/croc_v${V}_${A_CROC}.tar.gz"
```

A module may also define one hook:

- `mod_install <dest> <tmpdir>` replaces the fetch entirely, for anything
  bespoke. Leave an executable at `<dest>`. See `mods/zsh.sh`, which unpacks a
  4,000-file tree and leaves a shim behind.

Platform naming varies per project, so pick the dialect you need:

| Variable | Example on Linux x86-64 |
| --- | --- |
| `OS`, `OS_M`, `OS_C` | `linux`, `linux`, `Linux` |
| `A_GO` | `amd64` |
| `A_UN` | `x86_64` |
| `A_C` | `64bit` |
| `A_RS` | `x86_64`, or empty where no Rust build exists |
| `A_RUST` | `x86_64-unknown-linux-musl` |
| `A_CROC` | `Linux-64bit` |
| `LIBC` | `musl` or `gnu` |

Prefer GitHub's `/releases/latest/download/` redirect where the asset name
carries no version, as `mods/jq.sh` and `mods/bash.sh` do. Pin a version only
when the name needs one.

### The index.

`mods/index` is what `shlf list`, `shlf link`, and the WebUI read, so linking
costs one fetch instead of one per tool. Three whitespace-separated fields:

```
# name    flags          description
croc      -              encrypted file transfer with a code phrase
curl      nolink,linux   HTTP client, statically linked
```

`nolink` keeps a tool out of `shlf link`, and `linux` marks a Linux-only build
so it isn't linked elsewhere. The module stays authoritative; these flags only
save `link` from fetching every module to find out.

`curl` and `busybox` are `nolink` on purpose: a stub named `curl` ahead of the
real one on `PATH` would hijack every other script on the box.

## Tools.

`bash`, `busybox`, `croc`, `curl`, `dust`, `fd`, `fish`, `jq`, `rclone`, `rg`,
`socat`, `wormhole`, `yq`, and `zsh`.

## Environment.

| Variable | Purpose |
| --- | --- |
| `SHLF_HOME` | Cache dir. Defaults to the first writable, exec-capable candidate |
| `SHLF_BASE` | Where `shlf`, `mods/`, and `sums.txt` are hosted |
| `SHLF_MODS` | Local module dir, for developing without hosting |
| `SHLF_MIRROR` | Your own binary mirror, tried before upstream |
| `SHLF_MIRROR_ONLY` | `1` refuses to fall back to upstream |
| `SHLF_STRICT` | `1` refuses any binary not listed in `sums.txt` |
| `SHLF_REFRESH` | `1` re-downloads binaries and modules even when cached |
| `SHLF_DEFAULT` | What a bare `shlf` runs: a tool name, or `none` |
| `SHLF_EAGER` | Tools to install up front, e.g. `SHLF_EAGER='croc rg'` |
| `SHLF_KEEP_HOME` | `1` uses your real `$HOME` instead of a contained one |
| `SHLF_DEBUG` | `1` shows the errors from each download attempt |
| `SHLF_V_<TOOL>` | Override a pinned version, e.g. `SHLF_V_CROC=11.0.0` |

## Boxes with no curl and no wget.

Detection is kept separate from installing, which makes two things possible.

**One, `shlf_dl` tries every client until one works**, rather than picking the
first one present: curl, wget, Ruby, python3, python, Perl, busybox, then
FreeBSD's `fetch`. Presence is not capability. A Debian slim image has `perl`
but not `LWP::Simple`, and busybox is often built without TLS; both look
installed and still fail. Per-attempt noise is hidden, so you get one clear
message instead of a pile of errors. `SHLF_DEBUG=1` shows them all.

**Two, that same code can be pasted in.** `GET /bootstrap` returns a short
script the server assembles from the marked region of `shlf` itself, so the
detection a bare box runs can never drift from the detection `shlf` runs. Paste
it into a shell and it finds a client, pulls `shlf`, and hands over. If nothing
on the box can fetch, it says exactly that and stops:

```
shlf: no way to download; tried curl, wget, ruby, python3, python, perl, busybox, and fetch
shlf: install any one of those, or copy the binaries in by hand
```

It is written to be pasted into an interactive shell, so it has no `set -e`,
never calls `exit`, and unsets its own helpers when it's done. It sets `$?` via
a subshell instead, which also means a saved copy still exits with the right
status. Configure it by setting variables first, and pass a tool with `set --`:

```sh
export SHLF_DEFAULT=bash SHLF_EAGER='croc rg'
set -- croc send file.tgz
# …then the bootstrap
```

It lands the download in the first writable directory it finds, says which one,
and runs it with `sh` rather than executing it, so a noexec `/tmp` is not a
problem either. `shlf` then does its own write-and-exec probe to pick a real
cache.

## The server.

`server/app.py` is a Bottle app that serves the script to shells and the WebUI
to browsers, off the same URL.

| Route | Response |
| --- | --- |
| `GET /` with `Accept: text/html` | The WebUI |
| `GET /` otherwise | The `shlf` script, `text/plain` |
| `GET /shlf` | The script, always |
| `GET /bootstrap` | The paste-in bootstrap, for boxes with no HTTP client |
| `GET /mods/index` | The module index |
| `GET /mods/<name>.sh` | One module |
| `GET /sums.txt` | Checksums, when present |
| `GET /healthz` | `ok` |

Two details worth knowing:

**It stamps its own origin into the script.** A piped script can't know where
it came from, so `SHLF_BASE` would stay at the compiled-in default and
self-install would reach for the wrong host. The server rewrites that one
default line to its own public URL on the way out, so a bare
`curl host | sh` works with no environment variables at all. Only the default
is touched, so an explicit `SHLF_BASE=` still wins. Set `SHELLF_PUBLIC_URL`
behind a proxy; otherwise it derives the origin from `X-Forwarded-Proto` and
`X-Forwarded-Host`, then `Host`. That value is interpolated into a shell
script, so it's allowlisted rather than escaped, and a host that fails the
pattern leaves the default untouched.

**Content negotiation only matches an explicit `text/html`.** curl sends
`Accept: */*` or nothing at all, and neither may match, or
`curl example.com | sh` would pipe an HTML page into a shell.

| Variable | Purpose |
| --- | --- |
| `SHELLF_ROOT` | Where `shlf` and `mods/` live. Defaults to the repo root |
| `SHELLF_PUBLIC_URL` | Pin the origin stamped into the script |
| `HOST`, `PORT` | Listen address. Defaults to `0.0.0.0:8080` |

Run it locally:

```sh
pip install -r server/requirements.txt
python3 server/app.py            # http://127.0.0.1:8080
```

Or from the published image. CI pushes one to GitHub Container Registry on
every push to the default branch, tagged `latest`, plus semver tags for `v*`
releases:

```sh
docker run -d -p 8080:8080 \
  -e SHELLF_PUBLIC_URL=https://sh.example.com \
  ghcr.io/matchlighter/shellf:latest
```

To build it yourself, note the context is the repo root, since the image
carries `shlf` and `mods/` as its payload:

```sh
docker build -f server/Dockerfile -t shellf .
docker run -d -p 8080:8080 -e SHELLF_PUBLIC_URL=https://sh.example.com shellf
```

## The WebUI.

`server/ui/index.html`, one file, no dependencies.

- **Default shell**, or `none` to install and stop.
- **Tools**, a collapsed list read from `/mods/index`, each with a checkbox to
  install it up front rather than on first use. That becomes `SHLF_EAGER`. The
  summary carries the count, so a closed list still tells you where you stand.
  Names the host no longer serves are pruned, so a saved configuration can't
  go stale.
- **Advanced**: a tool to run instead of a shell, `SHLF_HOME` with a `?` that
  explains how it gets resolved, `SHLF_MIRROR` with a padlock beside it, and a
  checkbox for each remaining switch — put `shlf` on `PATH`, keep my real
  `$HOME`, strict checksums, re-download, and show download errors.

`SHLF_MIRROR_ONLY` is that padlock rather than a checkbox, since it means
nothing without a mirror to lock to: it stays disabled until you fill the
mirror in, and the flag is never emitted without one. Locking it says fail
rather than reach upstream.
- **Delivery**, one of three: pipe with curl, pipe with wget, or paste.
- **Presets**, in a sidebar.

### Presets.

The `?` beside the cache directory opens a popup listing the resolution order
from `shlf_pick_home`: this field first, then a copy of shlf already installed
at `<dir>/bin/shlf`, then five probe candidates in order. A test asserts the
popup lists the same number of candidates as the script does, so the two can't
quietly drift apart.

`Export` writes every preset to `shellf-presets.json`. `Import` merges a file
back in, matching by name, so taking someone else's set doesn't cost you your
own. Anything imported is shaped to the known fields and types first, so one
malformed entry can't break the page. `Reset` restores the four defaults.

A sidebar list, each row showing the name and a one-line summary such as
`bash · 2 tools`. Click a tile to load it, and a `×` appears inside the tile on
hover to delete it. It stays visible on a touch screen, where there is no
hover, and on keyboard focus. The name box doubles as
save-or-overwrite (matching is case-insensitive, so you can't end up with two
near-identical names). Four are seeded on a first visit and everything after
that is yours. Clearing them all keeps them cleared, since an absent key means
a first visit while an empty list means you meant it; `Restore default presets`
brings them back.

Loading a preset resets anything it doesn't set, rather than letting the last
configuration linger.

### What a preset does not hold.

The delivery mode. Whether a box has curl, has wget, or has neither is a fact
about that box, not about how you want it set up, so the mode is remembered on
its own and a preset never touches it. Load a preset while in paste mode and
you stay in paste mode.

Presets and preferences live in `localStorage`, and every read and write is
guarded, so a private window or blocked storage just falls back to the
defaults. Preset names are escaped on the way into the page.

The command it builds is deliberately minimal: `fish` is the script's own
default so it's never spelled out, naming a tool drops the redundant
`SHLF_DEFAULT`, and values are quoted only when they need it.

## Mirroring the binaries.

`SHLF_MIRROR` makes the script fetch `$SHLF_MIRROR/<os>-<arch>/<tool>` as a
plain executable before trying upstream. That gives you one origin to allowlist
on egress-restricted boxes, and it sidesteps unpacking entirely, which matters
because some slim images can't decompress `.tar.xz` or `.zip`. Lay it out like
this:

```
/srv/mirror/linux-amd64/croc
/srv/mirror/linux-amd64/fish
/srv/mirror/linux-arm64/croc
```

## What it handles.

All tested against real containers, not assumed.

- **No curl, no wget, nothing.** Eight clients tried in turn until one
  actually works, and a paste-in bootstrap for when you can't even fetch the
  script. Ruby matters most in practice: app servers often have it when they
  have no curl.
- **No `xz`.** Tries `xz`, `unxz`, `xzcat`, python3's stdlib `lzma`, then
  busybox. A box with only Ruby can't unpack `.tar.xz` at all, so mirror those.
- **noexec `/tmp`.** The cache probe writes a script and runs it, so it detects
  noexec instead of failing later. Candidates: `$XDG_CACHE_HOME/shlf`,
  `$HOME/.shlf`, `/dev/shm`, `/tmp`, then `./.shlf`.
- **Read-only or missing `$HOME`.** Not handled so much as sidestepped: shlf
  brings its own.
- **Paths with spaces.** Including `SHLF_HOME`.
- **`PATH` shadowing.** Helper lookups run against a `PATH` with the stub dir
  removed, so the `curl` stub can never hijack the download that fetches it.
- **The install pipe.** A piped run holds stdin, so the terminal is handed back
  before exec, which interactive tools like croc need.

## Tests.

```sh
test/run.sh                 # no Docker needed
test/smoke.sh shellf:test   # runs a built image and checks what it serves
```

`run.sh` covers everything that doesn't need a container: `shlf` under `sh`,
`dash`, and `bash`, every module, the portable region slicing out and parsing
on its own, `server/app.py`, and three UI suites.

The UI suites run the page's real inline script through a small DOM shim in
`test/dom.js`, pulled straight out of `server/ui/index.html`, so they test what
ships rather than a copy of it. Several are drift guards rather than feature
tests: the `SHLF_HOME` popup has to list as many candidates as
`shlf_pick_home` actually tries, and the zsh popup's claims about
`tools/zsh.d`, the shim, and `mod_install` have to still match `mods/zsh.sh`.
Change the script and the docs fail with it.

`smoke.sh` starts the image on a throwaway Docker network and checks the real
thing: curl gets a shell script and a browser gets the page, the module index
and one module come back, the bootstrap is there, the origin is stamped in,
path traversal is refused — and then it does a full install from the served
script and confirms the `PATH` form leaves `shlf` callable in a real shell.

## Continuous integration.

`.github/workflows/ci.yml`, in three jobs:

1. **Syntax and UI tests** run `test/run.sh`, with `dash` installed first,
   because that's what `/bin/sh` is on Debian and it's stricter than bash about
   what this script relies on.
2. **Image** builds for the runner, runs `test/smoke.sh` against it, and only
   then logs in and pushes. Nothing gets published that hasn't served a real
   install first. The push covers `linux/amd64` and `linux/arm64`, since half
   the point of this project is boxes that aren't x86, and the image has no
   compiled dependencies to make that slow.
3. **Release**, on a `v*` tag only, drafts release notes carrying the
   `docker run` line for that exact tag.

Pull requests build and smoke test, but never push.

## Layout.

```
shlf                    the core, with a sliceable portable region
mods/index              the tool list
mods/<name>.sh          one per tool
server/app.py           Bottle app
server/ui/index.html    the WebUI
server/Dockerfile       build context is the repo root
test/run.sh             everything that does not need Docker
test/smoke.sh           runs a built image and checks it
.github/workflows/ci.yml
```

On the box:

```
$SHLF_HOME/tools/<tool>     binaries, fetched on first use
$SHLF_HOME/mods/<tool>.sh   modules, fetched on first use
$SHLF_HOME/bin/shlf         the core, plus one symlink per tool
$SHLF_HOME/home/            its own $HOME: config, history, dotfiles
```

`$SHLF_HOME/bin` is what goes on `PATH`. The symlinks exist before their
binaries do, so typing `rg` is what triggers the download.

For development, skip hosting entirely: `SHLF_MODS=./mods ./shlf list`.
