// The PATH command form, advanced options, the mirror lock, and export/import.
const fs = require('fs');
const { build: mkdom } = require('./dom.js');
const { read, uiSource } = require('./load.js');
const code = uiSource();
const INDEX = `bash - GNU bash\ncroc - croc\njq - jq\nrg - rg\nwormhole - wormhole\n`;
const BOOT = "#!/bin/sh\n# Shellf bootstrap";

function start(seed) {
  const store = Object.assign({}, seed);
  const els = mkdom();
  let exported = null;
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
  };
  global.location = { origin: 'https://sh.me.net' };
  global.navigator = { clipboard: { writeText: async () => {} } };
  global.fetch = (u) => Promise.resolve({ ok: true,
    text: () => Promise.resolve(u.includes('bootstrap') ? BOOT : INDEX) });
  global.URL = { createObjectURL: (b) => { exported = b; return 'blob:x'; }, revokeObjectURL() {} };
  global.Blob = class { constructor(p) { this.p = p; } text() { return Promise.resolve(this.p.join('')); } };
  eval(code);
  const hit = (i, del) => ({ target: { closest: () => ({
    getAttribute: () => String(i), hasAttribute: (a) => !!del && a === 'data-del' }) } });
  return {
    els, store,
    tick: () => new Promise((r) => setTimeout(r, 5)),
    cmd: () => els.out.textContent,
    click: (id) => els[id]._h.click(),
    change: () => els.form._h.change(),
    loadPreset: (i) => els.presetList._h.click(hit(i, false)),
    presets: () => JSON.parse(store['shellf.presets.v1'] || '[]'),
    prefs: () => JSON.parse(store['shellf.prefs.v1'] || '{}'),
    exported: () => exported,
    setBool: (id, on) => { els[id].checked = on; },
    lock: () => els.mirrorLock._h.click(),
    lockState: () => ({ pressed: els.mirrorLock.getAttribute('aria-pressed'),
                        disabled: els.mirrorLock.disabled,
                        icon: els.mirrorLock.textContent }),
    pick: (g, v) => els[g]._inputs.forEach((i) => { i.checked = i.value === v; }),
    check: (t, on = true) => { els.tools._inputs.find((i) => i.value === t).checked = on; },
    importFile: (text) => els.presetFile._h.change({ target: { files: [{ text: () => Promise.resolve(text) }], value: 'x' } }),
  };
}
let fail = 0;
const eq = (l, got, want) => { if (got === want) console.log(`  ok   ${l}`);
  else { fail++; console.log(`  FAIL ${l}\n       got:  ${got}\n       want: ${want}`); } };
const ok = (l, c) => eq(l, !!c, true);

(async () => {
  const U = 'https://sh.me.net/';
  // --- PATH form is the default ------------------------------------------
  let s = start({});
  eq('default puts shlf on PATH', s.cmd(),
     `eval "$(curl -fsSL ${U} | sh -s -- setup)" && shlf`);
  s.pick('shells', 'zsh'); s.change();
  eq('named shell rides the trailing command', s.cmd(),
     `eval "$(curl -fsSL ${U} | sh -s -- setup)" && shlf zsh`);
  ok('no redundant SHLF_DEFAULT in the PATH form', !s.cmd().includes('SHLF_DEFAULT'));
  s.pick('shells', 'none'); s.change();
  eq('install only stops after setup', s.cmd(), `eval "$(curl -fsSL ${U} | sh -s -- setup)"`);

  s.pick('shells', 'zsh'); s.setBool('addPath', false); s.change();
  eq('toggled off gives the plain pipe', s.cmd(), `curl -fsSL ${U} | SHLF_DEFAULT=zsh sh`);
  s.setBool('addPath', true); s.change();
  await s.tick();
  s.check('croc'); s.change();
  eq('eager rides along', s.cmd(),
     `eval "$(curl -fsSL ${U} | SHLF_EAGER=croc sh -s -- setup)" && shlf zsh`);
  s.els.tool.value = 'croc send f'; s.change();
  eq('a tool becomes the trailing command', s.cmd(),
     `eval "$(curl -fsSL ${U} | SHLF_EAGER=croc sh -s -- setup)" && shlf croc send f`);

  // --- the new advanced options ------------------------------------------
  s = start({});
  await s.tick();
  ['keepHome', 'strict', 'refresh', 'debug'].forEach((k) => s.setBool(k, true));
  s.els.mirror.value = 'https://m/b';
  s.change();
  s.lock();          // mirror only is the lock, not a checkbox
  eq('every option reaches the command', s.cmd(),
     `eval "$(curl -fsSL ${U} | SHLF_MIRROR=https://m/b SHLF_MIRROR_ONLY=1 SHLF_STRICT=1 `
     + `SHLF_KEEP_HOME=1 SHLF_REFRESH=1 SHLF_DEBUG=1 sh -s -- setup)" && shlf`);
  ok('options persist', s.prefs().keepHome === true && s.prefs().debug === true);

  // --- the mirror lock ----------------------------------------------------
  s = start({});
  await s.tick();
  eq('lock is disabled with no mirror', s.lockState().disabled, true);
  eq('and shows open', s.lockState().icon, '\u{1F513}');
  s.lock();
  ok('clicking it does nothing without a mirror', !s.cmd().includes('MIRROR_ONLY'));
  s.els.mirror.value = 'https://m/b'; s.change();
  eq('a mirror enables it', s.lockState().disabled, false);
  s.lock();
  eq('locked shows closed', s.lockState().icon, '\u{1F512}');
  eq('locked reports pressed', s.lockState().pressed, 'true');
  ok('locked emits MIRROR_ONLY', s.cmd().includes('SHLF_MIRROR=https://m/b SHLF_MIRROR_ONLY=1'));
  s.lock();
  ok('unlocking drops it', !s.cmd().includes('MIRROR_ONLY'));
  s.lock();
  s.els.mirror.value = ''; s.change();
  eq('clearing the mirror disables it again', s.lockState().disabled, true);
  ok('and MIRROR_ONLY is not emitted alone', !s.cmd().includes('MIRROR_ONLY'));
  ok('though the preference is remembered', s.prefs().mirrorOnly === true);
  s.els.mirror.value = 'https://m/b'; s.change();
  ok('so it comes back with the mirror', s.cmd().includes('SHLF_MIRROR_ONLY=1'));
  s.setBool('debug', true); s.change();
  ok('an unrelated form change keeps the lock', s.cmd().includes('SHLF_MIRROR_ONLY=1'));

  // --- paste mode ---------------------------------------------------------
  s = start({});
  await s.tick();
  s.pick('modes', 'paste'); s.change();
  await s.tick();
  ok('paste does not export SHLF_NO_PATH by default', !s.cmd().includes('SHLF_NO_PATH'));
  s.setBool('addPath', false); s.change();
  await s.tick();
  ok('toggled off, paste tells the bootstrap to leave PATH alone',
     s.cmd().includes('SHLF_NO_PATH=1'));

  // --- export -------------------------------------------------------------
  s = start({});
  await s.tick();
  s.click('presetExport');
  const blob = s.exported();
  ok('export produced a blob', !!blob);
  const text = await blob.text();
  const parsed = JSON.parse(text);
  eq('export wraps the presets', parsed.presets.length, 4);
  eq('export names them', parsed.presets[0].name, 'Install only');
  ok('export reports the count', s.els.presetSaid.textContent.includes('Exported 4'));

  // --- import -------------------------------------------------------------
  s = start({});
  await s.tick();
  s.importFile(JSON.stringify({ presets: [{ name: 'From a friend', prefs: { shell: 'zsh', eager: ['rg'] } }] }));
  await s.tick();
  eq('import merges, keeping mine', s.presets().length, 5);
  ok('import reports the count', s.els.presetSaid.textContent.includes('Imported 1 preset'));
  const got = s.presets().find((p) => p.name === 'From a friend');
  eq('imported config survives', `${got.prefs.shell} ${got.prefs.eager}`, 'zsh rg');
  ok('imported prefs are shaped to defaults', got.prefs.addPath === true);

  s.importFile(JSON.stringify([{ name: 'Install only', prefs: { shell: 'bash' } }]));
  await s.tick();
  eq('a bare array is accepted, and merges by name', s.presets().length, 5);
  eq('same name is replaced', s.presets().find((p) => p.name === 'Install only').prefs.shell, 'bash');

  s.importFile('not json at all');
  await s.tick();
  ok('bad json is reported', s.els.presetSaid.textContent.includes('not JSON'));
  s.importFile('{"nope": 1}');
  await s.tick();
  ok('no presets is reported', s.els.presetSaid.textContent.includes('No presets'));
  s.importFile(JSON.stringify([{ name: '', prefs: {} }, { prefs: {} }]));
  await s.tick();
  ok('nameless entries are skipped', s.els.presetSaid.textContent.includes('No presets'));

  s.importFile(JSON.stringify([{ name: 'Junk', prefs: { eager: 'not-an-array', shell: 42, debug: 'yes' } }]));
  await s.tick();
  const junk = s.presets().find((p) => p.name === 'Junk');
  eq('bad field types are corrected', JSON.stringify(junk.prefs.eager), '[]');
  eq('bad shell falls back', junk.prefs.shell, 'fish');
  eq('bad boolean falls back', junk.prefs.debug, false);

  console.log(fail ? `\n${fail} failing` : '\nall passing');
  process.exit(fail ? 1 : 0);
})();
