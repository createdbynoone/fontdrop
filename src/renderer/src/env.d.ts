/// <reference types="vite/client" />

import type { ParsedFont } from './types'

declare global {
  interface Window {
    fontDrop: {
      parseFonts: (paths: string[]) => Promise<{ fonts: ParsedFont[]; errors: string[] }>
      installFonts: (paths: string[]) => Promise<{ success: boolean; errors: string[] }>
      checkInstalled: (fileName: string) => Promise<boolean>
      icon: {
        getState: () => Promise<{ current: string; keys: readonly string[] }>
        set: (key: string) => Promise<{ success: boolean }>
      }
      setBackground: (isDark: boolean) => Promise<void>
      restartToUpdate: () => Promise<void>
      windowControls: {
        close: () => Promise<void>
        minimize: () => Promise<void>
        fullscreen: () => Promise<void>
      }
      update: {
        onProgress: (cb: (data: { percent: number; version: string | null; installing: boolean }) => void) => () => void
        onError: (cb: () => void) => () => void
        retry: () => Promise<void>
      }
    }
  }
}
