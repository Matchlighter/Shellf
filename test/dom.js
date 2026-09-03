// Minimal DOM shim: enough of innerHTML, selectors, and events to drive the
// real UI script without a browser.
const IDS = ['form','shells','modes','tools','toolsBox','toolsHint','out','said','prompt',
             'presetSaid','presetList','presetName','presetSave','presetReset','presetExport',
             'presetImport','presetFile','tool','home','homeHelpBtn','homeHelp','zshHelpBtn',
             'zshHelp','addPath','keepHome','strict','refresh','debug','mirror','mirrorLock',
             'adv','copy'];

function parseInputs(html, owner) {
  const inputs = [];
  for (const tag of html.match(/<input\b[^>]*>/g) || []) {
    const at = (n) => (tag.match(new RegExp(`${n}="([^"]*)"`)) || [, undefined])[1];
    inputs.push({ owner, type: at('type'), name: at('name'), value: at('value'),
                  id: at('id'), checked: /\bchecked\b/.test(tag), _h: {},
                  addEventListener(t, f) { this._h[t] = f; } });
  }
  return inputs;
}
function parseOptions(html) {
  const opts = [];
  for (const tag of html.match(/<option\b[^>]*>/g) || []) {
    const v = (tag.match(/value="([^"]*)"/) || [, ''])[1];
    opts.push({ value: v, selected: /\bselected\b/.test(tag) });
  }
  return opts;
}

function mkEl(id) {
  const e = {
    id, _html: '', _inputs: [], _options: [], _h: {}, _attrs: {},
    textContent: '', value: '', checked: false, open: false, disabled: false, style: {},
    addEventListener(t, f) { this._h[t] = f; },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    hasAttribute(k) { return k in this._attrs; },
    contains(n) { return n === this; },
    querySelector(sel) { return document.querySelector(sel, this); },
    select() {},
    click() { if (this._h.click) this._h.click(); },
    focus() {},
  };
  Object.defineProperty(e, 'innerHTML', {
    get() { return e._html; },
    set(v) {
      e._html = v;
      e._inputs = parseInputs(v, id);
      e._options = parseOptions(v);
      if (e._options.length) {
        const sel = e._options.find((o) => o.selected) || e._options[0];
        e.value = sel.value;
      }
    },
  });
  return e;
}

function build() {
  const els = {};
  for (const i of IDS) els[i] = mkEl(i);

  function allInputs(scope) {
    if (scope && scope.id) return els[scope.id]._inputs;
    let out = [];
    for (const i of IDS) out = out.concat(els[i]._inputs);
    // Standalone controls reached only by id behave like inputs too.
    for (const i of ['tool','home','mirror','addPath','keepHome','strict','refresh','debug']) out.push(els[i]);
    return out;
  }
  function match(sel, list) {
    let want = list;
    const scoped = sel.match(/^#(\w+)\s+(.*)$/);
    if (scoped) { want = els[scoped[1]]._inputs; sel = scoped[2]; }
    const attrs = [...sel.matchAll(/\[(\w+)="([^"]*)"\]/g)].map((m) => [m[1], m[2]]);
    const onlyChecked = sel.includes(':checked');
    return want.filter((n) =>
      attrs.every(([k, v]) => String(n[k]) === v) && (!onlyChecked || n.checked));
  }
  const docH = {};
  global.document = {
    addEventListener: (t, f) => { docH[t] = f; },
    _h: docH,
    getElementById: (id) => els[id],
    querySelector(sel, scope) { return match(sel, allInputs(scope))[0] || null; },
    querySelectorAll(sel) { return match(sel, allInputs()); },
    createElement: () => mkEl('tmp'),
    body: { appendChild() {}, removeChild() {} },
    execCommand: () => true,
  };
  els.__doc = docH;
  return els;
}
module.exports = { build };
