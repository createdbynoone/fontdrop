import { useState } from 'react'

const BUTTONS = [
  { action: 'close' as const, color: '#FF5F57', symbol: '×', title: 'Close' },
  { action: 'minimize' as const, color: '#FFBD2E', symbol: '–', title: 'Minimize' },
  { action: 'fullscreen' as const, color: '#27C93F', symbol: '+', title: 'Full Screen' },
]

export function TrafficLights() {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="flex items-center gap-[8px]"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {BUTTONS.map(({ action, color, symbol, title }) => (
        <button
          key={action}
          title={title}
          onClick={() => window.fontDrop.windowControls[action]()}
          className="w-[12px] h-[12px] rounded-full flex items-center justify-center transition-none border-0 p-0 cursor-default"
          style={{ backgroundColor: color, flexShrink: 0 }}
        >
          <span
            className="text-[8px] leading-none font-bold select-none"
            style={{
              color: 'rgba(0,0,0,0.5)',
              opacity: hovered ? 1 : 0,
              lineHeight: 1,
            }}
          >
            {symbol}
          </span>
        </button>
      ))}
    </div>
  )
}
