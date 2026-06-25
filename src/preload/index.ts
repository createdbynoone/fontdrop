import { contextBridge, ipcRenderer } from 'electron'

const fontDropAPI = {
  parseFonts: (paths: string[]) => ipcRenderer.invoke('fonts:parse', paths),
  installFonts: (paths: string[]) => ipcRenderer.invoke('fonts:install', paths),
  checkInstalled: (fileName: string) => ipcRenderer.invoke('fonts:check', fileName),
  icon: {
    getState: () => ipcRenderer.invoke('icon:getState'),
    set: (key: string) => ipcRenderer.invoke('icon:set', key),
  },
  setBackground: (isDark: boolean) => ipcRenderer.invoke('theme:setBackground', isDark),
  restartToUpdate: () => ipcRenderer.invoke('update:restart'),
  update: {
    onProgress: (cb: (data: { percent: number; version: string | null; installing: boolean }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { percent: number; version: string | null; installing: boolean }) => cb(data)
      ipcRenderer.on('update:progress', handler)
      return () => ipcRenderer.removeListener('update:progress', handler)
    },
  },
}

contextBridge.exposeInMainWorld('fontDrop', fontDropAPI)
