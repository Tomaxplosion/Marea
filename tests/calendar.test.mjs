import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/lib/calendar.js', import.meta.url), 'utf8');
const { CALENDAR_KEY, dateKey, isValidDate, monthDays, readCalendarEvents, sortEvents } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('date keys use local dates and reject impossible dates', () => {
  assert.equal(dateKey(new Date(2026, 9, 9, 0, 1)), '2026-10-09');
  assert.equal(isValidDate('2024-02-29'), true);
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', 'invalid', null]) {
    assert.equal(isValidDate(date), false);
  }
});

test('month grids start on Monday and include every day through year boundaries', () => {
  for (const [year, month] of [[2024, 1], [2026, 1], [2026, 2], [2026, 11], [2027, 0]]) {
    const days = monthDays(new Date(year, month, 1, 12));
    assert.equal(days[0].getDay(), 1);
    assert.equal(days.at(-1).getDay(), 0);
    assert.equal(days.length % 7, 0);
    const inMonth = days.filter(day => day.getFullYear() === year && day.getMonth() === month);
    assert.equal(inMonth.length, new Date(year, month + 1, 0).getDate());
    assert.equal(inMonth[0].getDate(), 1);
  }
  assert.equal(monthDays(new Date(2026, 2, 1, 12)).length, 42);
});

test('events survive storage, with malformed entries and duplicate ids filtered out', () => {
  const event = { id: 'one', title: 'Examen', date: '2026-10-09', time: '09:30', importance: 'high', notes: 'Repasar' };
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null };
  assert.deepEqual(readCalendarEvents(), []);
  storage.set(CALENDAR_KEY, JSON.stringify([event]));
  assert.deepEqual(readCalendarEvents(), [event]);
  storage.set(CALENDAR_KEY, JSON.stringify([event, event, { ...event, id: 'bad-date', date: '2026-02-30' }, { ...event, id: 'bad-tag', importance: 'other' }, { ...event, id: 'empty', title: '  ' }, null]));
  assert.deepEqual(readCalendarEvents(), [event]);
  storage.set(CALENDAR_KEY, '{broken');
  assert.deepEqual(readCalendarEvents(), []);
});

test('daily agenda sorts timed events first, then importance, without mutating storage', () => {
  const events = [
    { id: 'all-low', title: 'Leer', time: '', importance: 'low' },
    { id: 'late', title: 'Clase', time: '16:00', importance: 'high' },
    { id: 'early', title: 'Estudiar', time: '09:00', importance: 'low' },
    { id: 'all-high', title: 'Entrega', time: '', importance: 'high' }
  ];
  assert.deepEqual(sortEvents(events).map(event => event.id), ['early', 'late', 'all-high', 'all-low']);
  assert.equal(events[0].id, 'all-low');
});
