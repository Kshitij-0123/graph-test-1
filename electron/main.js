import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.VITE_DEV_SERVER_URL;

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const getGraphBaseDir = (filePath) => path.dirname(filePath);

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('graph:open', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open graph',
    properties: ['openFile'],
    filters: [{ name: 'Graph JSON', extensions: ['json'] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const data = await fs.readFile(filePath, 'utf-8');
  return { filePath, baseDir: getGraphBaseDir(filePath), data };
});

ipcMain.handle('graph:save', async (_event, { filePath, content }) => {
  await ensureDir(getGraphBaseDir(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
  return { filePath, baseDir: getGraphBaseDir(filePath) };
});

ipcMain.handle('graph:saveAs', async (_event, { suggestedName }) => {
  const result = await dialog.showSaveDialog({
    title: 'Save graph as',
    defaultPath: `${suggestedName || 'graph'}.json`,
    filters: [{ name: 'Graph JSON', extensions: ['json'] }]
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  const rawPath = result.filePath;
  const baseName = path.basename(rawPath, path.extname(rawPath));
  const baseDir = path.join(path.dirname(rawPath), `${baseName}_data`);
  await ensureDir(baseDir);
  const filePath = path.join(baseDir, `${baseName}.json`);
  return { filePath, baseDir };
});

ipcMain.handle('node:read', async (_event, { baseDir, nodeId }) => {
  const nodePath = path.join(baseDir, 'nodes', `${nodeId}.md`);
  try {
    return await fs.readFile(nodePath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
});

ipcMain.handle('node:write', async (_event, { baseDir, nodeId, content }) => {
  const nodesDir = path.join(baseDir, 'nodes');
  await ensureDir(nodesDir);
  const nodePath = path.join(nodesDir, `${nodeId}.md`);
  await fs.writeFile(nodePath, content, 'utf-8');
  return true;
});
