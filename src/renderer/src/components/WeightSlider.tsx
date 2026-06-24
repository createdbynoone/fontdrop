import { useMemo } from 'react'
import { Slider } from '@base-ui/react/slider'
import { FontAxis, FontInstance } from '../types'

interface WeightSliderProps {
  axis: FontAxis
  instances: FontInstance[]
  value: number
  onChange: (value: number) => void
}

const SHORT_LABELS: Record<string, string> = {
  Thin: 'Thin', ExtraLight: 'XLt', 'Extra Light': 'XLt',
  UltraLight: 'ULt', 'Ultra Light': 'ULt',
  Light: 'Lt', Regular: 'Rg', Normal: 'Nrm',
  Medium: 'Md', SemiBold: 'SBd', 'Semi Bold': 'SBd',
  DemiBold: 'SBd', Bold: 'Bd', ExtraBold: 'XBd',
  'Extra Bold': 'XBd', Black: 'Blk', Heavy: 'Hvy',
}

function shortLabel(name: string): string {
  return SHORT_LABELS[name] ?? name.slice(0, 3)
}

export function WeightSlider({ axis, instances, value, onChange }: WeightSliderProps) {
  const range = axis.max - axis.min

  const namedInstances = useMemo(
    () =>
      instances
        .filter((i) => i.coordinates[axis.tag] !== undefined && i.name)
        .sort((a, b) => a.coordinates[axis.tag] - b.coordinates[axis.tag])
        .filter((inst, idx, arr) =>
          idx === 0 || inst.coordinates[axis.tag] !== arr[idx - 1].coordinates[axis.tag]
        ),
    [instances, axis.tag]
  )

  return (
    <div className="space-y-1.5">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#888]">
          {axis.name}
        </span>
        <span className="text-[11px] font-mono font-bold tabular-nums text-[#1A1A1A]">
          {value}
        </span>
      </div>

      {/* Slider */}
      <Slider.Root
        value={value}
        onValueChange={(v: number) => onChange(v)}
        min={axis.min}
        max={axis.max}
        step={1}
      >
        <Slider.Control className="flex w-full touch-none items-center select-none py-2.5 cursor-pointer">
          <Slider.Track className="h-[2px] w-full bg-[#D0CEC8] relative select-none">
            <Slider.Indicator className="bg-[#1A1A1A] select-none" />
            <Slider.Thumb className="block w-[14px] h-[14px] bg-[#ECEAE4] border-2 border-[#1A1A1A] rounded-none select-none outline-none shadow-[2px_2px_0_#1A1A1A] transition-all duration-100 cursor-grab hover:bg-[#FF3D00] hover:border-[#FF3D00] hover:shadow-[2px_2px_0_#FF3D00] data-[dragging]:cursor-grabbing data-[dragging]:bg-[#FF3D00] data-[dragging]:border-[#FF3D00] data-[dragging]:shadow-[1px_1px_0_#FF3D00] data-[dragging]:translate-x-px data-[dragging]:translate-y-px" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  )
}
