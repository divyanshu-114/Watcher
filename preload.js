// Preload: the only bridge between the renderer and the main process.
// Exposes a small, explicit API instead of giving the page access to Node.
const { contextBridge, ipcRenderer } = require('electron');

const listen = channel => callback => {
  const handler = (_event, ...args) => callback(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

const deskApi = {
  platform: process.platform,

  // Storage
  load: () => ipcRenderer.invoke('data:load'),
  save: data => ipcRenderer.invoke('data:save', data),
  exportFile: (content, format) => ipcRenderer.invoke('data:export', { content, format }),
  importFile: () => ipcRenderer.invoke('data:import'),

  // Native UI
  confirm: options => ipcRenderer.invoke('confirm', options),
  notify: payload => ipcRenderer.send('notify', payload),
  updateStatus: state => ipcRenderer.send('status:update', state),

  // Commands sent from the menu, tray, notifications and global shortcut
  onView: listen('menu:view'),
  onNewTask: listen('menu:new-task'),
  onPalette: listen('menu:palette'),
  onImport: listen('menu:import'),
  onExport: listen('menu:export'),
  onSettings: listen('menu:settings'),
  onFocus: listen('menu:focus'),
  onShortcuts: listen('menu:shortcuts'),
  onOpenTask: listen('task:open')
};

contextBridge.exposeInMainWorld('desk', deskApi);
contextBridge.exposeInMainWorld('watcher', deskApi);
