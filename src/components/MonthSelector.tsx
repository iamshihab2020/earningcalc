import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonth } from '@/engine'
import { usePeriod } from '@/store/hooks'
import { useUI } from '@/store/ui'
import { Button } from './ui'

export function MonthSelector() {
  const { month, setMonth, shiftMonth } = useUI()
  const period = usePeriod()
  const current = period.current
  const range = period.range(month)
  const picker = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
        <ChevronLeft className="size-5" />
      </Button>
      <div className="relative">
        <button
          type="button"
          className="flex min-h-11 flex-col items-start justify-center whitespace-nowrap rounded-[12px] px-2 text-lg leading-tight font-semibold tracking-tight hover:bg-surface-2"
          onClick={() => picker.current?.showPicker?.() ?? picker.current?.focus()}
          aria-label={`${period.label(month)}. Jump to month`}
        >
          {formatMonth(month)}
          {range && <span className="text-xs font-medium tracking-normal text-muted">{range}</span>}
        </button>
        <input
          ref={picker}
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="pointer-events-none absolute inset-0 opacity-0"
          tabIndex={-1}
          aria-hidden
        />
      </div>
      <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shiftMonth(1)}>
        <ChevronRight className="size-5" />
      </Button>
      {month !== current && (
        <Button variant="soft" size="sm" onClick={() => setMonth(current)} className="ml-1 whitespace-nowrap">
          This month
        </Button>
      )}
    </div>
  )
}
