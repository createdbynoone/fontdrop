'use client'

import { memo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowCircleUp, ArrowCounterClockwise } from '@phosphor-icons/react'

interface UpdateOverlayProps {
  percent: number | null
  version: string | null
  readyToRestart: boolean
}

export const UpdateOverlay = memo(function UpdateOverlay({
  percent,
  version,
  readyToRestart,
}: UpdateOverlayProps) {
  const visible = percent !== null

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            key="update-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40"
          />

          <motion.div
            key="update-panel"
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div
              className="pointer-events-auto border-2 rounded-2xl w-[360px] max-w-[90vw] p-6"
              style={{
                backgroundColor: 'var(--fd-bg)',
                borderColor: 'var(--fd-text)',
                boxShadow: '6px 6px 0 var(--fd-text)',
              }}
            >
              {/* Icon + title */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-9 h-9 flex items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'var(--fd-text)' }}
                >
                  <ArrowCircleUp size={18} weight="fill" style={{ color: 'var(--fd-bg)' }} />
                </div>
                <div>
                  <p className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--fd-text)' }}>
                    {readyToRestart ? 'Update ready' : 'Downloading update'}
                  </p>
                  {version && (
                    <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--fd-text-muted)' }}>
                      v{version}
                    </p>
                  )}
                </div>
              </div>

              {readyToRestart ? (
                /* Restart button */
                <button
                  onClick={() => window.fontDrop.restartToUpdate()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-[13px] font-bold tracking-tight transition-colors"
                  style={{
                    backgroundColor: 'var(--fd-text)',
                    borderColor: 'var(--fd-text)',
                    color: 'var(--fd-bg)',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget
                    el.style.backgroundColor = '#FF3D00'
                    el.style.borderColor = '#FF3D00'
                    el.style.color = '#fff'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget
                    el.style.backgroundColor = 'var(--fd-text)'
                    el.style.borderColor = 'var(--fd-text)'
                    el.style.color = 'var(--fd-bg)'
                  }}
                >
                  <ArrowCounterClockwise size={15} weight="bold" />
                  Restart to update
                </button>
              ) : (
                /* Progress bar + percent */
                <>
                  <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--fd-track)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: 'var(--fd-text)' }}
                      initial={{ width: '0%' }}
                      animate={{ width: `${percent ?? 0}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] font-mono" style={{ color: 'var(--fd-text-muted)' }}>
                      FontDrop will restart automatically
                    </p>
                    <p className="text-[11px] font-mono font-bold" style={{ color: 'var(--fd-text)' }}>
                      {percent ?? 0}%
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
})
