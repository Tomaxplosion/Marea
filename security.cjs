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

const YOUTUBE_APP_REFERRER = 'https://com.marea.lofi/';

function youtubeEmbedHeaders(details, trustedWindow) {
  const headers = { ...details.requestHeaders };
  if (!trustedWindow || details.resourceType !== 'subFrame') return headers;
  try {
    const url = new URL(details.url);
    if (url.protocol !== 'https:' || !['www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname) ||
      !url.pathname.startsWith('/embed/')) return headers;
    const referrerKeys = Object.keys(headers).filter((key) => key.toLowerCase() === 'referer');
    // Preserve a browser-provided HTTP(S) referrer, including YouTube's own requests.
    if (referrerKeys.some((key) => /^https?:\/\//i.test(headers[key]))) return headers;
    referrerKeys.forEach((key) => delete headers[key]);
    headers.Referer = YOUTUBE_APP_REFERRER;
  } catch {}
  return headers;
}

module.exports = { isTrustedURL, validateNotes, youtubeEmbedHeaders, YOUTUBE_APP_REFERRER, MAX_BACKUP_BYTES: 256 * 1024 * 1024 };
