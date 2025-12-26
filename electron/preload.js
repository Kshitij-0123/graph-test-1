import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('graphAPI', {
  openGraph: () => ipcRenderer.invoke('graph:open'),
  saveGraph: (payload) => ipcRenderer.invoke('graph:save', payload),
  saveGraphAs: (payload) => ipcRenderer.invoke('graph:saveAs', payload),
  readNodeFile: (payload) => ipcRenderer.invoke('node:read', payload),
  writeNodeFile: (payload) => ipcRenderer.invoke('node:write', payload)
});
