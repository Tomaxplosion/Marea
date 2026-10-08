export const CALENDAR_KEY = 'marea-calendar-events';
export const IMPORTANCE = {
  high: { label: 'Alta', rank: 0 },
  medium: { label: 'Media', rank: 1 },
  low: { label: 'Baja', rank: 2 }
};

export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && dateKey(date) === value;
}

export function monthDays(month) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const offset = (start.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) =>
    new Date(month.getFullYear(), month.getMonth(), index - offset + 1, 12));
}

export function readCalendarEvents() {
  try {
    const saved = JSON.parse(localStorage.getItem(CALENDAR_KEY));
    const ids = new Set();
    return Array.isArray(saved) ? saved.filter((event) => {
      if (!event || typeof event.id !== 'string' || ids.has(event.id) ||
        typeof event.title !== 'string' || !event.title.trim() || !isValidDate(event.date) ||
        !Object.hasOwn(IMPORTANCE, event.importance)) return false;
      ids.add(event.id);
      return true;
    }).map((event) => ({
      id: event.id, title: event.title.slice(0, 100), date: event.date,
      importance: event.importance,
      time: typeof event.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(event.time) ? event.time : '',
      notes: typeof event.notes === 'string' ? event.notes.slice(0, 2000) : ''
    })) : [];
  } catch {
    return [];
  }
}

export function sortEvents(events) {
  return [...events].sort((a, b) => (a.time || '24:00').localeCompare(b.time || '24:00') ||
    IMPORTANCE[a.importance].rank - IMPORTANCE[b.importance].rank || a.title.localeCompare(b.title, 'es'));
}
