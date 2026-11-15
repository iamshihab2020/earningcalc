import { useMemo, useState } from 'react'
import { CalendarRange, ClipboardList, Clock, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  addDays,
  formatDay,
  formatHours,
  formatRange,
  formatShortDate,
  formatUSD,
  startOfWeek,
  type EntryType,
  type ValuedEntry,
} from '@/engine'
import { useData } from '@/store/data'
import { useMonthView } from '@/store/hooks'
import { useUI } from '@/store/ui'
import { MonthSelector } from '@/components/MonthSelector'
import { Button, Card, Chip, EmptyState, PageHeader, Segmented, cn } from '@/components/ui'
import { undoToast } from '@/lib/toast'
import { CardMismatch, Duration } from '../shared'
import { entryTypeLabel } from './labels'

type Filter = 'all' | EntryType

const typeBadge: Record<EntryType, string> = {
  tracked: 'bg-primary-soft text-primary',
  backfill: 'bg-surface-2 text-fg',
  adjustment: 'bg-warning-soft text-warning-text',
}

export function TimeLog() {
  const month = useUI((s) => s.month)
  const openAddTime = useUI((s) => s.openAddTime)
  const deleteEntry = useData((s) => s.deleteEntry)
  const { summary: s } = useMonthView(month)
  const [filter, setFilter] = useState<Filter>('all')

  const weeks = useMemo(() => {
    const list = s.entries.filter((v) => filter === 'all' || v.entry.type === filter)
    const byWeek = new Map<string, Map<string, ValuedEntry[]>>()
    for (const v of list) {
      const wk = startOfWeek(v.entry.date)
      const days = byWeek.get(wk) ?? new Map<string, ValuedEntry[]>()
      days.set(v.entry.date, [...(days.get(v.entry.date) ?? []), v])
      byWeek.set(wk, days)
    }
    return [...byWeek.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([week, days]) => {
        const all = [...days.values()].flat().filter((v) => !v.covered)
        return {
          week,
          days: [...days.entries()].sort(([a], [b]) => (a < b ? 1 : -1)),
          seconds: all.reduce((t, v) => t + v.entry.seconds, 0),
          cents: all.reduce((t, v) => t + v.cents, 0),
        }
      })
  }, [s.entries, filter])

  const showCard = s.card && (filter === 'all' || filter === 'tracked')
  const nothing = weeks.length === 0 && !showCard

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Time log"
        subtitle={
          <span className="num">
            <Duration seconds={s.workedSeconds} /> · {formatUSD(s.earnedCents)} this month
          </span>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSelector />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => openAddTime()}>
            <Plus className="size-4" aria-hidden /> Add time
          </Button>
          <Button onClick={() => openAddTime({ tab: 'backfill' })}>
            <CalendarRange className="size-4" aria-hidden /> Backfill
          </Button>
          <Button onClick={() => openAddTime({ tab: 'card' })}>
            <ClipboardList className="size-4" aria-hidden /> Tracker total
          </Button>
        </div>
      </div>

      <Segmented
        label="Filter by type"
        value={filter}
        onChange={setFilter}
        className="sm:max-w-md"
        options={[
          { value: 'all', label: 'All' },
          { value: 'tracked', label: 'Tracked' },
          { value: 'backfill', label: 'Backfill' },
          { value: 'adjustment', label: 'Adjust' },
        ]}
      />

      {s.card && <CardMismatch card={s.card} />}

      {showCard && s.card && (
        <Card className="p-2">
          <button
            type="button"
            onClick={() => openAddTime({ editingCard: s.card!.card })}
            className="flex min-h-16 w-full items-center gap-3 rounded-[12px] px-3 text-left hover:bg-surface-2"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <ClipboardList className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Tracker total</span>
              <span className="block text-sm text-muted">
                {formatRange(s.card.card.startDate, s.card.card.endDate)} · as of {formatShortDate(s.card.card.endDate)}
              </span>
            </span>
            <span className="text-right">
              <Duration seconds={s.card.card.seconds} className="block font-semibold" />
              <span className="num block text-sm text-muted">{formatUSD(s.card.usedCents)}</span>
            </span>
            <Pencil className="size-4 shrink-0 text-muted" aria-hidden />
          </button>
        </Card>
      )}

      {nothing ? (
        <Card>
          <EmptyState
            icon={<Clock className="size-6" />}
            title={filter === 'all' ? 'No time logged this month' : `No ${entryTypeLabel[filter].toLowerCase()} entries`}
            action={
              <>
                <Button variant="primary" onClick={() => openAddTime()}>
                  Add your first entry
                </Button>
                <Button onClick={() => openAddTime({ tab: 'card' })}>Enter tracker total</Button>
              </>
            }
          >
            Add your first entry or enter your tracker total.
          </EmptyState>
        </Card>
      ) : (
        weeks.map((w) => (
          <Card key={w.week} className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/50 px-5 py-3">
              <h2 className="text-sm font-semibold">
                Week of {formatShortDate(w.week)} – {formatShortDate(addDays(w.week, 6))}
              </h2>
              <span className="num text-sm text-fg">
                <Duration seconds={w.seconds} /> · {formatUSD(w.cents)}
              </span>
            </div>
            <ul className="divide-y divide-line">
              {w.days.map(([date, items]) => {
                const counted = items.filter((v) => !v.covered)
                const daySeconds = counted.reduce((t, v) => t + v.entry.seconds, 0)
                const dayCents = counted.reduce((t, v) => t + v.cents, 0)
                return (
                  <li key={date} className="px-2 py-2">
                    <div className="flex items-center justify-between px-3 pt-1 pb-1">
                      <span className="text-sm font-semibold">{formatDay(date)}</span>
                      {items.length > 1 && (
                        <span className="num text-sm text-muted">
                          <Duration seconds={daySeconds} /> · {formatUSD(dayCents)}
                        </span>
                      )}
                    </div>
                    <ul>
                      {items.map((v) => (
                        <EntryRow
                          key={v.entry.id}
                          v={v}
                          onEdit={() => openAddTime({ editing: v.entry })}
                          onDelete={() => undoToast(`Deleted ${formatHours(v.entry.seconds)} h on ${formatShortDate(v.entry.date)}`, deleteEntry(v.entry.id))}
                        />
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
          </Card>
        ))
      )}
    </div>
  )
}

function EntryRow({ v, onEdit, onDelete }: { v: ValuedEntry; onEdit: () => void; onDelete: () => void }) {
  const text = v.covered ? 'In tracker total, not counted again' : v.entry.note
  const detail = (v.extra || text) && (
    <>
      {v.extra && (
        <Chip tone="info" className="mr-2 px-2 py-0 text-xs">
          Extra
        </Chip>
      )}
      {text}
    </>
  )
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          'flex min-h-12 min-w-0 flex-1 flex-col justify-center gap-1 rounded-[12px] px-3 py-1.5 text-left hover:bg-surface-2',
          v.covered && 'opacity-70',
        )}
        aria-label={`Edit ${entryTypeLabel[v.entry.type]} entry, ${formatHours(v.entry.seconds)} hours on ${formatDay(v.entry.date)}`}
      >
        <span className="flex w-full items-center gap-3">
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', typeBadge[v.entry.type])}>{entryTypeLabel[v.entry.type]}</span>
          {/* Wide screens: detail inline. Phones: on its own line below, so it isn't cut to a few letters. */}
          <span className="min-w-0 flex-1 truncate text-sm text-muted max-sm:invisible">{detail}</span>
          <Duration seconds={v.entry.seconds} className="font-medium" />
          <span className={cn('num w-20 text-right font-medium', v.covered && 'line-through decoration-muted')}>{formatUSD(v.cents)}</span>
        </span>
        {detail && <span className="w-full truncate text-sm text-muted sm:hidden">{detail}</span>}
      </button>
      <Button variant="ghost" size="icon" aria-label="Delete entry" onClick={onDelete} className="text-muted hover:text-danger-text">
        <Trash2 className="size-4" />
      </Button>
    </li>
  )
}
