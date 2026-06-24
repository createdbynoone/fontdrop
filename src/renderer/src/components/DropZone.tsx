'use client'

import { useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { ArrowDown, Spinner } from '@phosphor-icons/react'

const ACCEPTED = /\.(ttf|otf|woff|woff2|dfont)$/i

interface DropZoneProps {
  onDrop: (paths: string[]) => void
  isProcessing: boolean
  compact?: boolean
}

export function DropZone({ onDrop, isProcessing, compact = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      const paths = files
        .filter((f) => ACCEPTED.test(f.name))
        .map((f) => (f as File & { path: string }).path)
        .filter(Boolean)

      if (paths.length > 0) onDrop(paths)
    },
    [onDrop]
  )

  if (compact) {
    return (
      <motion.div
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        animate={{
          borderColor: isDragging ? '#FF3D00' : '#1A1A1A',
          backgroundColor: isDragging ? '#FFF0ED' : '#FFFFFF',
        }}
        transition={{ duration: 0.12 }}
        className="w-full py-2.5 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 text-sm font-mono text-gray-500 cursor-default"
      >
        {isProcessing ? (
          <>
            <Spinner size={14} className="animate-spin" />
            <span>Reading fonts...</span>
          </>
        ) : (
          <>
            <span className="text-base leading-none">+</span>
            <span>{isDragging ? 'Release to add' : 'Drop more fonts'}</span>
          </>
        )}
      </motion.div>
    )
  }

  return (
    // Outer container: solid border, fills the space
    <motion.div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      animate={{
        borderColor: isDragging ? '#FF3D00' : '#1A1A1A',
        backgroundColor: isDragging ? '#FFF0ED' : 'transparent',
      }}
      transition={{ duration: 0.12 }}
      className="flex flex-col items-center justify-center h-full rounded-xl border-2 cursor-default select-none"
    >
      {/* Inner dashed box — wraps only the drop content */}
      <motion.div
        animate={{
          borderColor: isDragging ? '#FF3D00' : '#1A1A1A',
          boxShadow: isDragging ? '5px 5px 0 #FF3D00' : '5px 5px 0 #1A1A1A',
        }}
        transition={{ duration: 0.12 }}
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-16 py-12"
      >
        <motion.div
          animate={{ y: isDragging ? [-6, 0, -6] : 0 }}
          transition={{
            duration: 1.1,
            repeat: isDragging ? Infinity : 0,
            ease: 'easeInOut',
          }}
          className="mb-5"
        >
          {isProcessing ? (
            <Spinner size={36} weight="bold" className="animate-spin text-gray-400" />
          ) : (
            <ArrowDown
              size={36}
              weight="bold"
              style={{ color: isDragging ? '#FF3D00' : '#1A1A1A' }}
            />
          )}
        </motion.div>

        <p className="text-xl font-bold mb-1.5 tracking-tight">
          {isProcessing ? 'Reading font data...' : isDragging ? 'Release to load' : 'Drop fonts here'}
        </p>

        <p className="text-sm font-mono mb-5" style={{ color: isDragging ? '#FF3D00' : '#888' }}>
          {isProcessing ? 'Parsing font metadata' : 'TTF · OTF · WOFF · WOFF2'}
        </p>

        {!isProcessing && (
          <div className="flex gap-2">
            {['TTF', 'OTF', 'WOFF', 'WOFF2'].map((ext) => (
              <span
                key={ext}
                className="px-2 py-1 text-[10px] font-mono font-bold border rounded tracking-widest"
                style={{
                  borderColor: isDragging ? '#FF3D00' : '#C0BDB6',
                  color: isDragging ? '#FF3D00' : '#888',
                }}
              >
                {ext}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
