export const defaultTasks = [
  { id: 1, text: 'Repasar los apuntes de hoy', done: false },
  { id: 2, text: 'Avanzar con el proyecto', done: false },
  { id: 3, text: 'Leer un capítulo', done: true }
];

export const MAX_DURATION_MINUTES = 8 * 60;

export function readTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem('marea-tasks'));
    return Array.isArray(saved) ? saved : defaultTasks;
  } catch {
    return defaultTasks;
  }
}

export function formatPlaybackTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safeSeconds % 3600 / 60);
  const remainder = String(safeSeconds % 60).padStart(2, '0');
  if (safeSeconds >= 3600) {
    return `${Math.floor(safeSeconds / 3600)}:${String(minutes).padStart(2, '0')}:${remainder}`;
  }
  return `${Math.floor(safeSeconds / 60)}:${remainder}`;
}

export function formatTimerTime(totalSeconds) {
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

export function formatCompactTimerTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor(safeSeconds % 3600 / 60);
  const seconds = safeSeconds % 60;
  const clockMinutes = hours > 0 ? minutes : Math.floor(safeSeconds / 60);
  const clock = `${String(clockMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${clock}` : clock;
}
