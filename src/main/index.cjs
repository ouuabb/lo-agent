/**
 * lo-agent 主进程入口
 *
 * 开发模式（ELECTRON_RENDERER_URL 存在时）加载 Vite dev server；
 * 生产模式加载构建产物 dist/index.html。
 */
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { LoCoreService } = require('./lo-core.cjs');
const { ConfigStore } = require('./config-store.cjs');
const { registerLoCoreIpc } = require('./ipc.cjs');

const RENDERER_URL = process.env.ELECTRON_RENDERER_URL;

let loCoreService = null;

function initLoCore() {
  const store = new ConfigStore(app.getPath('userData'));
  loCoreService = new LoCoreService({ loadConfig: () => store.load() });
  registerLoCoreIpc(ipcMain, loCoreService);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (RENDERER_URL) {
    win.loadURL(RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }

  // 外部链接交给系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  initLoCore();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
