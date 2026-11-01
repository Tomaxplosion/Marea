const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron');
const path = require('node:path');
const openedNotes = new Map();

ipcMain.handle('backup:export', async (event, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Exportar copia de Marea', defaultPath: `Marea-${new Date().toISOString().slice(0, 10)}.marea`,
    filters: [{ name: 'Copia de Marea', extensions: ['marea'] }]
  });
  if (canceled || !filePath) return false;
  const directory = path.join(await findProjectRoot(), 'notas');
  const notes = [];
  let entries = [];
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) {
      notes.push({ name: entry.name, content: await fs.readFile(path.join(directory, entry.name), 'utf8') });
    }
  }
  await fs.writeFile(filePath, JSON.stringify({ ...data, notes }), 'utf8');
  return true;
});

ipcMain.handle('backup:open', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Importar copia de Marea', properties: ['openFile'],
    filters: [{ name: 'Copia de Marea', extensions: ['marea'] }]
  });
  return canceled ? null : fs.readFile(filePaths[0], 'utf8');
});

ipcMain.handle('backup:notes', async (_event, notes) => {
  if (!Array.isArray(notes) || notes.some((note) => !note || typeof note.name !== 'string' ||
    !/^[^<>:"/\\|?*\x00-\x1f]+\.txt$/i.test(note.name) || typeof note.content !== 'string')) {
    throw new TypeError('Las notas de la copia no son válidas.');
  }
  const directory = path.join(await findProjectRoot(), 'notas');
  await fs.mkdir(directory, { recursive: true });
  const originals = new Map();
  for (const note of notes) {
    try { originals.set(note.name, await fs.readFile(path.join(directory, note.name))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; originals.set(note.name, null); }
  }
  try {
    for (const note of notes) await fs.writeFile(path.join(directory, note.name), note.content, 'utf8');
  } catch (error) {
    for (const [name, content] of originals) {
      if (content === null) await fs.rm(path.join(directory, name), { force: true });
      else await fs.writeFile(path.join(directory, name), content);
    }
    throw error;
  }
  openedNotes.clear();
});

async function findProjectRoot() {
  // Installed resources are read-only. Keep notes alongside the user's app data.
  if (app.isPackaged) return app.getPath('userData');
  const executableDirectory = path.dirname(app.getPath('exe'));
  const startPaths = [
    app.isPackaged ? executableDirectory : app.getAppPath(),
    process.cwd(),
    app.getAppPath()
  ];
  const visited = new Set();

  for (const startPath of startPaths) {
    let directory = path.resolve(startPath);
    while (!visited.has(directory)) {
      visited.add(directory);
      try {
        const packageInfo = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
        if (packageInfo.name === 'marea-lofi') return directory;
      } catch {}

      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }

  return app.isPackaged ? executableDirectory : app.getAppPath();
}

ipcMain.handle('notes:open', async (event) => {
  const projectRoot = await findProjectRoot();
  const notesDirectory = path.join(projectRoot, 'notas');
  let defaultPath = projectRoot;
  try {
    await fs.access(notesDirectory);
    defaultPath = notesDirectory;
  } catch {}

  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Abrir nota de texto',
    defaultPath,
    properties: ['openFile'],
    filters: [{ name: 'Archivos de texto', extensions: ['txt'] }]
  });
  if (canceled || filePaths.length === 0) return null;

  const filePath = filePaths[0];
  if (path.extname(filePath).toLowerCase() !== '.txt') throw new TypeError('Solo se pueden abrir archivos .txt.');
  const stats = await fs.stat(filePath);
  if (stats.size > 2_000_000) throw new RangeError('La nota supera el tamaño máximo de 2 MB.');

  const noteId = randomUUID();
  const fileName = path.basename(filePath);
  openedNotes.clear();
  openedNotes.set(noteId, filePath);
  return {
    noteId,
    fileName,
    title: path.basename(fileName, path.extname(fileName)),
    content: await fs.readFile(filePath, 'utf8')
  };
});

ipcMain.handle('notes:save', async (_event, note) => {
  if (typeof note?.title !== 'string' || typeof note?.content !== 'string') {
    throw new TypeError('La nota debe incluir un nombre y texto.');
  }
  if (Buffer.byteLength(note.content, 'utf8') > 2_000_000) {
    throw new RangeError('La nota supera el tamaño máximo de 2 MB.');
  }

  const safeName = note.title
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/[. ]+$/g, '')
    .slice(0, 100);
  const projectRoot = await findProjectRoot();
  const notesDirectory = path.join(projectRoot, 'notas');
  const originalPath = typeof note.noteId === 'string' ? openedNotes.get(note.noteId) : undefined;
  if (note.noteId && !originalPath) throw new Error('La nota original ya no está abierta.');
  const filePath = originalPath ?? path.join(notesDirectory, `${safeName || 'Nota'}.txt`);

  if (!originalPath) await fs.mkdir(notesDirectory, { recursive: true });
  await fs.writeFile(filePath, note.content, 'utf8');
  const noteId = note.noteId ?? randomUUID();
  openedNotes.set(noteId, filePath);
  return { fileName: path.basename(filePath), noteId };
});

ipcMain.handle('window:is-fullscreen', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false;
});

ipcMain.handle('window:toggle-fullscreen', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return false;
  window.setFullScreen(!window.isFullScreen());
  return window.isFullScreen();
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 760,
    minHeight: 620,
    backgroundColor: '#f7f6f0',
    title: 'Marea',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  window.on('enter-full-screen', () => window.webContents.send('window:fullscreen-changed', true));
  window.on('leave-full-screen', () => window.webContents.send('window:fullscreen-changed', false));
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'F11') return;
    event.preventDefault();
    window.setFullScreen(!window.isFullScreen());
  });

  if (!app.isPackaged) {
    window.loadURL('http://127.0.0.1:5173');
  } else {
    window.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.marea.lofi');
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
