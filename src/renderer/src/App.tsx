'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle, GearSix } from '@phosphor-icons/react'
import { DropZone } from './components/DropZone'
import { FontCard } from './components/FontCard'
import { Settings } from './components/Settings'
import { UpdateOverlay } from './components/UpdateOverlay'
import { FontFamily, ParsedFont } from './types'

function groupFontsByFamily(fonts: ParsedFont[]): FontFamily[] {
  const map = new Map<string, ParsedFont[]>()

  for (const font of fonts) {
    const key = font.familyName
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(font)
  }

  return Array.from(map.entries()).map(([name, familyFonts]) => {
    familyFonts.sort((a, b) => a.weight - b.weight)

    return {
      id: crypto.randomUUID(),
      name,
      fonts: familyFonts,
      isVariable: familyFonts.some((f) => f.isVariable),
      installStatus: 'idle' as const,
    }
  })
}

export default function App() {
  const [families, setFamilies] = useState<FontFamily[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [updatePercent, setUpdatePercent] = useState<number | null>(null)
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [updateInstalling, setUpdateInstalling] = useState(false)

  useEffect(() => window.fontDrop.update.onProgress(({ percent, version, installing }) => {
    setUpdatePercent(percent)
    setUpdateVersion(version)
    setUpdateInstalling(installing)
  }), [])

  const handleDrop = useCallback(async (paths: string[]) => {
    setIsProcessing(true)
    setParseErrors([])

    try {
      const result = await window.fontDrop.parseFonts(paths)

      if (result.errors?.length > 0) setParseErrors(result.errors)

      if (result.fonts.length > 0) {
        const incoming = groupFontsByFamily(result.fonts)

        // Check which fonts are already installed
        await Promise.all(
          incoming.map(async (fam) => {
            const checks = await Promise.all(
              fam.fonts.map((f) => window.fontDrop.checkInstalled(f.fileName))
            )
            if (checks.every(Boolean)) {
              fam.installStatus = 'installed'
            }
          })
        )

        setFamilies((prev) => {
          const existingMap = new Map(prev.map((f) => [f.name, f]))

          for (const fam of incoming) {
            if (!existingMap.has(fam.name)) {
              existingMap.set(fam.name, fam)
            } else {
              // Merge new font weights into the existing family
              const existing = existingMap.get(fam.name)!
              const existingFileNames = new Set(existing.fonts.map((f) => f.fileName))
              const newFonts = fam.fonts.filter((f) => !existingFileNames.has(f.fileName))
              const mergedFonts = [...existing.fonts, ...newFonts].sort(
                (a, b) => a.weight - b.weight
              )
              existingMap.set(fam.name, { ...existing, fonts: mergedFonts })
            }
          }

          return Array.from(existingMap.values())
        })
      }
    } catch (err) {
      setParseErrors([`Could not read fonts: ${(err as Error).message}`])
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleInstall = useCallback(async (family: FontFamily) => {
    setFamilies((prev) =>
      prev.map((f) => (f.id === family.id ? { ...f, installStatus: 'installing' } : f))
    )

    try {
      const paths = family.fonts.map((f) => f.path)
      const result = await window.fontDrop.installFonts(paths)

      setFamilies((prev) =>
        prev.map((f) =>
          f.id === family.id
            ? { ...f, installStatus: result.success ? 'installed' : 'error' }
            : f
        )
      )
    } catch {
      setFamilies((prev) =>
        prev.map((f) => (f.id === family.id ? { ...f, installStatus: 'error' } : f))
      )
    }
  }, [])

  const handleInstallAll = useCallback(async () => {
    const uninstalled = families.filter((f) => f.installStatus === 'idle' || f.installStatus === 'error')
    await Promise.all(uninstalled.map((fam) => handleInstall(fam)))
  }, [families, handleInstall])

  const handleRemove = useCallback((familyId: string) => {
    setFamilies((prev) => prev.filter((f) => f.id !== familyId))
  }, [])

  const handleClearAll = useCallback(() => {
    setFamilies([])
    setParseErrors([])
  }, [])

  const handleOpenSettings = useCallback(() => setSettingsOpen(true), [])
  const handleCloseSettings = useCallback(() => setSettingsOpen(false), [])

  const installedCount = useMemo(
    () => families.filter((f) => f.installStatus === 'installed').length,
    [families]
  )
  const pendingCount = useMemo(
    () => families.filter((f) => f.installStatus === 'idle' || f.installStatus === 'error').length,
    [families]
  )

  return (
    <div className="h-screen flex flex-col bg-[#ECEAE4] overflow-hidden">
      <Settings open={settingsOpen} onClose={handleCloseSettings} />
      <UpdateOverlay percent={updatePercent} version={updateVersion} installing={updateInstalling} />

      {/* Titlebar — entire bar is draggable; only interactive elements opt out */}
      <div
        className="h-10 flex-shrink-0 flex items-center pl-[80px] pr-3 gap-3"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span
          className="text-[13px] font-bold tracking-tight text-gray-900"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          fontdrop
        </span>

        {/* Spacer — stays draggable */}
        <div className="flex-1" />

        <div
          className="flex items-center gap-3"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {families.length > 0 && (
            <>
              {installedCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-[#00C853]">
                  <CheckCircle size={11} weight="fill" />
                  {installedCount} installed
                </span>
              )}
              {pendingCount > 0 && families.length > 1 && (
                <button
                  onClick={handleInstallAll}
                  className="text-[11px] font-mono font-bold px-2 py-0.5 bg-[#1A1A1A] text-white rounded hover:bg-[#FF3D00] transition-colors"
                >
                  Install all
                </button>
              )}
              <button
                onClick={handleClearAll}
                className="text-[11px] font-mono text-gray-400 hover:text-black transition-colors"
              >
                Clear
              </button>
            </>
          )}
          <button
            onClick={handleOpenSettings}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-black hover:bg-gray-200 transition-all duration-150"
            title="Settings"
          >
            <GearSix size={14} weight="bold" />
          </button>
        </div>
      </div>

      {/* Parse errors */}
      <AnimatePresence>
        {parseErrors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-2 px-3 py-2 bg-[#FFF0ED] border border-[#FF3D00] rounded-lg overflow-hidden"
          >
            {parseErrors.map((e, i) => (
              <p key={i} className="text-[11px] font-mono text-[#FF3D00]">
                {e}
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="flex-1 overflow-auto px-4 pb-4 min-h-0">
        <AnimatePresence mode="wait">
          {families.length === 0 ? (
            // Empty state - full-size drop zone
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="h-full"
            >
              <DropZone onDrop={handleDrop} isProcessing={isProcessing} />
            </motion.div>
          ) : (
            // Loaded state - compact drop zone + grid
            <motion.div
              key="loaded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pb-2"
            >
              {/* Compact drop zone to add more */}
              <div className="mb-4">
                <DropZone onDrop={handleDrop} isProcessing={isProcessing} compact />
              </div>

              {/* Font family cards - responsive bento grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                <AnimatePresence>
                  {families.map((family) => (
                    <FontCard
                      key={family.id}
                      family={family}
                      onInstall={handleInstall}
                      onRemove={handleRemove}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
