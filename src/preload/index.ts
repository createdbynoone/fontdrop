import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const fontDropAPI = {
  parseFonts: (paths: string[]) => ipcRenderer.invoke('fonts:parse', paths),
  installFonts: (paths: string[]) => ipcRenderer.invoke('fonts:install', paths),
  checkInstalled: (fileName: string) => ipcRenderer.invoke('fonts:check', fileName),
  icon: {
    getState: () => ipcRenderer.invoke('icon:getState'),
    set: (key: string) => ipcRenderer.invoke('icon:set', key),
  },
  update: {
    onProgress: (cb: (data: { percent: number; version: string | null; installing: boolean }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { percent: number; version: string | null; installing: boolean }) => cb(data)
      ipcRenderer.on('update:progress', handler)
      return () => ipcRenderer.removeListener('update:progress', handler)
    },
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('fontDrop', fontDropAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.fontDrop = fontDropAPI
}
