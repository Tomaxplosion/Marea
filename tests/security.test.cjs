const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { isTrustedURL, validateNotes } = require('../security.cjs');

test('IPC permits only the exact application document', () => {
  const root = path.resolve(__dirname, '..');
  assert.equal(isTrustedURL(pathToFileURL(path.join(root, 'dist/index.html')).href, true, root), true);
  for (const url of ['https://evil.example', 'file:///C:/other/index.html', 'http://127.0.0.1:5173.evil.example/',
    'http://localhost:5173/', 'http://127.0.0.1:5173/src/main.jsx']) {
    assert.equal(isTrustedURL(url, true, root), false);
    assert.equal(isTrustedURL(url, false, root), false);
  }
  assert.equal(isTrustedURL('http://127.0.0.1:5173/', false, root), true);
});

test('note import rejects path escapes, reserved devices, case collisions and oversized notes', () => {
  for (const notes of [[{ name: '../escape.txt', content: '' }], [{ name: 'CON.txt', content: '' }],
    [{ name: 'Idea.txt', content: '' }, { name: 'idea.txt', content: '' }],
    [{ name: 'large.txt', content: 'x'.repeat(2_000_001) }], Array(1001).fill({ name: 'a.txt', content: '' })]) {
    assert.throws(() => validateNotes(notes));
  }
  assert.doesNotThrow(() => validateNotes([{ name: 'Idea.txt', content: 'Texto' }]));
});
