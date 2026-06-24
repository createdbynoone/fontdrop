'use client'

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { motion } from 'motion/react'
import { CheckCircle, X, DownloadSimple, Warning } from '@phosphor-icons/react'
import { FontFamily, ParsedFont, FontAxis, FontInstance } from '../types'
import { WeightSlider } from './WeightSlider'

// Blob URLs are cheap to dereference and keep style tags tiny (vs. MB-sized base64 strings)
const blobUrlCache = new Map<string, string>()

function getOrCreateBlobUrl(font: ParsedFont): string {
  if (blobUrlCache.has(font.id)) return blobUrlCache.get(font.id)!
  const comma = font.dataUrl.indexOf(',')
  const mime = font.dataUrl.slice(5, font.dataUrl.indexOf(';'))
  const binary = atob(font.dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
  blobUrlCache.set(font.id, url)
  return url
}

interface FontCardProps {
  family: FontFamily
  onInstall: (family: FontFamily) => void
  onRemove: (familyId: string) => void
}

function formatSize(bytes: number): string {
  return bytes < 1_048_576
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1_048_576).toFixed(1)} MB`
}

const WEIGHT_SHORT: Record<number, string> = {
  100: 'Thin', 200: 'XLt', 300: 'Lt', 400: 'Rg', 500: 'Md',
  600: 'SBd', 700: 'Bd', 800: 'XBd', 900: 'Blk',
}

const WIDTH_RE = /condense|expand|compress|narrow|wide|extended|oblique|italic/i

function styleLabel(font: ParsedFont, familyName: string): string {
  if (font.postScriptName) {
    const idx = font.postScriptName.indexOf('-')
    if (idx !== -1) {
      const s = font.postScriptName.slice(idx + 1).trim()
      if (s) return s
    }
  }
  if (font.subFamily && font.subFamily !== 'Regular') return font.subFamily
  const base = font.fileName.replace(/\.[^.]+$/, '')
  const key = familyName.replace(/\s+/g, '')
  const stripped = base.replace(new RegExp(`^${key}[-_]?`, 'i'), '')
  if (stripped && stripped !== base) return stripped
  return font.subFamily || 'Regular'
}

function widthTag(label: string): string {
  const m = label.match(/ultracondensed|semicondensed|condensed|extraexpanded|semiexpanded|expanded|extended|compressed|narrow|wide/i)
  if (!m) return ''
  const map: Record<string, string> = {
    ultracondensed: 'UltraCond', semicondensed: 'SemiCond', condensed: 'Cond',
    compressed: 'Cond', narrow: 'Narrow',
    semiexpanded: 'SemiExp', extraexpanded: 'XExp', expanded: 'Exp',
    extended: 'Ext', wide: 'Wide',
  }
  return map[m[0].toLowerCase()] || m[0]
}

export const FontCard = memo(function FontCard({ family, onInstall, onRemove }: FontCardProps) {
  // Pick the default active font (prefer 400 weight, no width variant)
  const defaultFont =
    family.fonts.find((f) => f.weight === 400 && !WIDTH_RE.test(styleLabel(f, family.name))) ||
    family.fonts.find((f) => f.weight === 400) ||
    family.fonts[0]

  const [activeFont, setActiveFont] = useState<ParsedFont>(defaultFont)

  // ── Axis setup ───────────────────────────────────────────────────────────
  const variableWghtAxis = activeFont.axes.find((a) => a.tag === 'wght')

  const uniqueWeights = useMemo(
    () => [...new Set(family.fonts.map((f) => f.weight))].sort((a, b) => a - b),
    [family.fonts]
  )

  const syntheticAxis: FontAxis | undefined = useMemo(
    () =>
      !family.isVariable && uniqueWeights.length > 1
        ? {
            tag: 'wght',
            name: 'Weight',
            min: uniqueWeights[0],
            default: activeFont.weight || 400,
            max: uniqueWeights[uniqueWeights.length - 1],
          }
        : undefined,
    [family.isVariable, uniqueWeights, activeFont.weight]
  )

  const effectiveAxis = family.isVariable ? variableWghtAxis : syntheticAxis

  const effectiveInstances: FontInstance[] = useMemo(
    () =>
      family.isVariable
        ? activeFont.instances
        : uniqueWeights.map((w) => ({
            name: WEIGHT_SHORT[w] || String(w),
            coordinates: { wght: w },
          })),
    [family.isVariable, activeFont.instances, uniqueWeights]
  )

  const [sliderWeight, setSliderWeight] = useState(
    variableWghtAxis?.default ?? activeFont.weight ?? 400
  )

  // ── @font-face injection — unique ID per active font ─────────────────────
  const styleElRef = useRef<HTMLStyleElement | null>(null)
  const cssFamilyId = `fd-${activeFont.id.replace(/-/g, '').slice(0, 16)}`

  useEffect(() => {
    const blobUrl = getOrCreateBlobUrl(activeFont)
    styleElRef.current?.remove()
    const style = document.createElement('style')
    style.setAttribute('data-fontdrop-id', cssFamilyId)
    style.textContent = family.isVariable
      ? `@font-face { font-family: '${cssFamilyId}'; src: url('${blobUrl}'); font-weight: 1 999; font-style: normal; }`
      : `@font-face { font-family: '${cssFamilyId}'; src: url('${blobUrl}'); font-weight: ${activeFont.weight || 400}; font-style: normal; }`
    document.head.appendChild(style)
    styleElRef.current = style
    return () => { style.remove() }
  }, [cssFamilyId, activeFont.id, family.isVariable])

  // Revoke all blob URLs for this family when the card is removed
  useEffect(() => {
    return () => {
      for (const font of family.fonts) {
        const url = blobUrlCache.get(font.id)
        if (url) {
          URL.revokeObjectURL(url)
          blobUrlCache.delete(font.id)
        }
      }
    }
  }, [])

  // Sync slider when active font changes (for non-variable)
  useEffect(() => {
    setSliderWeight(family.isVariable ? (variableWghtAxis?.default ?? 400) : (activeFont.weight || 400))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFont.id])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSliderChange = useCallback((val: number) => {
    if (family.isVariable) {
      setSliderWeight(val)
      return
    }
    // Snap to nearest available weight among fonts that share the same width as active
    const activeLabel = styleLabel(activeFont, family.name)
    const activeWidth = widthTag(activeLabel)

    // First, find candidates that match current width
    const nearestWeight = uniqueWeights.reduce((prev, curr) =>
      Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
    )
    const atWeight = family.fonts.filter((f) => f.weight === nearestWeight)
    // Prefer same-width variant, else pick one without width suffix (normal)
    const next =
      atWeight.find((f) => widthTag(styleLabel(f, family.name)) === activeWidth) ||
      atWeight.find((f) => !WIDTH_RE.test(styleLabel(f, family.name))) ||
      atWeight[0]

    setActiveFont(next)
    setSliderWeight(nearestWeight)
  }, [family.isVariable, family.name, family.fonts, uniqueWeights, activeFont])

  const previewStyle: React.CSSProperties = useMemo(() => ({
    fontFamily: `'${cssFamilyId}', sans-serif`,
    fontWeight: family.isVariable ? sliderWeight : (activeFont.weight || 400),
  }), [cssFamilyId, family.isVariable, sliderWeight, activeFont.weight])

  const installed = family.installStatus === 'installed'
  const installing = family.installStatus === 'installing'
  const hasError = family.installStatus === 'error'
  const accentColor = installed ? '#00C853' : hasError ? '#FF3D00' : '#1A1A1A'
  const totalSize = useMemo(() => family.fonts.reduce((s, f) => s + f.fileSize, 0), [family.fonts])

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="group relative bg-white rounded-xl border-2 p-5 flex flex-col gap-3.5"
      style={{
        borderColor: accentColor,
        boxShadow: `3px 3px 0 ${accentColor}`,
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
    >
      {/* Remove */}
      <button
        onClick={() => onRemove(family.id)}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-gray-300 hover:text-black hover:bg-gray-100 transition-all duration-150"
      >
        <X size={12} weight="bold" />
      </button>

      {/* Badges */}
      <div className="flex gap-1.5 flex-wrap pr-7">
        {family.isVariable && (
          <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-black text-white rounded-sm">
            Variable
          </span>
        )}
        {!family.isVariable && family.fonts.length > 1 && (
          <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-black text-white rounded-sm">
            {family.fonts.length} styles
          </span>
        )}
        <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border border-gray-200 text-gray-400 rounded-sm">
          {activeFont.format.toUpperCase()}
        </span>
        {installed && (
          <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-[#00C853] text-white rounded-sm flex items-center gap-1">
            <CheckCircle size={8} weight="fill" /> Installed
          </span>
        )}
        {hasError && (
          <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-[#FF3D00] text-white rounded-sm flex items-center gap-1">
            <Warning size={8} weight="fill" /> Error
          </span>
        )}
      </div>

      {/* Preview */}
      <div className="py-1 min-h-[80px] overflow-hidden">
        <p className="text-4xl leading-tight truncate text-gray-900" style={previewStyle} title={family.name}>
          {family.name}
        </p>
        <p className="text-sm text-gray-400 mt-1.5 truncate" style={previewStyle}>
          Aa Bb Cc 0 1 2 3 !?&amp;
        </p>
      </div>

      {/* Weight slider — variable OR multi-file */}
      {effectiveAxis && (
        <WeightSlider
          axis={effectiveAxis}
          instances={effectiveInstances}
          value={sliderWeight}
          onChange={handleSliderChange}
        />
      )}

      {/* Metadata row */}
      <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 -mb-1">
        <span className="truncate">
          {activeFont.subFamily && activeFont.subFamily !== 'Regular'
            ? `${activeFont.familyName} ${activeFont.subFamily}`
            : activeFont.familyName}
        </span>
        <span className="shrink-0 ml-2">{formatSize(totalSize)}</span>
      </div>

      {/* Install button */}
      <button
        onClick={() => !installed && !installing && onInstall(family)}
        disabled={installing || installed}
        className={`w-full py-2.5 rounded-lg font-bold text-sm border-2 flex items-center justify-center gap-2 transition-all duration-150 select-none ${
          installed
            ? 'bg-[#00C853] text-white border-[#00C853] cursor-default'
            : hasError
            ? 'bg-[#FF3D00] text-white border-[#FF3D00] cursor-pointer hover:-translate-y-px'
            : installing
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait'
            : 'bg-[#1A1A1A] text-white border-[#1A1A1A] cursor-pointer hover:-translate-y-px active:translate-y-px'
        }`}
        style={!installed && !installing && !hasError ? { boxShadow: '2px 2px 0 #1A1A1A' } : undefined}
      >
        {installed ? (
          <><CheckCircle size={15} weight="fill" /> Installed</>
        ) : installing ? (
          <><span className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" /> Installing...</>
        ) : hasError ? (
          <><Warning size={15} weight="fill" /> Retry install</>
        ) : (
          <><DownloadSimple size={15} weight="bold" />
            {family.fonts.length > 1 ? `Install ${family.fonts.length} fonts` : 'Install font'}
          </>
        )}
      </button>
    </motion.div>
  )
})
