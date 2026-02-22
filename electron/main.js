const { app, BrowserWindow, globalShortcut, ipcMain, desktopCapturer, Tray, nativeImage, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();
const DEFAULT_SHORTCUT = 'Control+Home';

let mainWindow = null;
let captureWindow = null;
let tray = null;
let currentShortcut = store.get('shortcut', DEFAULT_SHORTCUT);

// Иконка трея 16x16 (простой квадрат)
const TRAY_ICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAiklEQVQ4T2NkYGD4z0ABYBw1gGE0DBhGwwCY+jMCDfz//5+BYcQbYGRk/M/AMOINDGoXMDIy/mdgGPEGBrULGBkZ/zMwjHgDg9oFjIyM/xkYRryBQe0CRkbG/wwMI97AoHYBAPWEB2+XnLcAAAAASUVORK5CYII=';
function getTrayIcon() {
  return nativeImage.createFromDataURL('data:image/png;base64,' + TRAY_ICON_BASE64);
}

function getWindow() {
  return mainWindow;
}

function createTray() {
  tray = new Tray(getTrayIcon());
  tray.setToolTip('ScreenAI — Ctrl+Home для скриншота');
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть', click: () => { if (mainWindow) mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Выход', click: () => app.quit() },
  ]));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  const port = process.env.NEXT_DEV_PORT || process.env.PORT || 3000;
  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; if (tray) tray.destroy(); tray = null; });
}

function openCaptureOverlay() {
  if (captureWindow) {
    captureWindow.focus();
    return;
  }
  const { screen } = require('electron');
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.size;

  captureWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    fullscreen: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'capture-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  captureWindow.setBackgroundColor('#00000000');
  captureWindow.setFullScreen(true);
  captureWindow.loadFile(path.join(__dirname, 'capture.html'));

  captureWindow.on('closed', () => { captureWindow = null; });
}

function closeCaptureAndSendBounds(bounds) {
  if (captureWindow) {
    captureWindow.close();
    captureWindow = null;
  }
  const win = getWindow();
  if (win && bounds) {
    win.show();
    win.focus();
    win.webContents.send('capture-region', bounds);
  }
}

function registerShortcut(accelerator) {
  globalShortcut.unregisterAll();
  try {
    globalShortcut.register(accelerator, () => {
      openCaptureOverlay();
    });
    return true;
  } catch (e) {
    return false;
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcut(currentShortcut);
});

app.on('window-all-closed', () => {
  // Не выходим — работаем в фоне как ShareX (горячая клавиша активна)
});

app.on('activate', () => {
  if (mainWindow) mainWindow.show();
  else createWindow();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
});

ipcMain.on('capture-selection-done', (_, bounds) => {
  closeCaptureAndSendBounds(bounds);
});
ipcMain.on('capture-cancel', () => {
  if (captureWindow) {
    captureWindow.close();
    captureWindow = null;
  }
});

ipcMain.handle('get-screen-sources', () =>
  desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
);

// Источник для точки (чтобы захватывать нужный монитор и избежать чёрного экрана)
ipcMain.handle('get-screen-source-for-point', async (_, x, y) => {
  const { screen } = require('electron');
  const px = Math.round(x);
  const py = Math.round(y);
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
  const displays = screen.getAllDisplays();
  const display = screen.getDisplayNearestPoint({ x: px, y: py });
  let idx = displays.findIndex((d) => d.id === display.id);
  if (idx < 0) {
    idx = displays.findIndex((d) => {
      const b = d.bounds;
      return px >= b.x && px < b.x + b.width && py >= b.y && py < b.y + b.height;
    });
  }
  const source = idx >= 0 && sources[idx] ? sources[idx] : sources[0];
  return source ? source.id : null;
});

ipcMain.handle('get-shortcut', () => store.get('shortcut', DEFAULT_SHORTCUT));
ipcMain.handle('set-shortcut', (_, accelerator) => {
  if (!accelerator || typeof accelerator !== 'string') return false;
  const ok = registerShortcut(accelerator);
  if (ok) store.set('shortcut', accelerator);
  return ok;
});
