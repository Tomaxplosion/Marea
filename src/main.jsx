import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Check,
  Circle,
  ChevronLeft,
  FilePlus2,
  FileText,
  FolderOpen,
  Headphones,
  ListTodo,
  Moon,
  Music2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  SkipBack,
  SkipForward,
  Sun,
  Waves,
  X
} from 'lucide-react';
import './style.css';

const defaultTasks = [
  { id: 1, text: 'Repasar los apuntes de hoy', done: false },
  { id: 2, text: 'Avanzar con el proyecto', done: false },
  { id: 3, text: 'Leer un capítulo', done: true }
];

const MAX_DURATION_MINUTES = 8 * 60;
const TRACK_DATABASE = 'marea-audio-library';
const TRACK_STORE = 'tracks';

function openTrackDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TRACK_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(TRACK_STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readSavedTracks() {
  const database = await openTrackDatabase();
  const tracks = await new Promise((resolve, reject) => {
    const request = database.transaction(TRACK_STORE).objectStore(TRACK_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return tracks.sort((first, second) => (first.order ?? 0) - (second.order ?? 0));
}

async function saveTracks(tracks) {
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

function getTrackName(filename) {
  const name = filename.replace(/\.[^.]+$/, '');
  const separator = name.indexOf(' - ');
  return separator > 0
    ? { artist: name.slice(0, separator), title: name.slice(separator + 3) }
    : { artist: 'Tu biblioteca', title: name };
}

function formatPlaybackTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function formatTimerTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor(safeSeconds % 3600 / 60);
  const seconds = safeSeconds % 60;

  if (hours === 0 && minutes === 0) return `${seconds} s`;
  if (hours === 0) return `${minutes}:${String(seconds).padStart(2, '0')}`;

  const parts = [`${hours} h`];
  if (minutes > 0) parts.push(`${minutes} min`);
  if (seconds > 0) parts.push(`${seconds} s`);
  return parts.join(' ');
}

function readTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem('marea-tasks'));
    return Array.isArray(saved) ? saved : defaultTasks;
  } catch {
    return defaultTasks;
  }
}

function App() {
  const [tasks, setTasks] = useState(readTasks);
  const [draft, setDraft] = useState('');
  const [view, setView] = useState('space');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteId, setNoteId] = useState(null);
  const [noteStatus, setNoteStatus] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('marea-theme') === 'dark' ? 'dark' : 'light');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(() => {
    const saved = Number(localStorage.getItem('marea-duration'));
    return Number.isInteger(saved) && saved >= 1 && saved <= MAX_DURATION_MINUTES ? saved : 25;
  });
  const [seconds, setSeconds] = useState(durationMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [library, setLibrary] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [audioSource, setAudioSource] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [libraryStatus, setLibraryStatus] = useState('loading');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [libraryError, setLibraryError] = useState('');
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const noteFileInputRef = useRef(null);
  const autoPlaySelectedTrack = useRef(false);

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
    let active = true;
    readSavedTracks().then((savedTracks) => {
      if (!active) return;
      setLibrary(savedTracks.map((track) => ({ ...track, audioUrl: URL.createObjectURL(track.file) })));
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
    if (!isRunning) return undefined;
    const interval = window.setInterval(() => {
      setSeconds((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (isRunning && seconds === 0) setIsRunning(false);
  }, [isRunning, seconds]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  const completedCount = tasks.filter((task) => task.done).length;
  const remainingTasks = tasks.length - completedCount;
  const currentTrack = library[selectedTrack];
  const time = formatTimerTime(seconds);
  const progress = trackDuration > 0 ? currentTime / trackDuration * 100 : 0;
  const today = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());

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
    if (!audioRef.current || !currentTrack) return;
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

  function playTrack(index) {
    const track = library[index];
    if (!track || !audioRef.current) return;
    setLibraryError('');
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
    const nextIndex = (selectedTrack + direction + library.length) % library.length;
    playTrack(nextIndex);
  }

  async function importTracks(event) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('audio/'));
    if (files.length === 0) {
      setLibraryError('Selecciona archivos de audio compatibles.');
      return;
    }

    const importOrder = Date.now();
    const tracks = files.map((file, index) => {
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
        .map((track) => ({ ...track, audioUrl: URL.createObjectURL(track.file) }));
      if (library.length === 0 && additions.length > 0) setSelectedTrack(0);
      setLibrary((current) => {
        return [...current, ...additions];
      });
      setLibraryStatus('ready');
      setLibraryError('');
      setDrawerOpen(true);
    } catch {
      setLibraryError('No se pudieron guardar las canciones en este equipo.');
    } finally {
      event.target.value = '';
    }
  }

  function seekTrack(event) {
    const nextTime = Number(event.target.value);
    if (!audioRef.current || !Number.isFinite(nextTime)) return;
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  return (
    <div className="app-shell" data-theme={theme}>
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
        </nav>

        <section className="settings-section" aria-label="Ajustes">
          <div className="side-label">AJUSTES</div>
          <label className="theme-setting">
            <span className="theme-setting-icon">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</span>
            <span className="theme-setting-copy"><strong>Modo oscuro</strong><small>{theme === 'dark' ? 'Activado' : 'Desactivado'}</small></span>
            <input className="theme-checkbox" type="checkbox" checked={theme === 'dark'} onChange={(event) => setTheme(event.target.checked ? 'dark' : 'light')} aria-label="Modo oscuro" />
            <span className="theme-switch" aria-hidden="true"><span /></span>
          </label>
        </section>
      </aside>

      <main className="main-content" id="inicio">
        <header className="topbar">
          <div className="date-label"><span className="date-dot" />{today}</div>
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
                <button className="timer-play" onClick={() => setIsRunning((running) => seconds === 0 ? false : !running)} aria-label={isRunning ? 'Pausar temporizador' : 'Iniciar temporizador'}>
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
              <textarea className="notes-textarea" value={noteContent} onChange={(event) => { setNoteContent(event.target.value); setNoteStatus(''); }} placeholder="Escribe aquí…" aria-label="Texto de la nota" />
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

            <div className="radio-layout">
              <section className="now-playing-panel" aria-label="Reproductor de música">
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
                <label className="song-progress-control">
                  <span className="sr-only">Progreso de la canción</span>
                  <input type="range" min="0" max={trackDuration || 1} step="0.1" value={Math.min(currentTime, trackDuration || 0)} onChange={seekTrack} disabled={!currentTrack || trackDuration === 0} style={{ '--progress': `${progress}%` }} aria-label="Progreso de la canción" />
                  <span className="song-progress-time"><span>{formatPlaybackTime(currentTime)}</span><span>{formatPlaybackTime(trackDuration)}</span></span>
                </label>
                {!currentTrack && <button className="empty-library-add" onClick={() => fileInputRef.current?.click()}><Plus size={16} />Añadir archivos de audio</button>}
                <span className="now-playing-decoration" aria-hidden="true">✳</span>
              </section>

              <aside className={`track-drawer${drawerOpen ? ' is-open' : ''}`}>
                <button className="track-drawer-toggle" onClick={() => setDrawerOpen((open) => !open)} aria-expanded={drawerOpen} aria-label={drawerOpen ? 'Cerrar lista de canciones' : 'Abrir lista de canciones'} title="Lista de canciones">
                  <span>LISTA</span><ChevronLeft size={19} />
                </button>
                  <section className="track-drawer-panel" aria-labelledby="library-title" onMouseLeave={() => setDrawerOpen(false)}>
                    <div className="track-drawer-header">
                      <div><div className="eyebrow">MI MÚSICA</div><h2 id="library-title">Lista de canciones</h2></div>
                      <button className="add-track-icon" onClick={() => fileInputRef.current?.click()} aria-label="Añadir canciones"><Plus size={17} /></button>
                    </div>
                    {libraryStatus === 'loading' ? (
                      <p className="track-message">Cargando tu biblioteca…</p>
                    ) : library.length === 0 ? (
                      <p className="track-message">Tu lista está vacía. Añade archivos MP3, WAV, OGG o M4A para escucharlos aquí.</p>
                    ) : (
                      <ol className="track-list">
                        {library.map((track, index) => (
                          <li key={track.id}>
                            <button className={`track-row${index === selectedTrack ? ' track-current' : ''}`} onClick={() => playTrack(index)} aria-current={index === selectedTrack ? 'true' : undefined}>
                              <span className="track-index">{index === selectedTrack && isPlaying ? <Music2 size={15} /> : String(index + 1).padStart(2, '0')}</span>
                              <span className="track-details"><span className="track-title">{track.title}</span><span className="track-artist">{track.artist}</span></span>
                              <span className="track-time">{index === selectedTrack && isPlaying ? 'SUENA' : <Play size={13} />}</span>
                            </button>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
              </aside>
            </div>
          </section>
        )}
      </main>

      <footer className="player-bar" id="radio">
        <audio ref={audioRef} src={currentTrack?.audioUrl ?? undefined} preload="metadata" onCanPlay={resumeSelectedTrack} onLoadedMetadata={(event) => setTrackDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onEnded={() => skipTrack(1)} onPause={(event) => { if (event.currentTarget.paused) setIsPlaying(false); }} onPlay={() => setIsPlaying(true)} onError={(event) => { if (event.currentTarget.error?.code !== 1) setLibraryError('No se pudo leer este archivo de audio.'); }} />
        <div className="station-art" aria-hidden="true"><span className="record-disc"><span /></span><span className="art-sparkle">✳</span></div>
        <div className="station-info"><div className="station-title">{currentTrack?.title ?? 'Mi música'}</div><div className="station-subtitle">{currentTrack?.artist ?? 'Añade canciones para empezar'}</div></div>
        <div className="player-divider" />
        <div className="player-controls">
          <button className="player-skip-button" onClick={() => skipTrack(-1)} disabled={library.length === 0} aria-label="Canción anterior" title="Canción anterior"><SkipBack size={17} fill="currentColor" /></button>
          <button className={`play-button${isPlaying ? ' playing' : ''}`} onClick={togglePlayback} disabled={!currentTrack} aria-label={isPlaying ? 'Pausar canción' : 'Reproducir canción'} title={isPlaying ? 'Pausar' : 'Reproducir'}>
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button className="player-skip-button" onClick={() => skipTrack(1)} disabled={library.length === 0} aria-label="Canción siguiente" title="Canción siguiente"><SkipForward size={17} fill="currentColor" /></button>
        </div>
        <div className="volume-control">
          <input className="volume-slider" aria-label="Volumen de la música" type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
        </div>
        {libraryError && <div className="radio-error" role="status">{libraryError}</div>}
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);