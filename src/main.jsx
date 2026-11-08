import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CalendarDays,
  Check,
  Circle,
  ChevronLeft,
  ChevronDown,
  FilePlus2,
  FileText,
  FolderOpen,
  Headphones,
  Import,
  Share as Export,
  Eye,
  EyeOff,
  ListTodo,
  ListMusic,
  Maximize2,
  Minimize2,
  Moon,
  Music2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  SkipBack,
  SkipForward,
  Shuffle,
  Sun,
  Waves,
  X
} from 'lucide-react';
import './style.css';
import Calendar from './components/Calendar.jsx';
import { createBackup, parseBackup, restoreBackup, readSession } from './lib/backup.mjs';
import SleepingAnimal from './components/SleepingAnimal.jsx';
import { defaultTasks, MAX_DURATION_MINUTES, readTasks, formatPlaybackTime, formatTimerTime, formatCompactTimerTime } from './lib/time.js';
import { playTimerCompletionSound, playNoteKeySound } from './lib/audio.js';
import {
  loadYoutubePlayerApi,
  normalizeYoutubeTrack,
  openTrackDatabase,
  PLAYLISTS_KEY,
  readSavedPlaylists,
  readSavedTracks,
  readSavedYoutubeTracks,
  saveTracks,
  TRACK_DATABASE,
  TRACK_STORE,
  YOUTUBE_API_ENDPOINT,
  YOUTUBE_TRACKS_KEY,
  getTrackName
} from './lib/music.js';

function App() {
  const [tasks, setTasks] = useState(readTasks);
  const [draft, setDraft] = useState('');
  const [view, setView] = useState(() => readSession().view || 'space');
  const [noteTitle, setNoteTitle] = useState(() => readSession().noteTitle || '');
  const [noteContent, setNoteContent] = useState(() => readSession().noteContent || '');
  const [noteId, setNoteId] = useState(null);
  const [noteStatus, setNoteStatus] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('marea-theme') === 'dark' ? 'dark' : 'light');
  const [isPetVisible, setIsPetVisible] = useState(() => localStorage.getItem('marea-pet-visible') !== 'false');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const [mood, setMood] = useState(() => {
    const savedMood = localStorage.getItem('marea-mood');
    return ['marea', 'night', 'sunrise', 'forest', 'minimal', 'neon'].includes(savedMood) ? savedMood : 'marea';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(() => {
    const saved = Number(localStorage.getItem('marea-duration'));
    return Number.isInteger(saved) && saved >= 1 && saved <= MAX_DURATION_MINUTES ? saved : 25;
  });
  const [seconds, setSeconds] = useState(() => readSession().seconds ?? durationMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [library, setLibrary] = useState([]);
  const [playlists, setPlaylists] = useState(readSavedPlaylists);
  const [libraryFilter, setLibraryFilter] = useState('all');
  const [drawerSection, setDrawerSection] = useState('tracks');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [playlistNameDraft, setPlaylistNameDraft] = useState('');
  const [addingPlaylistTracks, setAddingPlaylistTracks] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [playbackQueue, setPlaybackQueue] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [audioSource, setAudioSource] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [libraryStatus, setLibraryStatus] = useState('loading');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => readSession().volume ?? 70);
  const [libraryError, setLibraryError] = useState('');
  const [libraryNotice, setLibraryNotice] = useState(null);
  const [youtubeExpanded, setYoutubeExpanded] = useState(false);
  const [youtubeSearch, setYoutubeSearch] = useState('lofi study');
  const [youtubeResults, setYoutubeResults] = useState([]);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');
  const [youtubeNextPageToken, setYoutubeNextPageToken] = useState('');
  const [youtubeLastQuery, setYoutubeLastQuery] = useState('');
  const [dropActive, setDropActive] = useState(false);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const youtubeContainerRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  const skipTrackRef = useRef(null);
  const fileInputRef = useRef(null);
  const noteFileInputRef = useRef(null);
  const autoPlaySelectedTrack = useRef(false);
  const drawerPanelRef = useRef(null);
  const drawerToggleRef = useRef(null);

  useEffect(() => {
    if (!libraryNotice) return;
    const timeout = window.setTimeout(() => setLibraryNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [libraryNotice]);

  useEffect(() => {
    if (!drawerOpen) return;
    const closeOutside = (event) => {
      if (!drawerPanelRef.current?.contains(event.target) && !drawerToggleRef.current?.contains(event.target)) {
        setDrawerOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [drawerOpen]);

  useEffect(() => {
    localStorage.setItem('marea-session', JSON.stringify({ view, noteTitle, noteContent, seconds, volume }));
  }, [view, noteTitle, noteContent, seconds, volume]);

  async function handleBackup(importing) {
    setBackupBusy(true);
    setBackupStatus('');
    try {
      if (importing) {
        const text = await window.marea.openBackup();
        if (text === null) return;
        const data = parseBackup(text);
        if (!window.confirm('Se reemplazarán tus tareas, calendario, ajustes y biblioteca. Las notas con el mismo nombre se sobrescribirán. ¿Importar esta copia?')) return;
        setIsRunning(false);
        setIsPlaying(false);
        await restoreBackup(data);
        window.location.reload();
      } else {
        const data = await createBackup({ view, noteTitle, noteContent, seconds, volume });
        if (await window.marea.exportBackup(data)) setBackupStatus('Copia exportada.');
      }
    } catch (error) {
      setBackupStatus(`No se pudo ${importing ? 'importar' : 'exportar'} la copia. ${error.message}`);
    } finally { setBackupBusy(false); }
  }

  useEffect(() => {
    localStorage.setItem('marea-tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('marea-duration', String(durationMinutes));
  }, [durationMinutes]);

  useEffect(() => {
    localStorage.setItem('marea-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('marea-pet-visible', String(isPetVisible));
  }, [isPetVisible]);

  useEffect(() => {
    localStorage.setItem('marea-mood', mood);
  }, [mood]);

  useEffect(() => {
    const unsubscribe = window.marea?.onFullscreenChanged?.(setIsFullscreen);
    window.marea?.isFullscreen?.().then(setIsFullscreen).catch(() => {});
    const updateBrowserFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', updateBrowserFullscreen);
    return () => {
      unsubscribe?.();
      document.removeEventListener('fullscreenchange', updateBrowserFullscreen);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenShortcut = (event) => {
      if (event.key !== 'F11' || event.repeat) return;
      event.preventDefault();
      toggleFullscreen();
    };
    window.addEventListener('keydown', handleFullscreenShortcut);
    return () => window.removeEventListener('keydown', handleFullscreenShortcut);
  }, []);

  useEffect(() => {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    let active = true;
    Promise.all([readSavedTracks(), Promise.resolve(readSavedYoutubeTracks())]).then(([savedTracks, savedYoutubeTracks]) => {
      if (!active) return;
      setLibrary([
        ...savedTracks.map((track) => ({ ...track, audioUrl: URL.createObjectURL(track.file), source: 'local', kind: 'track' })),
        ...savedYoutubeTracks
      ]);
      setLibraryStatus('ready');
    }).catch(() => {
      if (!active) return;
      setLibraryStatus('error');
      setLibraryError('No se pudo abrir la biblioteca de música.');
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (libraryStatus !== 'ready') return;
    const savedYoutubeTracks = library
      .filter((track) => track.source === 'youtube')
      .map(({ id, title, artist, youtubeId, source, kind, isLive }) => ({ id, title, artist, youtubeId, source, kind, isLive }));
    try {
      localStorage.setItem(YOUTUBE_TRACKS_KEY, JSON.stringify(savedYoutubeTracks));
    } catch {
      setLibraryError('No se pudo guardar la biblioteca de YouTube.');
    }
  }, [library, libraryStatus]);

  useEffect(() => {
    if (!isRunning) return undefined;
    const interval = window.setInterval(() => {
      setSeconds((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (isRunning && seconds === 0) {
      setIsRunning(false);
      playTimerCompletionSound(audioContextRef.current);
    }
  }, [isRunning, seconds]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  const completedCount = tasks.filter((task) => task.done).length;
  const remainingTasks = tasks.length - completedCount;
  const currentTrack = library[selectedTrack];
  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId);
  const selectedPlaylistTracks = selectedPlaylist
    ? selectedPlaylist.trackIds.map((trackId) => library.find((track) => track.id === trackId)).filter(Boolean)
    : [];
  const filteredLibrary = library.filter((track) => (
    libraryFilter === 'all' || (libraryFilter === 'own' ? track.source === 'local' : track.source === 'youtube')
  ));
  const time = formatTimerTime(seconds);
  const compactTime = formatCompactTimerTime(seconds);
  useEffect(() => {
    if (currentTrack?.source !== 'youtube') return undefined;

    const updateYoutubeProgress = () => {
      const player = youtubePlayerRef.current;
      if (!player) return;
      const duration = player.getDuration();
      const current = player.getCurrentTime();
      if (Number.isFinite(duration) && duration > 0) {
        setTrackDuration((previous) => previous === duration ? previous : duration);
      }
      if (Number.isFinite(current) && current >= 0) {
        setCurrentTime((previous) => Math.abs(previous - current) < 0.5 ? previous : current);
      }
    };

    updateYoutubeProgress();
    const interval = window.setInterval(updateYoutubeProgress, 500);
    return () => window.clearInterval(interval);
  }, [currentTrack?.source, currentTrack?.youtubeId]);

  const timerProgress = Math.min(100, Math.max(0, (1 - seconds / (durationMinutes * 60)) * 100));
  const progress = trackDuration > 0 ? currentTime / trackDuration * 100 : 0;
  const isLiveYoutubeTrack = currentTrack?.source === 'youtube' && (
    currentTrack.isLive || (trackDuration > 24 * 60 * 60 && trackDuration - currentTime <= 60 * 60 + 30)
  );
  const isCurrentYoutubeQuery = youtubeSearch.trim() === youtubeLastQuery;
  const hasMoreYoutubeResults = isCurrentYoutubeQuery && Boolean(youtubeNextPageToken);
  const youtubeResultsExhausted = isCurrentYoutubeQuery && Boolean(youtubeLastQuery) && !youtubeNextPageToken;
  const today = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());
  const moodOptions = [
    { id: 'marea', label: 'Marea' },
    { id: 'night', label: 'Noche' },
    { id: 'sunrise', label: 'Amanecer' },
    { id: 'forest', label: 'Bosque' },
    { id: 'minimal', label: 'Minimal' },
    { id: 'neon', label: 'Neon' }
  ];
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    if (currentTrack?.source !== 'youtube' || !youtubeContainerRef.current) {
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
      return undefined;
    }

    let active = true;
    loadYoutubePlayerApi().then((youtubeApi) => {
      if (!active || !youtubeContainerRef.current) return;
      youtubePlayerRef.current = new youtubeApi.Player(youtubeContainerRef.current, {
        width: '180',
        height: '100',
        videoId: currentTrack.youtubeId,
        playerVars: { autoplay: isPlayingRef.current ? 1 : 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, playsinline: 1, rel: 0 },
        events: {
          onReady: (event) => {
            if (isPlayingRef.current) event.target.playVideo();
            else event.target.pauseVideo();
          },
          onStateChange: (event) => {
            if (!active) return;
            if (event.data === youtubeApi.PlayerState.ENDED) skipTrackRef.current?.(1);
            if (event.data === youtubeApi.PlayerState.PLAYING) setIsPlaying(true);
            if (event.data === youtubeApi.PlayerState.PAUSED) setIsPlaying(false);
          },
          onError: (event) => {
            if (!active) return;
            setIsPlaying(false);
            const messages = {
              153: 'YouTube no pudo identificar la aplicación. Actualiza Marea a la última versión.',
              100: 'Este vídeo ya no está disponible en YouTube.',
              101: 'El autor no permite reproducir este vídeo fuera de YouTube.',
              150: 'El autor no permite reproducir este vídeo fuera de YouTube.'
            };
            setLibraryError(messages[event.data] || `No se pudo reproducir este vídeo de YouTube (error ${event.data}).`);
          }
        }
      });
    }).catch(() => {
      if (active) setLibraryError('No se pudo iniciar el reproductor de YouTube.');
    });

    return () => {
      active = false;
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [currentTrack?.youtubeId]);

  function changeDurationPart(part, rawValue) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    const hours = part === 'hours'
      ? Math.min(8, Math.max(0, Math.floor(value)))
      : Math.floor(durationMinutes / 60);
    const minutes = part === 'minutes'
      ? Math.min(59, Math.max(0, Math.floor(value)))
      : durationMinutes % 60;
    const nextDuration = Math.min(MAX_DURATION_MINUTES, Math.max(1, hours * 60 + minutes));
    setDurationMinutes(nextDuration);
    setSeconds(nextDuration * 60);
    setIsRunning(false);
  }

  function getAudioContext() {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }

  async function toggleFullscreen() {
    try {
      if (window.marea?.toggleFullscreen) {
        setIsFullscreen(await window.marea.toggleFullscreen());
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {}
  }

  function toggleTimer() {
    if (!isRunning && seconds > 0) getAudioContext();
    setIsRunning((running) => seconds === 0 ? false : !running);
  }

  function handleNoteKeyDown(event) {
    if (event.isComposing || event.repeat || event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) return;
    playNoteKeySound(getAudioContext());
  }

  function addTask(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setTasks((current) => [...current, { id: Date.now(), text, done: false }]);
    setDraft('');
  }

  async function saveNote() {
    if (!noteContent.trim()) {
      setNoteStatus('Escribe una nota antes de guardarla.');
      return;
    }

    const safeName = noteTitle.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 100) || 'Nota';
    try {
      if (window.marea?.saveNote) {
        const saved = await window.marea.saveNote({ noteId, title: safeName, content: noteContent });
        setNoteId(saved.noteId);
        setNoteStatus(noteId ? `Cambios guardados en ${saved.fileName}` : `Guardada en kofi_lofi/notas/${saved.fileName}`);
      } else {
        const url = URL.createObjectURL(new Blob([noteContent], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${safeName}.txt`;
        link.click();
        URL.revokeObjectURL(url);
        setNoteStatus(`Descargada como ${safeName}.txt`);
      }
    } catch {
      setNoteStatus('No se pudo guardar la nota.');
    }
  }

  async function openNote() {
    try {
      if (window.marea?.openNote) {
        const opened = await window.marea.openNote();
        if (!opened) return;
        setNoteId(opened.noteId);
        setNoteTitle(opened.title);
        setNoteContent(opened.content);
        setNoteStatus(`Abierta: ${opened.fileName}`);
        return;
      }

      noteFileInputRef.current?.click();
    } catch {
      setNoteStatus('No se pudo abrir el archivo.');
    }
  }

  async function readNoteFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setNoteId(null);
      setNoteTitle(file.name.replace(/\.txt$/i, ''));
      setNoteContent(await file.text());
      setNoteStatus('La vista web guardará una copia descargable.');
    } catch {
      setNoteStatus('No se pudo leer el archivo.');
    } finally {
      event.target.value = '';
    }
  }

  function startNewNote() {
    setNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteStatus('');
  }

  async function togglePlayback() {
    if (!currentTrack) return;

    if (currentTrack.source === 'youtube') {
      if (isPlaying) {
        youtubePlayerRef.current?.pauseVideo();
        setIsPlaying(false);
      } else {
        youtubePlayerRef.current?.playVideo();
        setIsPlaying(true);
      }
      return;
    }

    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      setLibraryError('No se pudo reproducir este archivo de audio.');
      setIsPlaying(false);
    }
  }

  function playTrack(index, playlistQueue = null, playlistId = null) {
    const track = library[index];
    if (!track) return;
    if (playlistQueue) {
      setPlaybackQueue(playlistQueue);
      setActivePlaylistId(playlistId);
    } else {
      setPlaybackQueue([]);
      setActivePlaylistId(null);
    }
    setLibraryError('');

    if (track.source === 'youtube') {
      audioRef.current?.pause();
      autoPlaySelectedTrack.current = false;
      setSelectedTrack(index);
      setCurrentTime(0);
      setTrackDuration(0);
      setIsPlaying(true);
      if (index === selectedTrack) {
        youtubePlayerRef.current?.seekTo(0);
        youtubePlayerRef.current?.playVideo();
      }
      return;
    }

    if (!audioRef.current) return;
    if (index === selectedTrack) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {
        setLibraryError('No se pudo reproducir este archivo de audio.');
      });
    } else {
      autoPlaySelectedTrack.current = true;
      setSelectedTrack(index);
      setCurrentTime(0);
      setTrackDuration(0);
    }
  }

  function resumeSelectedTrack(event) {
    if (!autoPlaySelectedTrack.current) return;
    autoPlaySelectedTrack.current = false;
    event.currentTarget.play().then(() => setIsPlaying(true)).catch((error) => {
      if (error.name !== 'AbortError') setLibraryError('No se pudo reproducir este archivo de audio.');
      setIsPlaying(false);
    });
  }

  function skipTrack(direction) {
    if (library.length === 0) return;
    if (activePlaylistId && playbackQueue.length > 0) {
      const currentPosition = playbackQueue.indexOf(currentTrack?.id);
      const nextPosition = currentPosition + direction;
      if (nextPosition < 0) {
        const firstTrackIndex = library.findIndex((track) => track.id === playbackQueue[0]);
        if (firstTrackIndex >= 0) playTrack(firstTrackIndex, playbackQueue, activePlaylistId);
        return;
      }
      if (nextPosition >= playbackQueue.length) {
        if (currentTrack?.source === 'youtube') youtubePlayerRef.current?.pauseVideo();
        else audioRef.current?.pause();
        setIsPlaying(false);
        return;
      }
      const nextTrackIndex = library.findIndex((track) => track.id === playbackQueue[nextPosition]);
      if (nextTrackIndex >= 0) playTrack(nextTrackIndex, playbackQueue, activePlaylistId);
      return;
    }
    const nextIndex = (selectedTrack + direction + library.length) % library.length;
    playTrack(nextIndex);
  }
  skipTrackRef.current = skipTrack;

  function startPlaylistPlayback(playlist, startTrackId = null) {
    let trackIds = playlist.trackIds.filter((trackId) => library.some((track) => track.id === trackId));
    if (playlist.shuffle) {
      trackIds = [...trackIds];
      for (let index = trackIds.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [trackIds[index], trackIds[randomIndex]] = [trackIds[randomIndex], trackIds[index]];
      }
    }
    if (startTrackId) {
      const startIndex = trackIds.indexOf(startTrackId);
      if (startIndex > 0) trackIds.unshift(...trackIds.splice(startIndex, 1));
    }
    if (trackIds.length === 0) return;
    const firstTrackIndex = library.findIndex((track) => track.id === trackIds[0]);
    if (firstTrackIndex >= 0) playTrack(firstTrackIndex, trackIds, playlist.id);
  }

  function createPlaylist(event) {
    event.preventDefault();
    const name = playlistNameDraft.trim().slice(0, 60);
    if (!name) return;
    const playlist = {
      id: `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      trackIds: [],
      shuffle: false
    };
    setPlaylists((current) => [...current, playlist]);
    setPlaylistNameDraft('');
    setSelectedPlaylistId(playlist.id);
    setAddingPlaylistTracks(false);
  }

  function addTrackToPlaylist(playlistId, trackId) {
    setPlaylists((current) => current.map((playlist) => (
      playlist.id === playlistId && !playlist.trackIds.includes(trackId)
        ? { ...playlist, trackIds: [...playlist.trackIds, trackId] }
        : playlist
    )));
  }

  function removeTrackFromPlaylist(playlistId, trackId) {
    setPlaylists((current) => current.map((playlist) => (
      playlist.id === playlistId
        ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) }
        : playlist
    )));
    if (activePlaylistId !== playlistId) return;

    const currentQueuePosition = playbackQueue.indexOf(trackId);
    const nextQueue = playbackQueue.filter((id) => id !== trackId);
    setPlaybackQueue(nextQueue);
    if (currentTrack?.id !== trackId) return;

    if (nextQueue.length > 0) {
      const nextPosition = Math.min(Math.max(currentQueuePosition, 0), nextQueue.length - 1);
      const nextTrackIndex = library.findIndex((track) => track.id === nextQueue[nextPosition]);
      if (nextTrackIndex >= 0) playTrack(nextTrackIndex, nextQueue, playlistId);
      return;
    }

    if (currentTrack.source === 'youtube') youtubePlayerRef.current?.pauseVideo();
    else audioRef.current?.pause();
    setActivePlaylistId(null);
    setIsPlaying(false);
  }

  function togglePlaylistShuffle(playlistId) {
    setPlaylists((current) => current.map((playlist) => (
      playlist.id === playlistId ? { ...playlist, shuffle: !playlist.shuffle } : playlist
    )));
  }

  function deletePlaylist(playlistId) {
    setPlaylists((current) => current.filter((playlist) => playlist.id !== playlistId));
    if (selectedPlaylistId === playlistId) setSelectedPlaylistId(null);
    if (activePlaylistId === playlistId) {
      setActivePlaylistId(null);
      setPlaybackQueue([]);
    }
  }

  async function importTrackFiles(files) {
    const audioFiles = Array.from(files ?? []).filter((file) => file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(file.name));
    if (audioFiles.length === 0) {
      setLibraryError('Selecciona archivos de audio compatibles.');
      return;
    }

    const importOrder = Date.now();
    const tracks = audioFiles.map((file, index) => {
      const details = getTrackName(file.name);
      return {
        id: `${file.name}-${file.size}-${file.lastModified}`,
        order: importOrder + index,
        title: details.title,
        artist: details.artist,
        file
      };
    });

    try {
      await saveTracks(tracks);
      const existingIds = new Set(library.map((track) => track.id));
      const additions = tracks
        .filter((track) => !existingIds.has(track.id))
        .map((track) => ({ ...track, audioUrl: URL.createObjectURL(track.file), source: 'local', kind: 'track' }));
      if (library.length === 0 && additions.length > 0) setSelectedTrack(0);
      setLibrary((current) => [...current, ...additions]);
      setLibraryStatus('ready');
      setLibraryError('');
      setLibraryNotice({ message: additions.length === 1 ? 'Canción añadida a tu biblioteca.'
        : additions.length > 1 ? `${additions.length} canciones añadidas a tu biblioteca.`
        : 'Estas canciones ya están en tu biblioteca.' });
    } catch {
      setLibraryError('No se pudieron guardar las canciones en este equipo.');
    }
  }

  async function importTracks(event) {
    await importTrackFiles(event.target.files ?? []);
    event.target.value = '';
  }

  function handleDropFiles(event) {
    event.preventDefault();
    setDropActive(false);
    importTrackFiles(event.dataTransfer?.files ?? []);
  }

  async function searchLofiContent() {
    const query = youtubeSearch.trim() || 'lofi study';
    const isSameQuery = query === youtubeLastQuery;
    const pageToken = isSameQuery ? youtubeNextPageToken : '';
    setYoutubeLoading(true);
    setYoutubeError('');

    try {
      if (!YOUTUBE_API_ENDPOINT) {
        throw new Error('El backend de YouTube no está configurado. Define VITE_YOUTUBE_API_URL en .env.local.');
      }
      const params = new URLSearchParams({ q: query });
      if (pageToken) params.set('pageToken', pageToken);
      const request = await fetch(`${YOUTUBE_API_ENDPOINT}/api/search?${params}`);
      const payload = await request.json();

      if (!request.ok) {
        throw new Error(payload.error?.message || 'No se pudo cargar contenido desde YouTube.');
      }

      const items = Array.isArray(payload.items) ? payload.items : [];
      const results = items
        .filter((item) => item?.id?.videoId)
        .map(normalizeYoutubeTrack);
      setYoutubeNextPageToken(payload.nextPageToken || '');

      setYoutubeLastQuery(query);
      setYoutubeResults((current) => {
        if (!isSameQuery) return results;
        const existingIds = new Set(current.map((result) => result.id));
        return [...current, ...results.filter((result) => !existingIds.has(result.id))];
      });
    } catch (error) {
      setYoutubeError(error.message || 'No se pudo cargar música lofi desde YouTube.');
    } finally {
      setYoutubeLoading(false);
    }
  }

  function queueYoutubeResult(result) {
    const track = {
      id: result.id || `${result.title}-${result.artist}-${Date.now()}`,
      title: result.title,
      artist: result.artist || 'YouTube Lofi',
      youtubeId: result.youtubeId,
      audioUrl: result.url,
      source: result.source || 'youtube',
      kind: result.kind || 'video',
      isLive: Boolean(result.isLive),
      isRemote: true
    };

    let nextIndex = library.length;
    setLibrary((current) => {
      const existingIndex = current.findIndex((item) => item.id === track.id);
      if (existingIndex >= 0) {
        nextIndex = existingIndex;
        return current.map((item) => item.id === track.id ? { ...item, isLive: track.isLive } : item);
      }
      nextIndex = current.length;
      return [...current, track];
    });

    setSelectedTrack(nextIndex);
    setCurrentTime(0);
    setTrackDuration(0);
    setLibraryError('');
    setLibraryNotice({ message: library.some((item) => item.id === track.id)
      ? 'Esta canción ya está en tu biblioteca.' : 'Canción añadida a tu biblioteca.' });
    setYoutubeError('');
  }

  async function removeTrackFromLibrary(index) {
    const trackToRemove = library[index];
    if (!trackToRemove) return;

    if (trackToRemove.source === 'local') {
      try {
        const database = await openTrackDatabase();
        await new Promise((resolve, reject) => {
          const transaction = database.transaction(TRACK_STORE, 'readwrite');
          const request = transaction.objectStore(TRACK_STORE).delete(trackToRemove.id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          transaction.onabort = () => reject(transaction.error);
          transaction.onerror = () => reject(transaction.error);
        });
        database.close();
      } catch {
        setLibraryError('No se pudo quitar la canción guardada en tu equipo.');
      }
    }

    setPlaylists((current) => current.map((playlist) => ({
      ...playlist,
      trackIds: playlist.trackIds.filter((trackId) => trackId !== trackToRemove.id)
    })));
    setPlaybackQueue((current) => current.filter((trackId) => trackId !== trackToRemove.id));
    if (library[selectedTrack]?.id === trackToRemove.id) {
      if (trackToRemove.source === 'youtube') youtubePlayerRef.current?.pauseVideo();
      setActivePlaylistId(null);
    }

    setLibrary((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      const nextSelectedIndex = next.length === 0 ? 0 : Math.min(index, next.length - 1);
      setSelectedTrack(nextSelectedIndex);
      if (audioRef.current && current[index]?.id === trackToRemove.id) {
        audioRef.current.pause();
        setIsPlaying(false);
        setCurrentTime(0);
        setTrackDuration(0);
      }
      if (current[index]?.id === trackToRemove.id && trackToRemove.source === 'youtube') {
        setIsPlaying(false);
        setCurrentTime(0);
        setTrackDuration(0);
      }
      return next;
    });
  }

  function seekTrack(event) {
    const nextTime = Number(event.target.value);
    if (!Number.isFinite(nextTime)) return;
    if (currentTrack?.source === 'youtube') {
      youtubePlayerRef.current?.seekTo(nextTime, true);
    } else if (audioRef.current) {
      audioRef.current.currentTime = nextTime;
    } else {
      return;
    }
    setCurrentTime(nextTime);
  }

  return (
    <div className="app-shell" data-theme={theme} data-mood={mood === 'marea' ? undefined : mood} data-ambience={mood}>
      <aside className="sidebar">
        <a className="brand" href="#inicio" aria-label="Marea, inicio">
          <span className="brand-mark"><Waves size={20} strokeWidth={2.1} /></span>
          <span>marea<span className="brand-period">.</span></span>
        </a>

        <div className="side-label">TU OCEANO</div>
        <nav className="main-nav" aria-label="Navegación principal">
          <button className={`nav-item${view === 'space' ? ' active' : ''}`} onClick={() => setView('space')}><span className="nav-icon"><Waves size={17} /></span>Mi oceano</button>
          <button className={`nav-item${view === 'radio' ? ' active' : ''}`} onClick={() => setView('radio')}><span className="nav-icon"><Music2 size={17} /></span>Música</button>
          <button className={`nav-item${view === 'notes' ? ' active' : ''}`} onClick={() => setView('notes')}><span className="nav-icon"><FileText size={17} /></span>Notas</button>
          <button className={`nav-item${view === 'calendar' ? ' active' : ''}`} onClick={() => setView('calendar')}><span className="nav-icon"><CalendarDays size={17} /></span>Calendario</button>
        </nav>

        <section className={`settings-section${settingsOpen ? ' is-open' : ''}`} aria-label="Ajustes">
          <button
            type="button"
            className="settings-toggle"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
            aria-controls="settings-content"
          >
            <span className="settings-toggle-label">AJUSTES</span>
            <ChevronDown className="settings-toggle-icon" size={16} aria-hidden="true" />
          </button>

          {settingsOpen && <div className="settings-content" id="settings-content">
            <label className="theme-setting">
              <span className="theme-setting-icon">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</span>
              <span className="theme-setting-copy"><strong>Modo oscuro</strong><small>{theme === 'dark' ? 'Activado' : 'Desactivado'}</small></span>
              <input className="theme-checkbox" type="checkbox" checked={theme === 'dark'} onChange={(event) => setTheme(event.target.checked ? 'dark' : 'light')} aria-label="Modo oscuro" />
              <span className="theme-switch" aria-hidden="true"><span /></span>
            </label>

            <div className="mood-setting mood-setting-dropdown" aria-label="Estilo visual">
              <div className="mood-setting-head">
                <span className="theme-setting-icon"><Sun size={16} /></span>
                <label className="theme-setting-copy" htmlFor="mood-select"><strong>Ambiente</strong></label>
              </div>
              <select id="mood-select" className="mood-select" value={mood} onChange={(event) => setMood(event.target.value)}>
                {moodOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>

            <label className="theme-setting">
              <span className="theme-setting-icon">{isPetVisible ? <Eye size={16} /> : <EyeOff size={16} />}</span>
              <span className="theme-setting-copy"><strong>Mascota</strong><small>{isPetVisible ? 'Visible' : 'Oculta'}</small></span>
              <input className="theme-checkbox" type="checkbox" checked={isPetVisible} onChange={(event) => setIsPetVisible(event.target.checked)} aria-label="Mostrar mascota" />
              <span className="theme-switch" aria-hidden="true"><span /></span>
            </label>

            <label className="theme-setting">
              <span className="theme-setting-icon">{isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</span>
              <span className="theme-setting-copy"><strong>Pantalla completa</strong><small>{isFullscreen ? 'Activada' : 'Desactivada'}</small></span>
              <input className="theme-checkbox" type="checkbox" checked={isFullscreen} onChange={toggleFullscreen} aria-label="Pantalla completa" />
              <span className="theme-switch" aria-hidden="true"><span /></span>
            </label>
          </div>}
        </section>
        {isPetVisible && <SleepingAnimal />}
      </aside>

      <main className="main-content" id="inicio">
        <header className="topbar">
          <div className="date-label"><span className="date-dot" />{today}</div>
          <div className="topbar-actions">
          {view !== 'space' && (
            <button
              className="mini-timer"
              style={{ '--timer-progress': `${timerProgress}%` }}
              onClick={() => setView('space')}
              aria-label={`Volver al temporizador. ${compactTime} restantes${isRunning ? ', en marcha' : ''}`}
              title="Volver al temporizador"
            >
              <span>{compactTime}</span>
            </button>
          )}
          {window.marea?.exportBackup && <div className="backup-actions" role="group" aria-label="Copia de seguridad" aria-busy={backupBusy}>
            <span className="backup-status" role="status">{backupBusy ? 'Procesando copia…' : backupStatus}</span>
            <button className="backup-button" type="button" title="Importar copia" aria-label="Importar copia" disabled={backupBusy || libraryStatus !== 'ready'} onClick={() => handleBackup(true)}><Import size={18} strokeWidth={1.7} aria-hidden="true" /></button>
            <button className="backup-button" type="button" title="Exportar copia" aria-label="Exportar copia" disabled={backupBusy || libraryStatus !== 'ready'} onClick={() => handleBackup(false)}><Export size={18} strokeWidth={1.7} aria-hidden="true" /></button>
          </div>}
          </div>
        </header>

        {view === 'space' ? (
          <>
            <section className="welcome" aria-labelledby="welcome-title">
              <div className="eyebrow"><span className="eyebrow-line" />TU ESPACIO DE ESTUDIO</div>
              <h1 id="welcome-title">Mi <em>Oceano.</em></h1>
            </section>

            <div className="dashboard-grid">
          <section className="focus-panel" id="enfoque" aria-labelledby="focus-title">
            <div className="focus-topline">
              <div className="focus-heading">
                <span className="focus-icon"><Headphones size={16} /></span>
                <div><h2 id="focus-title">Pomodoro</h2></div>
              </div>
              <button className="icon-button focus-reset" onClick={() => { setIsRunning(false); setSeconds(durationMinutes * 60); }} title="Reiniciar temporizador" aria-label="Reiniciar temporizador"><RotateCcw size={16} /></button>
            </div>

            <div className="timer-area">
              <div className="timer-ring" aria-label={`Quedan ${time}`}>
                <div className="timer-ring-inner">
                  <span className="timer-caption">TIEMPO RESTANTE</span>
                  <span className={`timer-time${time.length > 10 ? ' timer-time-compact' : ''}`}>{time}</span>
                  <span className="timer-hint">{isRunning ? 'en marcha' : 'listo'}</span>
                </div>
              </div>
              <div className="timer-controls">
                <button className="timer-play" onClick={toggleTimer} aria-label={isRunning ? 'Pausar temporizador' : 'Iniciar temporizador'}>
                  {isRunning ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
                  {isRunning ? 'Pausar' : 'Empezar'}
                </button>
              </div>
            </div>

            <div className="timer-settings">
              <span className="duration-label">Duración</span>
              <div className="timer-duration-fields">
                <div className="duration-input-wrap">
                  <input id="duration-hours" type="number" min="0" max="8" step="1" value={Math.floor(durationMinutes / 60)} onChange={(event) => changeDurationPart('hours', event.target.value)} aria-label="Horas del temporizador" />
                  <span>h</span>
                </div>
                <div className="duration-input-wrap">
                  <input id="duration-minutes" type="number" min="0" max="59" step="1" value={durationMinutes % 60} onChange={(event) => changeDurationPart('minutes', event.target.value)} aria-label="Minutos del temporizador" />
                  <span>min</span>
                </div>
              </div>
              <span className="duration-hint">Máximo 8 h</span>
            </div>
            <span className="focus-decoration" aria-hidden="true">✳</span>
          </section>

          <section className="tasks-panel" id="tareas" aria-labelledby="tasks-title">
            <div className="tasks-header">
              <div>
                <h2 id="tasks-title">Mi lista <span className="task-count">{remainingTasks}</span></h2>
              </div>
              <span className="tasks-flower" aria-hidden="true">✳</span>
            </div>

            <form className="task-form" onSubmit={addTask}>
              <input aria-label="Nueva tarea" placeholder="Añade algo que quieras hacer..." value={draft} onChange={(event) => setDraft(event.target.value)} />
              <button type="submit" aria-label="Añadir tarea" disabled={!draft.trim()}><Plus size={18} /></button>
            </form>

            <div className="task-list">
              {tasks.length === 0 ? (
                <p className="empty-tasks">No hay tareas.</p>
              ) : tasks.map((task) => (
                <div className={`task-row${task.done ? ' is-done' : ''}`} key={task.id}>
                  <button className="task-check" aria-label={task.done ? `Marcar ${task.text} como pendiente` : `Completar ${task.text}`} onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))}>
                    {task.done ? <Check size={13} strokeWidth={2.5} /> : <Circle size={17} strokeWidth={1.5} />}
                  </button>
                  <span className="task-text">{task.text}</span>
                  <button className="task-delete" aria-label={`Eliminar ${task.text}`} onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))}><X size={15} /></button>
                </div>
              ))}
            </div>

            <div className="tasks-progress">
              <div className="progress-label"><span>Tu avance de hoy</span><span>{completedCount} de {tasks.length}</span></div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${tasks.length ? completedCount / tasks.length * 100 : 0}%` }} /></div>
            </div>
          </section>
            </div>

          </>
        ) : view === 'calendar' ? (
          <Calendar />
        ) : view === 'notes' ? (
          <section className="notes-view" aria-labelledby="notes-title">
            <div className="notes-heading-row">
              <div className="notes-heading">
                <div className="eyebrow"><span className="eyebrow-line" />TEXTO LOCAL</div>
                <h1 id="notes-title">Notas</h1>
              </div>
              <div className="notes-actions">
                <input ref={noteFileInputRef} className="note-file-input" type="file" accept=".txt,text/plain" onChange={readNoteFile} aria-label="Abrir archivo TXT" />
                <button className="notes-action-button" onClick={openNote}><FolderOpen size={15} />Abrir TXT</button>
                <button className="notes-action-button" onClick={startNewNote}><FilePlus2 size={15} />Nueva nota</button>
              </div>
            </div>
            <section className="notes-editor" aria-label="Editor de notas">
              <div className="notes-editor-header">
                <label className="note-name-field">
                  <span>Nombre del archivo</span>
                  <div><input value={noteTitle} readOnly={Boolean(noteId)} onChange={(event) => { setNoteTitle(event.target.value); setNoteStatus(''); }} placeholder="Nota nueva" aria-label="Nombre del archivo de nota" /><span>.txt</span></div>
                </label>
                <span className="notes-folder-hint">kofi_lofi/notas</span>
              </div>
              <textarea className="notes-textarea" value={noteContent} onChange={(event) => { setNoteContent(event.target.value); setNoteStatus(''); }} onKeyDown={handleNoteKeyDown} placeholder="Escribe aquí…" aria-label="Texto de la nota" />
              <div className="notes-editor-footer">
                <span className="note-status" role="status">{noteStatus}</span>
                <button className="save-note-button" onClick={saveNote}><Save size={16} />{noteId ? 'Guardar cambios' : 'Guardar nota'}</button>
              </div>
            </section>
          </section>
        ) : (
          <section className="radio-view" aria-labelledby="radio-title">
            <div className="radio-heading">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" />MI BIBLIOTECA</div>
                <h1 id="radio-title">Mi <em>música.</em></h1>
              </div>
              <div className="library-actions">
                <input ref={fileInputRef} className="audio-file-input" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac" multiple onChange={importTracks} aria-label="Añadir archivos de audio" />
                <span className="library-count">{library.length} {library.length === 1 ? 'canción' : 'canciones'}</span>
                <button className="add-music-button" onClick={() => fileInputRef.current?.click()}><Plus size={16} />Añadir música</button>
              </div>
            </div>

            <div className="radio-grid" onDragOver={(event) => { event.preventDefault(); setDropActive(true); }} onDragEnter={(event) => { event.preventDefault(); setDropActive(true); }} onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setDropActive(false);
            }} onDrop={handleDropFiles}>
              <section className={`now-playing-panel${dropActive ? ' dropzone-active' : ''}`} aria-label="Reproductor de música">
                <div className="now-playing-top"><span className="live-indicator"><span /> {isPlaying ? 'REPRODUCIENDO' : 'TU BIBLIOTECA'}</span><Music2 size={17} /></div>
                <div className="radio-record"><span className="record-disc"><span /></span></div>
                <div className="now-playing-station">{currentTrack ? currentTrack.artist : 'MÚSICA LOCAL'} <span>·</span> {currentTrack ? 'Tu biblioteca' : 'Biblioteca'}</div>
                <h2>{currentTrack?.title ?? (libraryStatus === 'loading' ? 'Cargando tu música…' : 'Aún no hay canciones')}</h2>
                <p className="now-playing-artist">{currentTrack ? currentTrack.artist : 'Añade archivos de audio para empezar'}</p>
                {libraryError && <p className="library-error" role="status">{libraryError}</p>}
                <div className="radio-main-controls">
                  <button className="track-skip-button" onClick={() => skipTrack(-1)} disabled={library.length === 0} aria-label="Canción anterior" title="Canción anterior"><SkipBack size={18} fill="currentColor" /></button>
                  <button className="radio-main-toggle" onClick={togglePlayback} disabled={!currentTrack} aria-label={isPlaying ? 'Pausar canción' : 'Reproducir canción'}>
                    {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    {isPlaying ? 'Pausar' : 'Reproducir'}
                  </button>
                  <button className="track-skip-button" onClick={() => skipTrack(1)} disabled={library.length === 0} aria-label="Canción siguiente" title="Canción siguiente"><SkipForward size={18} fill="currentColor" /></button>
                </div>
                {isLiveYoutubeTrack ? (
                  <div className="song-progress-live" role="status"><span className="live-indicator"><span />EN DIRECTO</span></div>
                ) : (
                  <label className="song-progress-control">
                    <span className="sr-only">Progreso de la canción</span>
                    <input type="range" min="0" max={trackDuration || 1} step="0.1" value={Math.min(currentTime, trackDuration || 0)} onChange={seekTrack} disabled={!currentTrack || trackDuration === 0} style={{ '--progress': `${progress}%` }} aria-label="Progreso de la canción" />
                    <span className="song-progress-time"><span>{formatPlaybackTime(currentTime)}</span><span>{formatPlaybackTime(trackDuration)}</span></span>
                  </label>
                )}
                {!currentTrack && <button className="empty-library-add" onClick={() => fileInputRef.current?.click()}><Plus size={16} />Añadir archivos de audio</button>}
                <span className="now-playing-decoration" aria-hidden="true">✳</span>
              </section>

              <section className="rapid-search-panel" aria-label="Búsqueda de música lofi en YouTube Data API">
                <div className="rapid-search-header">
                  <div>
                    <div className="eyebrow">LOFI DISCOVERY</div>
                    <h3>Búsqueda rápida</h3>
                  </div>
                  <button className="add-music-button" onClick={searchLofiContent} disabled={youtubeLoading || youtubeResultsExhausted}>
                    {youtubeLoading ? 'Buscando…' : hasMoreYoutubeResults ? 'Buscar más' : youtubeResultsExhausted ? 'Sin más resultados' : 'Buscar lofi'}
                  </button>
                </div>

                <div className="rapid-search-bar">
                  <input
                    type="text"
                    value={youtubeSearch}
                    onChange={(event) => setYoutubeSearch(event.target.value)}
                    placeholder="Busca estilo lofi"
                    aria-label="Búsqueda de música lofi en YouTube"
                  />
                </div>

                {youtubeError && <p className="rapid-status error">{youtubeError}</p>}

                <div className="rapid-results" role="list">
                  {youtubeResults.length === 0 ? (
                    <p className="rapid-empty">Busca un estilo como “lofi study”, “night drift” o “rainy jazz” para cargar contenido de YouTube.</p>
                  ) : (
                    youtubeResults.map((result) => (
                      <article className="rapid-result" key={result.id} role="listitem">
                        <div className="rapid-result-copy">
                          <span className="rapid-kind">{result.kind === 'video' ? 'Vídeo' : 'Lista'}</span>
                          <strong>{result.title}</strong>
                          <small>{result.artist}</small>
                        </div>
                        <button className="rapid-add-button" onClick={() => queueYoutubeResult(result)}>
                          <Plus size={14} />Añadir
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <aside className={`track-drawer${drawerOpen ? ' is-open' : ''}`}>
                <button ref={drawerToggleRef} className="track-drawer-toggle" onClick={() => setDrawerOpen((open) => !open)} aria-expanded={drawerOpen} aria-label={drawerOpen ? 'Cerrar lista de canciones' : 'Abrir lista de canciones'} title="Lista de canciones">
                  <span>LISTA</span><ChevronLeft size={19} />
                </button>
                  <section ref={drawerPanelRef} className="track-drawer-panel" aria-labelledby="library-title">
                    <div className="track-drawer-header">
                      <div>
                        <div className="eyebrow">{drawerSection === 'tracks' ? 'MI MÚSICA' : 'COLECCIONES'}</div>
                        <h2 id="library-title">{selectedPlaylist?.name ?? (drawerSection === 'tracks' ? 'Lista de canciones' : 'Mis playlists')}</h2>
                      </div>
                      <div className="track-drawer-header-actions">
                        <button className="add-track-icon" onClick={() => fileInputRef.current?.click()} aria-label="Añadir canciones"><Plus size={17} /></button>
                        <button className="track-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Cerrar lista de canciones"><X size={15} /></button>
                      </div>
                    </div>

                    <div className="drawer-tabs" role="tablist" aria-label="Biblioteca de música">
                      <button className={drawerSection === 'tracks' ? 'selected' : ''} onClick={() => { setDrawerSection('tracks'); setSelectedPlaylistId(null); setAddingPlaylistTracks(false); }} aria-pressed={drawerSection === 'tracks'}><Music2 size={14} />Canciones</button>
                      <button className={drawerSection === 'playlists' ? 'selected' : ''} onClick={() => { setDrawerSection('playlists'); setSelectedPlaylistId(null); setAddingPlaylistTracks(false); }} aria-pressed={drawerSection === 'playlists'}><ListMusic size={14} />Playlists</button>
                    </div>

                    {drawerSection === 'tracks' ? (
                      <>
                        <div className="track-filters" role="group" aria-label="Filtrar canciones">
                          <button className={libraryFilter === 'all' ? 'selected' : ''} onClick={() => setLibraryFilter('all')} aria-pressed={libraryFilter === 'all'}>Todas</button>
                          <button className={libraryFilter === 'own' ? 'selected' : ''} onClick={() => setLibraryFilter('own')} aria-pressed={libraryFilter === 'own'}>Mias</button>
                          <button className={libraryFilter === 'youtube' ? 'selected' : ''} onClick={() => setLibraryFilter('youtube')} aria-pressed={libraryFilter === 'youtube'}>Marea</button>
                        </div>
                        {libraryStatus === 'loading' ? (
                          <p className="track-message">Cargando tu biblioteca…</p>
                        ) : filteredLibrary.length === 0 ? (
                          <p className="track-message">{library.length === 0 ? 'Tu lista está vacía. Añade canciones locales o desde la búsqueda lofi.' : 'No hay canciones en este filtro.'}</p>
                        ) : (
                          <ol className="track-list">
                            {filteredLibrary.map((track) => {
                              const index = library.findIndex((item) => item.id === track.id);
                              return (
                                <li key={track.id} className={`track-item${index === selectedTrack ? ' track-current' : ''}`}>
                                  <button className="track-row" onClick={() => playTrack(index)} aria-current={index === selectedTrack ? 'true' : undefined}>
                                    <span className="track-index">{index === selectedTrack && isPlaying ? <Music2 size={15} /> : String(index + 1).padStart(2, '0')}</span>
                                    <span className="track-details"><span className="track-title">{track.title}</span><span className="track-artist">{track.artist} <span className="track-source">{track.source === 'youtube' ? 'LOFI' : 'PROPIA'}</span></span></span>
                                    <span className="track-time">{index === selectedTrack && isPlaying ? 'SUENA' : <Play size={13} />}</span>
                                  </button>
                                  <button className="track-remove" onClick={(event) => { event.stopPropagation(); removeTrackFromLibrary(index); }} aria-label={`Quitar ${track.title} de la biblioteca`} title="Quitar de la biblioteca">
                                    <X size={12} />
                                  </button>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </>
                    ) : selectedPlaylist ? (
                      <div className="playlist-detail">
                        <button className="playlist-back" onClick={() => { setSelectedPlaylistId(null); setAddingPlaylistTracks(false); }}><ChevronLeft size={15} />Todas las playlists</button>
                        <div className="playlist-detail-summary">
                          <span>{selectedPlaylistTracks.length} {selectedPlaylistTracks.length === 1 ? 'canción' : 'canciones'}</span>
                          <button className="track-remove" onClick={() => deletePlaylist(selectedPlaylist.id)} aria-label={`Eliminar playlist ${selectedPlaylist.name}`} title="Eliminar playlist"><X size={13} /></button>
                        </div>
                        <div className="playlist-controls">
                          <button className="playlist-play-button" onClick={() => startPlaylistPlayback(selectedPlaylist)} disabled={selectedPlaylistTracks.length === 0}><Play size={14} fill="currentColor" />Reproducir</button>
                          <button className={`playlist-shuffle-button${selectedPlaylist.shuffle ? ' selected' : ''}`} onClick={() => togglePlaylistShuffle(selectedPlaylist.id)} aria-pressed={selectedPlaylist.shuffle} title={selectedPlaylist.shuffle ? 'Reproducción aleatoria activada' : 'Reproducción en orden'}><Shuffle size={15} />{selectedPlaylist.shuffle ? 'Aleatorio' : 'En orden'}</button>
                        </div>
                        <button className="playlist-add-songs" onClick={() => setAddingPlaylistTracks((adding) => !adding)}><Plus size={14} />{addingPlaylistTracks ? 'Volver a la playlist' : 'Añadir canciones'}</button>
                        {addingPlaylistTracks ? (
                          library.length === 0 ? <p className="track-message">Añade canciones a tu biblioteca antes de incluirlas en una playlist.</p> : (
                            <ol className="track-list playlist-track-list">
                              {library.map((track) => {
                                const isAdded = selectedPlaylist.trackIds.includes(track.id);
                                return (
                                  <li key={track.id} className="track-item">
                                    <div className="track-row playlist-add-row">
                                      <span className="track-index"><Music2 size={14} /></span>
                                      <span className="track-details"><span className="track-title">{track.title}</span><span className="track-artist">{track.artist}</span></span>
                                      <button className="playlist-track-action" onClick={() => addTrackToPlaylist(selectedPlaylist.id, track.id)} disabled={isAdded} aria-label={isAdded ? `${track.title} ya está en la playlist` : `Añadir ${track.title} a la playlist`}>{isAdded ? <Check size={15} /> : <Plus size={15} />}</button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ol>
                          )
                        ) : selectedPlaylistTracks.length === 0 ? (
                          <p className="track-message">Esta playlist está vacía. Añade canciones para empezar.</p>
                        ) : (
                          <ol className="track-list playlist-track-list">
                            {selectedPlaylistTracks.map((track, playlistIndex) => {
                              const index = library.findIndex((item) => item.id === track.id);
                              return (
                                <li key={track.id} className={`track-item${index === selectedTrack && activePlaylistId === selectedPlaylist.id ? ' track-current' : ''}`}>
                                  <button className="track-row" onClick={() => startPlaylistPlayback(selectedPlaylist, track.id)} aria-current={index === selectedTrack && activePlaylistId === selectedPlaylist.id ? 'true' : undefined}>
                                    <span className="track-index">{String(playlistIndex + 1).padStart(2, '0')}</span>
                                    <span className="track-details"><span className="track-title">{track.title}</span><span className="track-artist">{track.artist}</span></span>
                                    <span className="track-time"><Play size={13} /></span>
                                  </button>
                                  <button className="track-remove" onClick={() => removeTrackFromPlaylist(selectedPlaylist.id, track.id)} aria-label={`Quitar ${track.title} de ${selectedPlaylist.name}`} title="Quitar de esta playlist"><X size={12} /></button>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </div>
                    ) : (
                      <div className="playlist-library">
                        <form className="playlist-create-form" onSubmit={createPlaylist}>
                          <input value={playlistNameDraft} onChange={(event) => setPlaylistNameDraft(event.target.value)} maxLength={60} placeholder="Nombre de la playlist" aria-label="Nombre de la nueva playlist" />
                          <button type="submit" disabled={!playlistNameDraft.trim()} aria-label="Crear playlist"><Plus size={17} /></button>
                        </form>
                        {playlists.length === 0 ? (
                          <p className="track-message">Crea una playlist y añade canciones locales o lofi.</p>
                        ) : (
                          <ol className="playlist-list">
                            {playlists.map((playlist) => {
                              const trackCount = playlist.trackIds.filter((trackId) => library.some((track) => track.id === trackId)).length;
                              return (
                                <li key={playlist.id} className="playlist-list-item">
                                  <button className="playlist-open-button" onClick={() => setSelectedPlaylistId(playlist.id)}>
                                    <ListMusic size={17} />
                                    <span><strong>{playlist.name}</strong><small>{trackCount} {trackCount === 1 ? 'canción' : 'canciones'}</small></span>
                                  </button>
                                  <button className="playlist-list-action" onClick={() => startPlaylistPlayback(playlist)} disabled={trackCount === 0} aria-label={`Reproducir ${playlist.name}`} title="Reproducir"><Play size={14} fill="currentColor" /></button>
                                  <button className="playlist-list-action remove" onClick={() => deletePlaylist(playlist.id)} aria-label={`Eliminar playlist ${playlist.name}`} title="Eliminar playlist"><X size={14} /></button>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </div>
                    )}
                  </section>
              </aside>
            </div>
          </section>
        )}
      </main>

      <footer className={`player-bar${youtubeExpanded ? ' video-expanded' : ''}`} id="radio">
        <audio ref={audioRef} src={currentTrack?.source === 'youtube' ? undefined : currentTrack?.audioUrl} preload="metadata" onCanPlay={resumeSelectedTrack} onLoadedMetadata={(event) => { if (currentTrack?.source !== 'youtube') setTrackDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0); }} onTimeUpdate={(event) => { if (currentTrack?.source !== 'youtube') setCurrentTime(event.currentTarget.currentTime); }} onEnded={() => skipTrack(1)} onPause={(event) => { if (event.currentTarget.paused) setIsPlaying(false); }} onPlay={() => setIsPlaying(true)} onError={(event) => { if (currentTrack?.source !== 'youtube' && event.currentTarget.error?.code !== 1) setLibraryError('No se pudo leer este archivo de audio.'); }} />
        {currentTrack?.source === 'youtube' ? (
          <>
            <div className={`youtube-video-stage${youtubeExpanded ? ' is-expanded' : ''}`}>
              <div className="youtube-embed-shell" aria-label="Reproductor de YouTube">
                <div ref={youtubeContainerRef} />
              </div>
              {youtubeExpanded && <button className="youtube-video-close" onClick={() => setYoutubeExpanded(false)} aria-label="Volver al programa" title="Volver al programa"><X size={19} /></button>}
            </div>
            {!youtubeExpanded && <button className="youtube-video-expand" onClick={() => setYoutubeExpanded(true)} aria-label="Ver vídeo en grande" title="Ver vídeo en grande"><Maximize2 size={17} /></button>}
            {youtubeExpanded && <button className="youtube-video-backdrop" onClick={() => setYoutubeExpanded(false)} aria-label="Volver al programa" />}
          </>
        ) : (
          <>
            <div className="station-art" aria-hidden="true"><span className="record-disc"><span /></span><span className="art-sparkle">✳</span></div>
            <div className="station-info"><div className="station-title">{currentTrack?.title ?? 'Mi música'}</div><div className="station-subtitle">{currentTrack?.artist ?? 'Añade canciones para empezar'}</div></div>
          </>
        )}
        <div className="player-divider" />
        <div className="player-controls">
          <button className="player-skip-button" onClick={() => skipTrack(-1)} disabled={library.length === 0} aria-label="Canción anterior" title="Canción anterior"><SkipBack size={17} fill="currentColor" /></button>
          <button className={`play-button${isPlaying ? ' playing' : ''}`} onClick={togglePlayback} disabled={!currentTrack} aria-label={isPlaying ? 'Pausar canción' : 'Reproducir canción'} title={isPlaying ? 'Pausar' : 'Reproducir'}>
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button className="player-skip-button" onClick={() => skipTrack(1)} disabled={library.length === 0} aria-label="Canción siguiente" title="Canción siguiente"><SkipForward size={17} fill="currentColor" /></button>
        </div>
        {currentTrack?.source !== 'youtube' && (
          <div className="volume-control">
            <input className="volume-slider" aria-label="Volumen de la música" type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
          </div>
        )}
        {libraryError && <div className="radio-error" role="status">{libraryError}</div>}
      </footer>
      <div className="library-notice" role="status" aria-live="polite" aria-atomic="true">
        {libraryNotice && <><Check size={17} aria-hidden="true" /><span>{libraryNotice.message}</span></>}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
