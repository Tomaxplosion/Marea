const path = require('node:path');
const { fileURLToPath } = require('node:url');

function isTrustedURL(value, packaged, root) {
  try {
    const url = new URL(value);
    if (packaged) return url.protocol === 'file:' && !url.host &&
      path.resolve(fileURLToPath(url)).toLowerCase() === path.resolve(root, 'dist', 'index.html').toLowerCase();
    return url.origin === 'http://127.0.0.1:5173' && ['/', '/index.html'].includes(url.pathname);
  } catch { return false; }
}

function validateNotes(notes) {
  const names = new Set();
  let total = 0;
  if (!Array.isArray(notes) || notes.length > 1000) throw new TypeError('Demasiadas notas.');
  for (const note of notes) {
    if (!note || typeof note.name !== 'string' || note.name.length > 104 ||
      !/^[^<>:"/\\|?*\x00-\x1f]+\.txt$/i.test(note.name) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(note.name) ||
      typeof note.content !== 'string' || Buffer.byteLength(note.content, 'utf8') > 2_000_000 ||
      names.has(note.name.toLowerCase())) throw new TypeError('Las notas de la copia no son válidas.');
    names.add(note.name.toLowerCase());
    total += Buffer.byteLength(note.content, 'utf8');
    if (total > 20_000_000) throw new RangeError('Las notas superan el límite de 20 MB.');
  }
}

module.exports = { isTrustedURL, validateNotes, MAX_BACKUP_BYTES: 256 * 1024 * 1024 };
