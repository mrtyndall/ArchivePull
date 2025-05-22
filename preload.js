const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  startDownload: (options) => ipcRenderer.invoke('start-download', options),
  getVideoInfo: (url) => ipcRenderer.invoke('get-video-info', url),
  onProgressUpdate: (callback) => {
    ipcRenderer.on('progress-update', (event, value) => callback(value));
  },
  onLogUpdate: (callback) => {
    ipcRenderer.on('log-update', (event, line) => callback(line));
  }
}); 