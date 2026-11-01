import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/lib/backup.mjs', import.meta.url), 'utf8'))
  .replace(/^import .* from '.\/music.js';/m,
    'const { openTrackDatabase, readSavedTracks, TRACK_STORE } = globalThis.backupMusic;');
let tracks = [];
let failNotes = false;
globalThis.backupMusic = {
  TRACK_STORE: 'tracks', readSavedTracks: async () => tracks,
  openTrackDatabase: async () => ({
    close() {}, transaction() {
      const next = [];
      const transaction = { objectStore: () => ({ clear() {}, put(track) { next.push(track); } }) };
      queueMicrotask(() => { tracks = next; transaction.oncomplete(); });
      return transaction;
    }
  })
};
const { createBackup, parseBackup, restoreBackup } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
globalThis.FileReader = class {
  readAsDataURL(file) { file.arrayBuffer().then((buffer) => {
    this.result = `data:${file.type};base64,${Buffer.from(buffer).toString('base64')}`;
    this.onload();
  }); }
};
globalThis.window = { marea: { restoreNotes: async () => { if (failNotes) throw new Error('disk full'); } } };

test('portable backup preserves audio bytes and settings and replaces destination library', async () => {
  const bytes = new Uint8Array([0, 1, 127, 128, 255]);
  tracks = [{ id: 'song', title: 'Canción', artist: 'Artista', file: new File([bytes], 'song.mp3', { type: 'audio/mpeg' }) }];
  storage.set('marea-tasks', JSON.stringify([{ id: 1, text: 'Estudiar', done: false }]));
  storage.set('unrelated', 'keep');
  const backup = await createBackup({ view: 'notes', noteTitle: 'Idea', noteContent: 'Texto', seconds: 123, volume: 42 });
  const parsed = parseBackup(JSON.stringify({ ...backup, notes: [{ name: 'Idea.txt', content: 'Texto' }] }));
  tracks = [{ id: 'old' }];
  storage.set('marea-theme', 'dark');
  await restoreBackup(parsed);
  assert.deepEqual(new Uint8Array(await tracks[0].file.arrayBuffer()), bytes);
  assert.equal(tracks[0].file.name, 'song.mp3');
  assert.equal(storage.has('marea-theme'), false);
  assert.equal(storage.get('unrelated'), 'keep');
  assert.equal(JSON.parse(storage.get('marea-session')).seconds, 123);
});

test('rejects incompatible and malformed copies before restore', () => {
  const valid = { format: 'marea-backup', version: 1, storage: {}, tracks: [], notes: [] };
  for (const invalid of [{ ...valid, version: 2 }, { ...valid, notes: [{ name: '../escape.txt', content: '' }] },
    { ...valid, storage: { 'marea-tasks': '[null]' } }, { ...valid, tracks: [{ id: 'broken' }] },
    { ...valid, storage: { unrelated: 'overwrite' } }]) {
    assert.throws(() => parseBackup(JSON.stringify(invalid)));
  }
});

test('restores previous storage and audio if writing notes fails', async () => {
  const previous = tracks;
  const previousStorage = [...storage];
  failNotes = true;
  await assert.rejects(restoreBackup({ storage: {}, tracks: [], notes: [] }), /disk full/);
  assert.deepEqual(tracks, previous);
  assert.deepEqual([...storage].sort(), previousStorage.sort());
  failNotes = false;
});
