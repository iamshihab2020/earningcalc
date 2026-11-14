import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonth } from '@/engine'
import { useToday } from '@/store/hooks'
import { useUI } from '@/store/ui'
import { Button } from './ui'

export function MonthSelector() {
  const { month, setMonth, shiftMonth } = useUI()
  const today = useToday()
  const current = today.slice(0, 7)
  const picker = useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
        <ChevronLeft className="size-5" />
      </Button>
      <div className="relative">
        <button
          type="button"
          className="min-h-11 rounded-[12px] px-2 text-lg font-semibold tracking-tight hover:bg-surface-2"
          onClick={() => picker.current?.showPicker?.() ?? picker.current?.focus()}
          aria-label={`${formatMonth(month)}. Jump to month`}
        >
          {formatMonth(month)}
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
        <Button variant="soft" size="sm" onClick={() => setMonth(current)} className="ml-1">
          This month
        </Button>
      )}
    </div>
  )
}
