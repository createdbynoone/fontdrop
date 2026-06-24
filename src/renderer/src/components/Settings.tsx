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
}

export const Settings = memo(function Settings({ open, onClose }: SettingsProps) {
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
              className="pointer-events-auto bg-[#ECEAE4] border-2 border-[#1A1A1A] rounded-2xl shadow-[6px_6px_0_#1A1A1A] w-[480px] max-w-[90vw] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[13px] font-bold tracking-tight text-[#1A1A1A]">
                  Settings
                </h2>
                <button
                  onClick={onClose}
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-black hover:bg-gray-200 transition-all duration-150"
                >
                  <X size={13} weight="bold" />
                </button>
              </div>

              {/* Section */}
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#888] mb-3">
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
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150 select-none ${
                        isActive
                          ? 'border-[#1A1A1A] bg-white shadow-[3px_3px_0_#1A1A1A]'
                          : 'border-transparent bg-white/50 hover:border-[#1A1A1A] hover:bg-white'
                      }`}
                    >
                      <img
                        src={src}
                        alt={label}
                        className={`w-16 h-16 rounded-xl transition-opacity duration-150 ${isApplying ? 'opacity-60' : 'opacity-100'}`}
                        draggable={false}
                      />
                      <span className={`text-[10px] font-mono ${isActive ? 'font-bold text-[#1A1A1A]' : 'text-gray-500'}`}>
                        {label}
                      </span>
                      {isActive && (
                        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#00C853]" />
                      )}
                    </button>
                  )
                })}
              </div>

              <p className="text-[10px] font-mono text-gray-400 mt-4">
                Changes apply immediately to the Dock icon.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
})
