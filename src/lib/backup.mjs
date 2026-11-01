import { openTrackDatabase, readSavedTracks, TRACK_STORE } from './music.js';

export const BACKUP_KEYS = ['marea-tasks', 'marea-duration', 'marea-theme', 'marea-pet-visible',
  'marea-mood', 'marea-playlists', 'marea-youtube-tracks', 'marea-calendar-events', 'marea-session'];
const MAX_AUDIO_BYTES = 128 * 1024 * 1024;
const MAX_TRACK_BYTES = 64 * 1024 * 1024;
const MAX_FILE_CHARS = 256 * 1024 * 1024;

function validBase64(value) {
  if (value.length % 4 || value.length > Math.ceil(MAX_TRACK_BYTES / 3) * 4) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  for (let index = 0; index < value.length - padding; index++) {
    const code = value.charCodeAt(index);
    if (!(code >= 65 && code <= 90 || code >= 97 && code <= 122 || code >= 48 && code <= 57 || code === 43 || code === 47)) return false;
  }
  return true;
}

function encodeFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function createBackup(session) {
  const storage = Object.fromEntries(BACKUP_KEYS.filter((key) => localStorage.getItem(key) !== null)
    .map((key) => [key, localStorage.getItem(key)]));
  storage['marea-session'] = JSON.stringify(session);
  const tracks = [];
  const savedTracks = await readSavedTracks();
  if (savedTracks.length > 1000 || savedTracks.some((track) => track.file.size > MAX_TRACK_BYTES) ||
    savedTracks.reduce((total, track) => total + track.file.size, 0) > MAX_AUDIO_BYTES) {
    throw new RangeError('La copia admite hasta 128 MiB de audio, 64 MiB por pista.');
  }
  for (const track of savedTracks) {
    const { file, ...metadata } = track;
    tracks.push({ ...metadata, file: { name: file.name || 'audio', type: file.type,
      lastModified: file.lastModified || 0, data: await encodeFile(file) } });
  }
  return { format: 'marea-backup', version: 1, createdAt: new Date().toISOString(), storage, tracks };
}

export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_FILE_CHARS) throw new RangeError('La copia supera el límite permitido.');
  const data = JSON.parse(text);
  if (data?.format !== 'marea-backup' || data.version !== 1 || !data.storage || Array.isArray(data.storage) ||
    typeof data.storage !== 'object' || !Array.isArray(data.tracks) || data.tracks.length > 1000 ||
    !Array.isArray(data.notes) || data.notes.length > 1000) throw new Error('Formato de copia no compatible.');
  let storageBytes = 0;
  for (const [key, value] of Object.entries(data.storage)) {
    if (!BACKUP_KEYS.includes(key) || typeof value !== 'string') throw new Error('Ajustes no válidos.');
    storageBytes += new TextEncoder().encode(value).byteLength;
    if (storageBytes > 4 * 1024 * 1024) throw new RangeError('Los ajustes superan los 4 MiB.');
    if (['marea-tasks', 'marea-playlists', 'marea-youtube-tracks', 'marea-calendar-events'].includes(key) &&
      !Array.isArray(JSON.parse(value))) throw new Error('Datos no válidos.');
    if (key === 'marea-session') {
      const session = JSON.parse(value);
      if (!session || typeof session !== 'object' || typeof session.noteTitle !== 'string' ||
        typeof session.noteContent !== 'string' || !Number.isSafeInteger(session.seconds) || session.seconds < 0 || session.seconds > 28800 ||
        !Number.isFinite(session.volume) || session.volume < 0 || session.volume > 100 ||
        !['space', 'radio', 'notes', 'calendar'].includes(session.view)) throw new Error('Sesión no válida.');
    }
  }
  if (data.storage['marea-duration'] !== undefined && (!/^\d+$/.test(data.storage['marea-duration']) ||
    Number(data.storage['marea-duration']) < 1 || Number(data.storage['marea-duration']) > 480)) throw new Error('Duración no válida.');
  if (data.storage['marea-theme'] !== undefined && !['light', 'dark'].includes(data.storage['marea-theme'])) throw new Error('Tema no válido.');
  if (data.storage['marea-pet-visible'] !== undefined && !['true', 'false'].includes(data.storage['marea-pet-visible'])) throw new Error('Mascota no válida.');
  if (data.storage['marea-mood'] !== undefined && !['marea', 'night', 'sunrise', 'forest', 'minimal', 'neon'].includes(data.storage['marea-mood'])) throw new Error('Ambiente no válido.');
  const tasks = JSON.parse(data.storage['marea-tasks'] || '[]');
  if (tasks.some((task) => !task || !['string', 'number'].includes(typeof task.id) ||
    typeof task.text !== 'string' || typeof task.done !== 'boolean')) throw new Error('Tareas no válidas.');
  const playlists = JSON.parse(data.storage['marea-playlists'] || '[]');
  if (playlists.some((list) => !list || typeof list.id !== 'string' || typeof list.name !== 'string' ||
    !Array.isArray(list.trackIds) || list.trackIds.some((id) => typeof id !== 'string'))) throw new Error('Listas no válidas.');
  const youtube = JSON.parse(data.storage['marea-youtube-tracks'] || '[]');
  if (youtube.some((track) => !track || typeof track.id !== 'string' || typeof track.youtubeId !== 'string' ||
    typeof track.title !== 'string' || typeof track.artist !== 'string' || track.source !== 'youtube')) throw new Error('Vídeos no válidos.');
  const noteNames = new Set();
  let noteBytes = 0;
  for (const note of data.notes) {
    if (!note || typeof note.name !== 'string' || note.name.length > 104 ||
      !/^[^<>:"/\\|?*\x00-\x1f]+\.txt$/i.test(note.name) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(note.name) ||
      noteNames.has(note.name.toLowerCase()) || typeof note.content !== 'string') throw new Error('Notas no válidas.');
    noteNames.add(note.name.toLowerCase());
    const size = new TextEncoder().encode(note.content).byteLength;
    noteBytes += size;
    if (size > 2_000_000 || noteBytes > 20_000_000) throw new RangeError('Las notas superan el límite permitido.');
  }
  const ids = new Set();
  let audioBytes = 0;
  data.tracks = data.tracks.map((track) => {
    if (!track || typeof track.id !== 'string' || ids.has(track.id) || typeof track.title !== 'string' ||
      typeof track.artist !== 'string' || typeof track.file?.name !== 'string' ||
      typeof track.file.type !== 'string' || typeof track.file.data !== 'string' ||
      !validBase64(track.file.data)) throw new Error('Audio no válido.');
    ids.add(track.id);
    audioBytes += track.file.data.length / 4 * 3 - (track.file.data.endsWith('==') ? 2 : track.file.data.endsWith('=') ? 1 : 0);
    if (audioBytes > MAX_AUDIO_BYTES) throw new RangeError('El audio supera los 128 MiB.');
    const bytes = Uint8Array.from(atob(track.file.data), (char) => char.charCodeAt(0));
    return { id: track.id, title: track.title, artist: track.artist,
      order: Number.isFinite(track.order) ? track.order : 0,
      file: new File([bytes], track.file.name, { type: track.file.type, lastModified: track.file.lastModified }) };
  });
  return data;
}

async function replaceTracks(tracks) {
  const database = await openTrackDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(TRACK_STORE, 'readwrite');
      const store = transaction.objectStore(TRACK_STORE);
      store.clear();
      tracks.forEach((track) => store.put(track));
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('No se pudo guardar el audio.'));
    });
  } finally { database.close(); }
}

export async function restoreBackup(data) {
  const oldStorage = Object.fromEntries(BACKUP_KEYS.map((key) => [key, localStorage.getItem(key)]));
  const oldTracks = await readSavedTracks();
  try {
    await replaceTracks(data.tracks);
    for (const key of BACKUP_KEYS) {
      if (Object.hasOwn(data.storage, key)) localStorage.setItem(key, data.storage[key]);
      else localStorage.removeItem(key);
    }
    await window.marea.restoreNotes(data.notes);
  } catch (error) {
    await replaceTracks(oldTracks);
    for (const [key, value] of Object.entries(oldStorage)) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    throw error;
  }
}

export function readSession() {
  try { return JSON.parse(localStorage.getItem('marea-session')) || {}; }
  catch { return {}; }
}
