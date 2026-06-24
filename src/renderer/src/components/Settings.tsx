'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from '@phosphor-icons/react'

import DefaultIcon from '../assets/icons/Default.png'
import DarkIcon from '../assets/icons/Dark.png'
import ClearLightIcon from '../assets/icons/ClearLight.png'
import ClearDarkIcon from '../assets/icons/ClearDark.png'
import TintedLightIcon from '../assets/icons/TintedLight.png'
import TintedDarkIcon from '../assets/icons/TintedDark.png'

const ICON_OPTIONS: { key: string; label: string; src: string }[] = [
  { key: 'Default',     label: 'Default',      src: DefaultIcon },
  { key: 'Dark',        label: 'Dark',          src: DarkIcon },
  { key: 'ClearLight',  label: 'Clear Light',   src: ClearLightIcon },
  { key: 'ClearDark',   label: 'Clear Dark',    src: ClearDarkIcon },
  { key: 'TintedLight', label: 'Tinted Light',  src: TintedLightIcon },
  { key: 'TintedDark',  label: 'Tinted Dark',   src: TintedDarkIcon },
]

interface SettingsProps {
  open: boolean
  onClose: () => void
  isDark: boolean
  onToggleDark: (value: boolean) => void
}

export const Settings = memo(function Settings({ open, onClose, isDark, onToggleDark }: SettingsProps) {
  const [currentIcon, setCurrentIcon] = useState<string>('Default')
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    window.fontDrop.icon.getState().then((s) => setCurrentIcon(s.current))
  }, [open])

  const handleSelect = useCallback(async (key: string) => {
    if (key === currentIcon || applying) return
    setApplying(key)
    await window.fontDrop.icon.set(key)
    setCurrentIcon(key)
    setApplying(null)
  }, [currentIcon, applying])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div
              className="pointer-events-auto border-2 rounded-2xl w-[480px] max-w-[90vw] p-6"
              style={{
                backgroundColor: 'var(--fd-bg)',
                borderColor: 'var(--fd-text)',
                boxShadow: '6px 6px 0 var(--fd-text)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--fd-text)' }}>
                  Settings
                </h2>
                <button
                  onClick={onClose}
                  className="w-6 h-6 flex items-center justify-center rounded transition-all duration-150"
                  style={{ color: 'var(--fd-text-muted)' }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--fd-text)'
                    ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--fd-gray-hover)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--fd-text-muted)'
                    ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  }}
                >
                  <X size={13} weight="bold" />
                </button>
              </div>

              {/* ── Dark mode toggle ────────────────────────────────────── */}
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] mb-3" style={{ color: 'var(--fd-text-muted)' }}>
                Appearance
              </p>

              <div
                className="flex items-center justify-between rounded-xl px-4 py-3 mb-5 border"
                style={{ backgroundColor: 'var(--fd-surface)', borderColor: 'var(--fd-border-subtle)' }}
              >
                <div>
                  <p className="text-[12px] font-bold" style={{ color: 'var(--fd-text)' }}>Dark mode</p>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--fd-text-muted)' }}>
                    {isDark ? 'On' : 'Off'}
                  </p>
                </div>
                {/* Toggle switch */}
                <button
                  onClick={() => onToggleDark(!isDark)}
                  className="relative w-11 h-6 rounded-full border-2 transition-colors duration-200 focus:outline-none"
                  style={{
                    backgroundColor: isDark ? 'var(--fd-text)' : 'var(--fd-track)',
                    borderColor: 'var(--fd-text)',
                  }}
                  aria-label="Toggle dark mode"
                >
                  <motion.div
                    animate={{ x: isDark ? 19 : 1 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-0.5 w-4 h-4 rounded-full"
                    style={{ backgroundColor: isDark ? 'var(--fd-bg)' : 'var(--fd-text)' }}
                  />
                </button>
              </div>

              {/* ── App icon ───────────────────────────────────────────── */}
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] mb-3" style={{ color: 'var(--fd-text-muted)' }}>
                App Icon
              </p>

              <div className="grid grid-cols-3 gap-3">
                {ICON_OPTIONS.map(({ key, label, src }) => {
                  const isActive = currentIcon === key
                  const isApplying = applying === key
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelect(key)}
                      disabled={applying !== null}
                      className="relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150 select-none"
                      style={{
                        borderColor: isActive ? 'var(--fd-text)' : 'transparent',
                        backgroundColor: isActive ? 'var(--fd-surface)' : 'var(--fd-surface-2)',
                        boxShadow: isActive ? '3px 3px 0 var(--fd-text)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--fd-text)'
                          ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--fd-surface)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
                          ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--fd-surface-2)'
                        }
                      }}
                    >
                      <img
                        src={src}
                        alt={label}
                        className={`w-16 h-16 rounded-xl transition-opacity duration-150 ${isApplying ? 'opacity-60' : 'opacity-100'}`}
                        draggable={false}
                      />
                      <span
                        className="text-[10px] font-mono"
                        style={{
                          fontWeight: isActive ? 700 : 400,
                          color: isActive ? 'var(--fd-text)' : 'var(--fd-text-muted)',
                        }}
                      >
                        {label}
                      </span>
                      {isActive && (
                        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#14C245]" />
                      )}
                    </button>
                  )
                })}
              </div>

              <p className="text-[10px] font-mono mt-4" style={{ color: 'var(--fd-text-muted)' }}>
                Changes apply immediately to the Dock icon.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
})
