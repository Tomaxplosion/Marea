import { openTrackDatabase, readSavedTracks, TRACK_STORE } from './music.js';

export const BACKUP_KEYS = ['marea-tasks', 'marea-duration', 'marea-theme', 'marea-pet-visible',
  'marea-mood', 'marea-playlists', 'marea-youtube-tracks', 'marea-calendar-events', 'marea-session'];

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
  for (const track of await readSavedTracks()) {
    const { file, ...metadata } = track;
    tracks.push({ ...metadata, file: { name: file.name || 'audio', type: file.type,
      lastModified: file.lastModified || 0, data: await encodeFile(file) } });
  }
  return { format: 'marea-backup', version: 1, createdAt: new Date().toISOString(), storage, tracks };
}

export function parseBackup(text) {
  const data = JSON.parse(text);
  if (data?.format !== 'marea-backup' || data.version !== 1 || !data.storage ||
    !Array.isArray(data.tracks) || !Array.isArray(data.notes)) throw new Error('Formato de copia no compatible.');
  for (const [key, value] of Object.entries(data.storage)) {
    if (!BACKUP_KEYS.includes(key) || typeof value !== 'string') throw new Error('Ajustes no válidos.');
    if (['marea-tasks', 'marea-playlists', 'marea-youtube-tracks', 'marea-calendar-events'].includes(key) &&
      !Array.isArray(JSON.parse(value))) throw new Error('Datos no válidos.');
    if (key === 'marea-session') {
      const session = JSON.parse(value);
      if (!session || typeof session !== 'object' || typeof session.noteTitle !== 'string' ||
        typeof session.noteContent !== 'string' || !Number.isFinite(session.seconds) || session.seconds < 0 ||
        !Number.isFinite(session.volume) || session.volume < 0 || session.volume > 100 ||
        !['space', 'radio', 'notes', 'calendar'].includes(session.view)) throw new Error('Sesión no válida.');
    }
  }
  const tasks = JSON.parse(data.storage['marea-tasks'] || '[]');
  if (tasks.some((task) => !task || !['string', 'number'].includes(typeof task.id) ||
    typeof task.text !== 'string' || typeof task.done !== 'boolean')) throw new Error('Tareas no válidas.');
  const playlists = JSON.parse(data.storage['marea-playlists'] || '[]');
  if (playlists.some((list) => !list || typeof list.id !== 'string' || typeof list.name !== 'string' ||
    !Array.isArray(list.trackIds) || list.trackIds.some((id) => typeof id !== 'string'))) throw new Error('Listas no válidas.');
  const youtube = JSON.parse(data.storage['marea-youtube-tracks'] || '[]');
  if (youtube.some((track) => !track || typeof track.id !== 'string' || typeof track.youtubeId !== 'string' ||
    typeof track.title !== 'string' || typeof track.artist !== 'string' || track.source !== 'youtube')) throw new Error('Vídeos no válidos.');
  if (data.notes.some((note) => !note || typeof note.name !== 'string' ||
    !/^[^<>:"/\\|?*\x00-\x1f]+\.txt$/i.test(note.name) || typeof note.content !== 'string')) throw new Error('Notas no válidas.');
  const ids = new Set();
  data.tracks = data.tracks.map((track) => {
    if (!track || typeof track.id !== 'string' || ids.has(track.id) || typeof track.title !== 'string' ||
      typeof track.artist !== 'string' || typeof track.file?.name !== 'string' ||
      typeof track.file.type !== 'string' || typeof track.file.data !== 'string' ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(track.file.data)) throw new Error('Audio no válido.');
    ids.add(track.id);
    const bytes = Uint8Array.from(atob(track.file.data), (char) => char.charCodeAt(0));
    return { ...track, file: new File([bytes], track.file.name, { type: track.file.type, lastModified: track.file.lastModified }) };
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
