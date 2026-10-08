export const TRACK_DATABASE = 'marea-audio-library';
export const TRACK_STORE = 'tracks';
export const YOUTUBE_TRACKS_KEY = 'marea-youtube-tracks';
export const PLAYLISTS_KEY = 'marea-playlists';
const DEFAULT_YOUTUBE_API_ENDPOINT = 'https://marea-youtube-api.spamtom4444.workers.dev';
export const YOUTUBE_API_ENDPOINT = (import.meta.env.VITE_YOUTUBE_API_URL || DEFAULT_YOUTUBE_API_ENDPOINT).replace(/\/+$/, '');

let youtubePlayerApiPromise;

export function normalizeYoutubeTrack(item) {
  const youtubeId = item.id.videoId;
  return {
    id: `youtube-${youtubeId}`,
    title: item.snippet?.title || 'Vídeo de YouTube',
    artist: item.snippet?.channelTitle || 'YouTube Lofi',
    youtubeId,
    isLive: item.snippet?.liveBroadcastContent === 'live',
    source: 'youtube',
    kind: 'video'
  };
}

export function openTrackDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TRACK_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(TRACK_STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readSavedTracks() {
  const database = await openTrackDatabase();
  const tracks = await new Promise((resolve, reject) => {
    const request = database.transaction(TRACK_STORE).objectStore(TRACK_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return tracks.sort((first, second) => (first.order ?? 0) - (second.order ?? 0));
}

export async function saveTracks(tracks) {
  const database = await openTrackDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(TRACK_STORE, 'readwrite');
    tracks.forEach((track) => transaction.objectStore(TRACK_STORE).put(track));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

export function readSavedYoutubeTracks() {
  try {
    const saved = JSON.parse(localStorage.getItem(YOUTUBE_TRACKS_KEY));
    return Array.isArray(saved)
      ? saved.filter((track) => track?.source === 'youtube' && track.id && track.youtubeId)
        .map((track) => ({ ...track, isLive: Boolean(track.isLive) }))
      : [];
  } catch {
    return [];
  }
}

export function readSavedPlaylists() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYLISTS_KEY));
    return Array.isArray(saved)
      ? saved.filter((playlist) => playlist?.id && typeof playlist.name === 'string' && Array.isArray(playlist.trackIds))
        .map((playlist) => ({
          id: playlist.id,
          name: playlist.name,
          trackIds: playlist.trackIds.filter((trackId) => typeof trackId === 'string'),
          shuffle: Boolean(playlist.shuffle)
        }))
      : [];
  } catch {
    return [];
  }
}

export function loadYoutubePlayerApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubePlayerApiPromise) return youtubePlayerApiPromise;

  youtubePlayerApiPromise = new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return youtubePlayerApiPromise;
}

export function getTrackName(filename) {
  const name = filename.replace(/\.[^.]+$/, '');
  const separator = name.indexOf(' - ');
  return separator > 0
    ? { artist: name.slice(0, separator), title: name.slice(separator + 3) }
    : { artist: 'Tu biblioteca', title: name };
}
