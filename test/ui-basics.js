// Delivery modes, presets, the tools list, and paste output.
const fs = require('fs');
const { build: mkdom } = require('./dom.js');
const { read, uiSource } = require('./load.js');
const code = uiSource();

const INDEX = `# name flags desc
bash    -              GNU bash, statically linked
croc    -              encrypted file transfer with a code phrase
busybox linux,usesys   applets in one binary
nolinker nolink        kept to exercise the flag
dust    -              disk usage, sorted and visual
fd      -              friendlier find
fish    linux          friendly interactive shell
jq      -              JSON processor
rg      -              ripgrep, fast recursive search
wormhole -             magic wormhole
zsh     -              zsh
`;
const BOOT = "#!/bin/sh\n# Shellf bootstrap\nshlf_dl() { :; }";

function start(seed) {
  const store = Object.assign({}, seed);
  const els = mkdom();
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
  };
  global.location = { origin: 'https://sh.me.net' };
  global.navigator = { clipboard: { writeText: async () => {} } };
  global.fetch = (u) => Promise.resolve({ ok: true,
    text: () => Promise.resolve(u.includes('bootstrap') ? BOOT : INDEX) });
  global.exported = null;
  global.URL = { createObjectURL: (b) => { global.exported = b; return 'blob:x'; },
                 revokeObjectURL: () => {} };
  global.Blob = class { constructor(parts) { this.parts = parts; } text() { return Promise.resolve(this.parts.join('')); } };
  global.setTimeout = setTimeout;
  eval(code);
  // The preset list uses one delegated listener, so drive it with the event
  // shape the handler actually reads.
  const hit = (i, del) => ({ target: { closest: () => ({
    getAttribute: () => String(i),
    hasAttribute: (a) => !!del && a === 'data-del',
  }) } });
  return {
    els, store,
    tick: () => new Promise((r) => setTimeout(r, 5)),
    loadPreset: (i) => els.presetList._h.click(hit(i, false)),
    delPreset: (i) => els.presetList._h.click(hit(i, true)),
    clickOutside: () => els.presetList._h.click({ target: { closest: () => null } }),
    click: (id) => els[id]._h.click(),
    change: () => els.form._h.change(),
    presets: () => JSON.parse(store['shellf.presets.v1'] || '[]'),
    prefs: () => JSON.parse(store['shellf.prefs.v1'] || '{}'),
    mode: () => JSON.parse(store['shellf.mode.v1'] || '"unset"'),
    check: (t, on = true) => { els.tools._inputs.find((i) => i.value === t).checked = on; },
    pick: (group, value) => els[group]._inputs.forEach((i) => { i.checked = i.value === value; }),
  };
}

let fail = 0;
const eq = (label, got, want) => {
  if (got === want) { console.log(`  ok   ${label}`); return; }
  fail++; console.log(`  FAIL ${label}\n       got:  ${got}\n       want: ${want}`);
};
const ok = (label, cond) => eq(label, !!cond, true);

(async () => {
  // --- modes --------------------------------------------------------------
  let s = start({});
  eq('default mode is curl', s.els.out.textContent, 'eval "$(curl -fsSL https://sh.me.net/ | sh -s -- setup)" && shlf');

  s.pick('modes', 'wget'); s.change();
  eq('wget is a mode, not a checkbox', s.els.out.textContent, 'eval "$(wget -qO- https://sh.me.net/ | sh -s -- setup)" && shlf');
  eq('mode stored under its own key', s.mode(), 'wget');
  ok('mode is not in prefs', !('mode' in s.prefs()) && !('wget' in s.prefs()));

  s = start({ 'shellf.mode.v1': '"wget"' });
  eq('stored mode is restored', s.els.out.textContent, 'eval "$(wget -qO- https://sh.me.net/ | sh -s -- setup)" && shlf');
  s = start({ 'shellf.mode.v1': '"nonsense"' });
  eq('a bogus stored mode falls back', s.els.out.textContent, 'eval "$(curl -fsSL https://sh.me.net/ | sh -s -- setup)" && shlf');

  // --- mode is not part of a preset --------------------------------------
  s = start({});
  await s.tick();
  s.pick('modes', 'wget'); s.pick('shells', 'zsh'); s.check('jq'); s.change();
  s.els.presetName.value = 'Mine';
  s.click('presetSave');
  const mine = s.presets().find((p) => p.name === 'Mine');
  ok('saved preset omits mode', !('mode' in mine.prefs) && !('wget' in mine.prefs));
  eq('saved preset keeps the config', `${mine.prefs.shell} ${mine.prefs.eager}`, 'zsh jq');

  s.loadPreset(1);                                  // "Grab a file"
  eq('loading a preset leaves mode alone', s.mode(), 'wget');
  eq('loading a preset still applies config', s.els.out.textContent,
     `eval "$(wget -qO- https://sh.me.net/ | SHLF_EAGER='croc wormhole' sh -s -- setup)" && shlf bash`);

  // --- sidebar list -------------------------------------------------------
  s = start({});
  await s.tick();
  eq('seeded four presets', s.presets().length, 4);
  ok('sidebar lists names', s.els.presetList._html.includes('Install only')
     && s.els.presetList._html.includes('Locked-down box'));
  ok('sidebar shows a summary', s.els.presetList._html.includes('bash · 2 tools'));
  ok('no preset highlighted yet', !s.els.presetList._html.includes('class="on"'));

  s.loadPreset(3);                                  // "Locked-down box"
  eq('loaded the right one', s.els.out.textContent,
     'eval "$(curl -fsSL https://sh.me.net/ | SHLF_EAGER=croc SHLF_HOME=/dev/shm/shlf SHLF_STRICT=1 sh -s -- setup)" && shlf bash');
  ok('loaded preset is highlighted', s.els.presetList._html.includes('class="on"'));
  eq('name box is filled for overwriting', s.els.presetName.value, 'Locked-down box');

  s.loadPreset(0);                                  // "Install only"
  eq('omitted fields reset to default', s.els.out.textContent,
     'eval "$(curl -fsSL https://sh.me.net/ | sh -s -- setup)"');

  // --- delete via the row button -----------------------------------------
  s.delPreset(0);
  eq('deleted one', s.presets().length, 3);
  ok('delete clears the highlight', !s.els.presetList._html.includes('class="on"'));
  s.clickOutside();
  eq('a click on empty space does nothing', s.presets().length, 3);

  s.click('presetReset');
  eq('restored defaults', s.presets().length, 4);

  s = start({ 'shellf.presets.v1': '[]' });
  ok('empty list says so', s.els.presetList._html.includes('No saved presets'));
  eq('empty list is not re-seeded', s.presets().length, 0);

  // --- eager and paste, still working ------------------------------------
  s = start({});
  await s.tick();
  s.check('croc'); s.check('rg'); s.change();
  eq('eager tools', s.els.out.textContent,
     `eval "$(curl -fsSL https://sh.me.net/ | SHLF_EAGER='croc rg' sh -s -- setup)" && shlf`);

  s.pick('modes', 'paste'); s.change();
  await s.tick();
  ok('paste exports settings', s.els.out.textContent.startsWith("export SHLF_EAGER='croc rg'\n"));
  ok('paste includes the bootstrap', s.els.out.textContent.includes('# Shellf bootstrap'));
  ok('paste hides the prompt', s.els.prompt.hidden === true);
  s.els.tool.value = 'croc send f'; s.change();
  await s.tick();
  ok('a tool becomes positional params', s.els.out.textContent.includes('\nset -- croc send f\n'));

  s.pick('modes', 'curl'); s.change();
  ok('back to a pipe restores the prompt', s.els.prompt.hidden === false);
  eq('mode change persisted', s.mode(), 'curl');

  // --- flag badges --------------------------------------------------------
  // Four expected from the fixture: busybox carries linux and usesys, fish
  // carries linux, nolinker carries nolink. Everything else is unflagged.
  s = start({});
  await s.tick();
  const th = s.els.tools._html;
  ok('Linux-only tools are badged', th.includes('Linux only'));
  ok('usesys tools are badged', th.includes('system if present'));
  ok('nolink tools are badged', th.includes('not on PATH'));
  eq('and nothing else is', (th.match(/class="badge"/g) || []).length, 4);

  // --- tools disclosure ---------------------------------------------------
  s = start({});
  await s.tick();
  eq('closed by default', s.els.toolsBox.open, false);
  eq('summary says what happens with none checked', s.els.toolsHint.textContent,
     'all install on first use');
  s.check('croc'); s.change();
  eq('summary counts one', s.els.toolsHint.textContent, '1 to install up front');
  s.check('rg'); s.change();
  eq('summary counts two', s.els.toolsHint.textContent, '2 to install up front');
  s.els.toolsBox.open = true;
  s.els.toolsBox._h.toggle();
  eq('open state persisted', s.store['shellf.tools.v1'], 'true');
  s = start({ 'shellf.tools.v1': 'true' });
  eq('open state restored', s.els.toolsBox.open, true);
  s = start({ 'shellf.prefs.v1': JSON.stringify({ eager: ['croc'] }) });
  await s.tick();
  eq('summary reflects a saved selection', s.els.toolsHint.textContent, '1 to install up front');

  // --- html escaping in a preset name ------------------------------------
  s = start({ 'shellf.presets.v1': JSON.stringify([{ name: '<img src=x>', prefs: {} }]) });
  ok('preset names are escaped', s.els.presetList._html.includes('&lt;img src=x&gt;')
     && !s.els.presetList._html.includes('<img src=x>'));

  // --- storage blocked ----------------------------------------------------
  const els = mkdom();
  global.localStorage = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  global.location = { origin: 'https://sh.me.net' };
  global.navigator = { clipboard: {} };
  global.fetch = () => Promise.reject(new Error('offline'));
  eval(code);
  eq('works with storage blocked', els.out.textContent, 'eval "$(curl -fsSL https://sh.me.net/ | sh -s -- setup)" && shlf');
  els.presetName.value = 'x';
  els.presetSave._h.click();
  ok('save reports blocked storage', els.presetSaid.textContent.includes('blocking storage'));

  console.log(fail ? `\n${fail} failing` : '\nall passing');
  process.exit(fail ? 1 : 0);
})();
