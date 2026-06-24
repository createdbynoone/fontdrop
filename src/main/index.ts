import { app, BrowserWindow, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

let mainWindow: BrowserWindow | null = null

// ── App icon preferences ─────────────────────────────────────────────────────
const ICON_KEYS = ['Default', 'Dark', 'ClearLight', 'ClearDark', 'TintedLight', 'TintedDark'] as const
type IconKey = typeof ICON_KEYS[number]

const PREFS_PATH = path.join(app.getPath('userData'), 'preferences.json')

let _prefsCache: { appIcon: IconKey } | null = null

function loadPrefs(): { appIcon: IconKey } {
  if (_prefsCache) return _prefsCache
  try {
    const raw = fs.readFileSync(PREFS_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    const icon = ICON_KEYS.includes(parsed.appIcon) ? parsed.appIcon : 'Default'
    _prefsCache = { appIcon: icon }
  } catch {
    _prefsCache = { appIcon: 'Default' }
  }
  return _prefsCache!
}

function savePrefs(prefs: { appIcon: IconKey }): void {
  _prefsCache = prefs
  fs.writeFileSync(PREFS_PATH, JSON.stringify(prefs, null, 2))
}

function getIconPath(key: IconKey): string {
  if (is.dev) {
    return path.join(__dirname, '../../build/icons', `${key}.png`)
  }
  return path.join(process.resourcesPath, 'icons', `${key}.png`)
}

function applyDockIcon(key: IconKey): void {
  if (process.platform !== 'darwin') return
  try {
    const img = nativeImage.createFromPath(getIconPath(key))
    if (!img.isEmpty()) app.dock.setIcon(img)
  } catch { /* silently ignore if icon file missing */ }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const opentype = require('opentype.js')

const FONTS_DIR = path.join(os.homedir(), 'Library', 'Fonts')

const MIME_TYPES: Record<string, string> = {
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
}

// Maps subfamily names to CSS font-weight values
const SUBFAMILY_WEIGHT: Record<string, number> = {
  thin: 100, hairline: 100,
  extralight: 200, 'extra light': 200, ultralight: 200, 'ultra light': 200,
  light: 300,
  regular: 400, normal: 400, book: 400, roman: 400, text: 400,
  medium: 500,
  semibold: 600, 'semi bold': 600, demibold: 600, 'demi bold': 600,
  bold: 700,
  extrabold: 800, 'extra bold': 800, ultrabold: 800, 'ultra bold': 800,
  black: 900, heavy: 900, fat: 900,
}

function inferWeight(subFamilyName: string, os2Weight: number): number {
  if (os2Weight > 0 && os2Weight !== 400) return os2Weight
  // Attempt to infer from the subfamily string
  const normalized = subFamilyName.toLowerCase().replace(/\s+/g, ' ').trim()
  for (const [key, val] of Object.entries(SUBFAMILY_WEIGHT)) {
    if (normalized === key) return val
  }
  // Try partial match (e.g. "Light Condensed" → 300)
  for (const [key, val] of Object.entries(SUBFAMILY_WEIGHT)) {
    if (normalized.startsWith(key) || normalized.endsWith(key)) return val
  }
  return os2Weight || 400
}

interface ParsedFont {
  id: string
  path: string
  fileName: string
  familyName: string
  subFamily: string
  postScriptName: string
  weight: number
  isVariable: boolean
  axes: Array<{ tag: string; name: string; min: number; default: number; max: number }>
  instances: Array<{ name: string; coordinates: Record<string, number> }>
  dataUrl: string
  format: string
  fileSize: number
}

async function parseFontFile(filePath: string): Promise<ParsedFont> {
  const [fontBuffer, stat] = await Promise.all([
    fs.promises.readFile(filePath),
    fs.promises.stat(filePath),
  ])
  const arrayBuffer = fontBuffer.buffer.slice(
    fontBuffer.byteOffset,
    fontBuffer.byteOffset + fontBuffer.byteLength
  ) as ArrayBuffer
  const font = opentype.parse(arrayBuffer)
  const ext = path.extname(filePath).toLowerCase().replace('.', '')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const names = font.names as Record<string, any>

  // Prefer name ID 16 (Preferred Family) for proper family grouping
  const familyName =
    names.preferredFamily?.en ||
    names.fontFamily?.en ||
    path.basename(filePath, '.' + ext)

  // Prefer name ID 17 (Preferred Subfamily) — contains the full weight/style name
  const preferredSub = names.preferredSubfamily?.en
  const legacySub = names.fontSubfamily?.en || 'Regular'
  const subFamily = preferredSub || legacySub

  const postScriptName: string = names.postScriptName?.en || ''
  const fullName: string = names.fullName?.en || ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tables = font.tables as Record<string, any>
  const os2Weight: number = tables['OS/2']?.usWeightClass ?? 0

  const weight = inferWeight(subFamily, os2Weight)

  // Variable font detection via fvar table
  const fvar = tables['fvar']
  const isVariable = !!fvar

  const axes = (fvar?.axes ?? []).map((axis: {
    tag: string
    name?: { en?: string }
    minValue: number
    defaultValue: number
    maxValue: number
  }) => ({
    tag: axis.tag,
    name: axis.name?.en || axis.tag,
    min: axis.minValue,
    default: axis.defaultValue,
    max: axis.maxValue,
  }))

  const instances = (fvar?.instances ?? []).map((inst: {
    name?: { en?: string }
    coordinates?: Record<string, number>
  }) => ({
    name: inst.name?.en || '',
    coordinates: inst.coordinates || {},
  }))

  const mimeType = MIME_TYPES[ext] || 'font/ttf'
  const dataUrl = `data:${mimeType};base64,${fontBuffer.toString('base64')}`

  void fullName // parsed but intentionally not logged (no local paths in output)

  return {
    id: crypto.randomUUID(),
    path: filePath,
    fileName: path.basename(filePath),
    familyName,
    subFamily,
    postScriptName,
    weight,
    isVariable,
    axes,
    instances,
    dataUrl,
    format: ext,
    fileSize: stat.size,
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 600,
    minWidth: 620,
    minHeight: 460,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: '#ECEAE4',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  // Devtools only in dev mode — never exposed in production
  if (!is.dev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools()
    })
  }

  mainWindow.on('ready-to-show', () => mainWindow!.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.fontdrop.app')

  // Apply saved icon preference on launch
  const prefs = loadPrefs()
  applyDockIcon(prefs.appIcon)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('icon:getState', () => {
    const prefs = loadPrefs()
    return { current: prefs.appIcon, keys: ICON_KEYS }
  })

  ipcMain.handle('icon:set', (_event, key: IconKey) => {
    if (!ICON_KEYS.includes(key)) return { success: false }
    savePrefs({ appIcon: key })
    applyDockIcon(key)
    return { success: true }
  })

  ipcMain.handle('fonts:parse', async (_event, filePaths: string[]) => {
    const results = await Promise.allSettled(filePaths.map((fp) => parseFontFile(fp)))

    const fonts: ParsedFont[] = []
    const errors: string[] = []

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === 'fulfilled') {
        fonts.push(r.value)
      } else {
        errors.push(`${path.basename(filePaths[i])}: ${(r.reason as Error).message}`)
      }
    }

    return { fonts, errors }
  })

  ipcMain.handle('fonts:install', async (_event, filePaths: string[]) => {
    const errors: string[] = []

    await fs.promises.mkdir(FONTS_DIR, { recursive: true })

    await Promise.all(
      filePaths.map(async (filePath) => {
        try {
          const dest = path.join(FONTS_DIR, path.basename(filePath))
          await fs.promises.copyFile(filePath, dest)
        } catch (err) {
          errors.push(`${path.basename(filePath)}: ${(err as Error).message}`)
        }
      })
    )

    return { success: errors.length === 0, errors }
  })

  ipcMain.handle('fonts:check', async (_event, fileName: string) => {
    try {
      await fs.promises.access(path.join(FONTS_DIR, fileName))
      return true
    } catch {
      return false
    }
  })

  // ── Auto-updater (production only) ────────────────────────────────────────
  if (!is.dev) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = null // silence verbose logs

    autoUpdater.on('update-downloaded', () => {
      mainWindow?.webContents.send('update:ready')
    })

    autoUpdater.checkForUpdates().catch(() => {})
  }

  ipcMain.on('update:install', () => {
    autoUpdater.quitAndInstall()
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
