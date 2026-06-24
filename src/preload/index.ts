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
    onReady: (cb: () => void) => {
      ipcRenderer.on('update:ready', cb)
      return () => ipcRenderer.removeListener('update:ready', cb)
    },
    install: () => ipcRenderer.send('update:install'),
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
