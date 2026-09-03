// Locates the repo and pulls the UI's inline script out of the page, so the
// suites test the file that actually ships rather than a copy of it.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function uiSource() {
  const m = read('server/ui/index.html').match(/<script>\n([\s\S]*?)\n<\/script>/);
  if (!m) throw new Error('no <script> block found in server/ui/index.html');
  return m[1];
}

module.exports = { ROOT, read, uiSource };
