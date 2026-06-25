import { app, BrowserWindow, ipcMain, nativeImage, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { execFileSync } from 'child_process'

const ALLOWED_FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.woff', '.woff2', '.dfont'])

function isValidFontPath(fp: unknown): fp is string {
  if (typeof fp !== 'string' || fp.length === 0 || fp.length > 4096) return false
  const ext = path.extname(fp).toLowerCase()
  return ALLOWED_FONT_EXTENSIONS.has(ext)
}

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

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: blob: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 600,
    minWidth: 620,
    minHeight: 460,
    show: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#ECEAE4',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
    },
  })

  // Inject CSP on every response (works for both file:// and http:// in dev)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP],
      },
    })
  })

  // Block all navigation away from the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const localUrl = is.dev
      ? process.env['ELECTRON_RENDERER_URL'] ?? ''
      : `file://${join(__dirname, '../renderer/index.html')}`
    if (!url.startsWith(localUrl)) event.preventDefault()
  })

  // Block all popup/new-window creation
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // Devtools only in dev mode — never exposed in production
  if (!is.dev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow!.webContents.closeDevTools()
    })
  }

  mainWindow.setWindowButtonVisibility(false)

  mainWindow.on('ready-to-show', () => mainWindow!.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Prevent any remote content from creating additional BrowserWindows
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!/^(file:|http:\/\/localhost)/.test(url)) event.preventDefault()
  })
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.fontdrop.app')

  // Enforce CSP for all sessions (covers any additional webContents)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP],
        'X-Content-Type-Options': ['nosniff'],
      },
    })
  })

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

  ipcMain.handle('fonts:parse', async (_event, filePaths: unknown) => {
    if (!Array.isArray(filePaths)) return { fonts: [], errors: ['Invalid input'] }

    const validPaths = filePaths.filter(isValidFontPath)
    const results = await Promise.allSettled(validPaths.map((fp) => parseFontFile(fp)))

    const fonts: ParsedFont[] = []
    const errors: string[] = []

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === 'fulfilled') {
        fonts.push(r.value)
      } else {
        errors.push(`${path.basename(validPaths[i])}: ${(r.reason as Error).message}`)
      }
    }

    return { fonts, errors }
  })

  ipcMain.handle('fonts:install', async (_event, filePaths: unknown) => {
    if (!Array.isArray(filePaths)) return { success: false, errors: ['Invalid input'] }

    const errors: string[] = []
    await fs.promises.mkdir(FONTS_DIR, { recursive: true })

    await Promise.all(
      filePaths.filter(isValidFontPath).map(async (filePath) => {
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

  ipcMain.handle('update:restart', () => app.quit())

  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:fullscreen', () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()))

  ipcMain.handle('theme:setBackground', (_event, isDark: unknown) => {
    if (typeof isDark !== 'boolean') return
    mainWindow?.setBackgroundColor(isDark ? '#1C1B18' : '#ECEAE4')
  })

  ipcMain.handle('fonts:check', async (_event, fileName: unknown) => {
    if (typeof fileName !== 'string') return false
    const ext = path.extname(fileName).toLowerCase()
    if (!ALLOWED_FONT_EXTENSIONS.has(ext)) return false
    try {
      const safeName = path.basename(fileName)
      await fs.promises.access(path.join(FONTS_DIR, safeName))
      return true
    } catch {
      return false
    }
  })

  createWindow()

  // ── Auto-updater (production only) ────────────────────────────────────────
  // Must run after createWindow() so mainWindow is valid when events fire.
  // We delay checkForUpdates() until the renderer finishes loading so IPC
  // messages are never dropped into an unready webContents.
  if (!is.dev) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false

    // Write logs to ~/Library/Logs/fontdrop/updater.log
    const logFile = path.join(app.getPath('logs'), 'updater.log')
    const logStream = fs.createWriteStream(logFile, { flags: 'a' })
    const logLine = (msg: string) => logStream.write(`[${new Date().toISOString()}] ${msg}\n`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autoUpdater.logger = {
      info:  (msg: unknown) => logLine(`INFO  ${msg}`),
      warn:  (msg: unknown) => logLine(`WARN  ${msg}`),
      error: (msg: unknown) => logLine(`ERROR ${msg}`),
      debug: (msg: unknown) => logLine(`DEBUG ${msg}`),
    } as any

    let pendingVersion: string | null = null

    autoUpdater.on('checking-for-update', () => logLine('Checking for update…'))
    autoUpdater.on('update-not-available', () => logLine('No update available'))
    autoUpdater.on('error', (err) => logLine(`Error: ${err?.message ?? err}`))

    autoUpdater.on('update-available', (info) => {
      pendingVersion = info.version
      logLine(`Update available: ${info.version}`)
    })

    autoUpdater.on('download-progress', (progress) => {
      mainWindow?.webContents.send('update:progress', {
        percent: Math.round(progress.percent),
        version: pendingVersion,
        installing: false,
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      const downloadedZip = (info as unknown as { downloadedFile?: string }).downloadedFile
      logLine(`Update downloaded: ${downloadedZip ?? 'path unknown'}`)

      if (process.platform === 'darwin' && downloadedZip) {
        const appBundle = app.getPath('exe').split('/Contents/')[0]
        const extractDir = path.join(os.tmpdir(), 'fontdrop-update-extract')

        // Write installer script now; it runs when user clicks "Restart to update"
        // which triggers app.quit() via update:restart IPC.
        const script = [
          '#!/bin/bash',
          'sleep 4',
          `rm -rf "${extractDir}"`,
          `mkdir -p "${extractDir}"`,
          `unzip -q "${downloadedZip}" -d "${extractDir}"`,
          `NEW_APP=$(find "${extractDir}" -maxdepth 1 -name "*.app" | head -1)`,
          '[ -z "$NEW_APP" ] && exit 1',
          `xattr -rd com.apple.quarantine "$NEW_APP" 2>/dev/null || true`,
          `rm -rf "${appBundle}"`,
          `cp -r "$NEW_APP" "${appBundle}"`,
          `open "${appBundle}"`,
        ].join('\n')

        const scriptPath = path.join(os.tmpdir(), 'fontdrop-install.sh')
        fs.writeFileSync(scriptPath, script, { mode: 0o755 })

        app.on('before-quit', () => {
          const child = require('child_process').spawn('/bin/bash', [scriptPath], {
            detached: true, stdio: 'ignore',
          })
          child.unref()
        })
      }

      // Signal the renderer: download complete, show "Restart to update" button
      mainWindow?.webContents.send('update:progress', {
        percent: 100, version: pendingVersion, installing: true,
      })
    })

    mainWindow!.webContents.once('did-finish-load', () => {
      logLine(`App version: ${app.getVersion()} — calling checkForUpdates`)
      autoUpdater.checkForUpdates().catch((err) => logLine(`checkForUpdates failed: ${err?.message ?? err}`))
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
