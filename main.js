// Main process: window, menu, tray, global shortcut, file storage and native integrations
const {
  app, BrowserWindow, Menu, Tray, Notification, dialog, ipcMain,
  globalShortcut, nativeImage, shell
} = require('electron');
const path = require('path');
const fs = require('fs');

const QUICK_ADD_SHORTCUT = 'CommandOrControl+Shift+D';
const isMac = process.platform === 'darwin';

let win = null;
let tray = null;
let trayState = { todayCount: 0, overdueCount: 0, upcoming: [], focusLabel: '' };

// ---------- Storage (JSON file in the user's app-data folder) ----------

const dataFile = () => path.join(app.getPath('userData'), 'deadline-desk.json');
const windowStateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Write to a temp file then rename, so a crash mid-write never corrupts the data
function writeJsonAtomic(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

// ---------- Window ----------

function createWindow() {
  const saved = readJson(windowStateFile()) || {};

  win = new BrowserWindow({
    width: saved.width || 1180,
    height: saved.height || 760,
    x: saved.x,
    y: saved.y,
    minWidth: 760,
    minHeight: 540,
    title: 'Deadline Desk',
    backgroundColor: '#17212e',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 18 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // keeps renderer isolated from Node (security best practice)
      nodeIntegration: false,
      sandbox: true
    }
  });

  // `npm run dev` serves the React app from Vite; otherwise load the built files
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(__dirname, 'build', 'index.html'));
  win.once('ready-to-show', () => win.show());

  // Remember size and position between launches
  win.on('close', () => {
    try { writeJsonAtomic(windowStateFile(), win.getBounds()); } catch { /* ignore */ }
  });
  win.on('closed', () => { win = null; });

  // Open external links in the default browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function showWindow() {
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// Send a command to the renderer (used by menu, tray and shortcut)
function send(channel, ...args) {
  showWindow();
  const deliver = () => win.webContents.send(channel, ...args);
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', deliver);
  else deliver();
}

// ---------- Menu ----------

function buildMenu() {
  const view = (label, name, key) => ({ label, accelerator: `CmdOrCtrl+${key}`, click: () => send('menu:view', name) });

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Task', accelerator: 'CmdOrCtrl+N', click: () => send('menu:new-task') },
        { label: 'Command Palette…', accelerator: 'CmdOrCtrl+K', click: () => send('menu:palette') },
        { type: 'separator' },
        { label: 'Import Tasks…', click: () => send('menu:import') },
        { label: 'Export as JSON…', accelerator: 'CmdOrCtrl+E', click: () => send('menu:export', 'json') },
        { label: 'Export as CSV…', click: () => send('menu:export', 'csv') },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => send('menu:settings') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        view('Today', 'today', '1'),
        view('Upcoming', 'upcoming', '2'),
        view('All Tasks', 'all', '3'),
        view('Completed', 'completed', '4'),
        view('Calendar', 'calendar', '5'),
        view('Insights', 'stats', '6'),
        { type: 'separator' },
        { label: 'Focus Timer', accelerator: 'CmdOrCtrl+Shift+F', click: () => send('menu:focus') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Keyboard Shortcuts', accelerator: 'CmdOrCtrl+/', click: () => send('menu:shortcuts') },
        { label: 'Show Data File', click: () => shell.showItemInFolder(dataFile()) }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- Tray ----------

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayTemplate.png'));
  icon.setTemplateImage(true);   // macOS adapts it to light/dark menu bars
  tray = new Tray(icon);
  tray.setToolTip('Deadline Desk');
  tray.on('click', () => { if (!isMac) showWindow(); });
  updateTray();
}

function updateTray() {
  if (!tray) return;
  const { todayCount, overdueCount, upcoming, focusLabel } = trayState;

  // Menu bar text on macOS: focus countdown wins, otherwise the open count for today
  if (isMac) tray.setTitle(focusLabel || (todayCount ? ` ${todayCount}` : ''));

  const items = [
    { label: overdueCount ? `${todayCount} due today · ${overdueCount} overdue` : `${todayCount} due today`, enabled: false },
    { type: 'separator' },
    ...(upcoming.length
      ? upcoming.map(t => ({ label: `${t.title}  —  ${t.when}`, click: () => send('task:open', t.id) }))
      : [{ label: 'Nothing coming up', enabled: false }]),
    { type: 'separator' },
    { label: 'Quick Add…', accelerator: QUICK_ADD_SHORTCUT, click: () => send('menu:new-task') },
    { label: 'Start Focus Session', click: () => send('menu:focus') },
    { label: 'Open Deadline Desk', click: showWindow },
    { type: 'separator' },
    { role: 'quit' }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

// ---------- IPC handlers (called from preload.js) ----------

function registerIpc() {
  ipcMain.handle('data:load', () => readJson(dataFile()));

  ipcMain.handle('data:save', (_e, data) => {
    writeJsonAtomic(dataFile(), data);
    return true;
  });

  ipcMain.handle('data:export', async (_e, { content, format }) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Export tasks',
      defaultPath: `deadline-desk-${stamp}.${format}`,
      filters: [format === 'csv'
        ? { name: 'CSV spreadsheet', extensions: ['csv'] }
        : { name: 'JSON backup', extensions: ['json'] }]
    });
    if (canceled || !filePath) return null;
    fs.writeFileSync(filePath, content);
    return filePath;
  });

  ipcMain.handle('data:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Import tasks',
      properties: ['openFile'],
      filters: [{ name: 'Deadline Desk backup', extensions: ['json'] }]
    });
    if (canceled || !filePaths.length) return null;
    return readJson(filePaths[0]);
  });

  ipcMain.handle('confirm', async (_e, { message, detail, okLabel }) => {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: [okLabel || 'OK', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message,
      detail
    });
    return response === 0;
  });

  ipcMain.on('notify', (_e, { title, body, taskId }) => {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title, body, silent: false });
    n.on('click', () => (taskId ? send('task:open', taskId) : showWindow()));
    n.show();
  });

  ipcMain.on('status:update', (_e, state) => {
    trayState = { ...trayState, ...state };
    const badge = trayState.todayCount + trayState.overdueCount;
    if (isMac || process.platform === 'linux') app.setBadgeCount(badge);
    updateTray();
  });
}

// ---------- App lifecycle ----------

// Only one copy of the app may run; a second launch focuses the first
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    if (isMac) app.dock.setIcon(path.join(__dirname, 'assets', 'icon.png'));
    registerIpc();
    buildMenu();
    createWindow();
    createTray();

    // System-wide shortcut: works even when the app is in the background
    globalShortcut.register(QUICK_ADD_SHORTCUT, () => send('menu:new-task'));

    // macOS: re-open a window when dock icon is clicked
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('will-quit', () => globalShortcut.unregisterAll());

  // Quit when all windows are closed (except on macOS)
  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}
