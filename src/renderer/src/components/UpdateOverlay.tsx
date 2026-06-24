'use client'

import { memo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowCircleUp, CheckCircle } from '@phosphor-icons/react'

interface UpdateOverlayProps {
  percent: number | null
  version: string | null
  installing: boolean
}

export const UpdateOverlay = memo(function UpdateOverlay({
  percent,
  version,
  installing,
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
            <div className="pointer-events-auto bg-[#ECEAE4] border-2 border-[#1A1A1A] rounded-2xl shadow-[6px_6px_0_#1A1A1A] w-[360px] max-w-[90vw] p-6">
              {/* Icon + title */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1A1A1A]">
                  {installing ? (
                    <CheckCircle size={18} weight="fill" className="text-[#00C853]" />
                  ) : (
                    <ArrowCircleUp size={18} weight="fill" className="text-white" />
                  )}
                </div>
                <div>
                  <p className="text-[13px] font-bold tracking-tight text-[#1A1A1A]">
                    {installing ? 'Installing update…' : 'Downloading update'}
                  </p>
                  {version && (
                    <p className="text-[11px] font-mono text-gray-500 mt-0.5">
                      v{version}
                    </p>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-[#D6D3CC] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#1A1A1A] rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${percent ?? 0}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>

              {/* Percent / status */}
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] font-mono text-gray-400">
                  {installing ? 'Restarting app…' : 'fontdrop will restart automatically'}
                </p>
                <p className="text-[11px] font-mono font-bold text-[#1A1A1A]">
                  {percent ?? 0}%
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
})
