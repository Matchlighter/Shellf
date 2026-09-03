// The explainer popups, the fish easter egg, and drift guards against the script.
const fs = require('fs');
const { build: mkdom } = require('./dom.js');
const { read, uiSource } = require('./load.js');
const code = uiSource();

function start() {
  const store = {};
  const els = mkdom();
  global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  global.location = { origin: 'https://sh.me.net' };
  global.navigator = { clipboard: {} };
  global.fetch = () => Promise.reject(new Error('offline'));
  global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
  global.Blob = class { constructor(p) { this.p = p; } };
  eval(code);
  return els;
}
let fail = 0;
const eq = (l, got, want) => { if (got === want) console.log(`  ok   ${l}`);
  else { fail++; console.log(`  FAIL ${l}\n       got:  ${got}\n       want: ${want}`); } };
const ok = (l, c) => eq(l, !!c, true);

const els = start();
const btn = els.homeHelpBtn, pop = els.homeHelp, doc = els.__doc;
const zbtn = els.zshHelpBtn, zpop = els.zshHelp;

eq('starts closed', pop.hidden, true);
eq('button reports collapsed', btn.getAttribute('aria-expanded'), 'false');

btn._h.click({});
eq('click opens it', pop.hidden, false);
eq('button reports expanded', btn.getAttribute('aria-expanded'), 'true');

btn._h.click({});
eq('click again closes it', pop.hidden, true);

btn._h.click({});
doc.keydown({ key: 'Escape' });
eq('Escape closes it', pop.hidden, true);
eq('and updates the button', btn.getAttribute('aria-expanded'), 'false');

btn._h.click({});
doc.keydown({ key: 'a' });
eq('other keys leave it alone', pop.hidden, false);

doc.click({ target: els.tool });
eq('a click elsewhere closes it', pop.hidden, true);

btn._h.click({});
doc.click({ target: pop });
eq('a click inside keeps it open', pop.hidden, false);

// --- the zsh explainer, and only one popup open at a time ---------------
eq('zsh popup starts closed', zpop.hidden, true);
zbtn._h.click({});
eq('zsh popup opens', zpop.hidden, false);
btn._h.click({});
eq('opening the other closes it', zpop.hidden, true);
eq('and the other is open', pop.hidden, false);
eq('closed button reports collapsed', zbtn.getAttribute('aria-expanded'), 'false');
zbtn._h.click({});
eq('and back the other way', pop.hidden, true);
doc.keydown({ key: 'Escape' });
eq('Escape closes the zsh one too', zpop.hidden, true);

// The card button must not double as a click on the radio label.
let prevented = false;
zbtn._h.click({ preventDefault: () => { prevented = true; } });
ok('the card button cancels label activation', prevented);
doc.keydown({ key: 'Escape' });

// The text has to match what shlf actually does, so check the order is all there.
const src = read('server/ui/index.html');
// Anchor every search inside this panel: there is more than one .last now.
const hStart = src.indexOf('id="homeHelp"');
const body = src.slice(hStart, src.indexOf('</div>', src.indexOf('class="last"', hStart)));
const order = ['bin/shlf', 'XDG_CACHE_HOME/shlf', '~/.shlf', '/dev/shm/shlf', '/tmp/shlf', './.shlf'];
let at = -1, sorted = true;
for (const frag of order) {
  const i = body.indexOf(frag);
  if (i < 0 || i < at) sorted = false;
  at = i;
}
ok('every candidate is listed, in the order shlf tries them', sorted);
ok('mentions the write-and-exec test', body.includes('wrote a small script there and ran it'));
ok('mentions noexec', body.includes('noexec'));

// Drift guard: the popup describes shlf_pick_home, so the candidate count has
// to match the script. Add a sixth candidate there and this fails here.
const shlf = read('shlf');
const loop = shlf.slice(shlf.indexOf('for shlf_d in'), shlf.indexOf('do', shlf.indexOf('for shlf_d in')));
const inScript = loop.split('\n').filter((l) => l.includes('"')).length;
// Only the inner <ul>, which is the candidate list itself.
const ul = body.slice(body.indexOf('<ul>'), body.indexOf('</ul>'));
const inPopup = (ul.match(/<li>/g) || []).length;
eq('popup lists the same number of candidates as the script', inPopup, inScript);
for (const frag of ['XDG_CACHE_HOME', '/dev/shm', '/tmp/shlf', './.shlf']) {
  ok(`script candidate ${frag} is described`, body.includes(frag));
}

// The zsh figures are measured, so they have to match the module and the tree.
const zbody = src.slice(src.indexOf('id="zshHelp"'), src.indexOf('</div>', src.indexOf('id="zshHelp"')));
ok('explains the tree, not just its size', zbody.includes('share/zsh') && zbody.includes('function library'));
ok('names the shim', zbody.includes('tools/zsh.d') && zbody.includes('shim'));
ok('gives the unpacked size', zbody.includes('23.7'));
ok('gives the wire size', zbody.includes('3.6'));
ok('compares with the other two', zbody.includes('14.1') && zbody.includes('2.3'));
ok('mentions the hook it needs', zbody.includes('mod_install'));
ok('the card note is short and concrete', src.includes('note: "24 MB unpacked"'));

// --- the fish easter egg ------------------------------------------------
const shellsHtml = els.shells._html;
ok('fish carries a title tooltip',
   /class="note" title="like me \u2014 the opinionated part, not the friendly part"/.test(shellsHtml));
ok('it hangs off the note, not the whole card', shellsHtml.includes('<span class="note" title='));
ok('no ? button advertises it', (shellsHtml.match(/qmark/g) || []).length === 1);
ok('the other cards have no tooltip', (shellsHtml.match(/title="like me/g) || []).length === 1);
ok('a hover cue exists but nothing visual', src.includes('.cards .note[title] { cursor: help; }'));

// Drift guard for the structural claims: the sizes are measured, but where it
// unpacks and which hook it uses are things the module could change.
const zmod = read('mods/zsh.sh');
ok('module still unpacks to tools/zsh.d, as the popup says', zmod.includes('tools/zsh.d'));
ok('module still uses mod_install, as the popup says', zmod.includes('mod_install()'));
ok('module still writes a shim, as the popup says', zmod.includes('exec "$SHLF_HOME/tools/zsh.d/bin/zsh"'));

console.log(fail ? `\n${fail} failing` : '\nall passing');
process.exit(fail ? 1 : 0);
