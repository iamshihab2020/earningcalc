import { useMemo, useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { CalendarOff, Trash2, Wand2 } from 'lucide-react'
import {
  deriveRate,
  eachDay,
  firstOfMonth,
  formatDate,
  formatHMS,
  formatHours,
  formatMonth,
  formatRate,
  formatShortDate,
  formatUSD,
  isISODate,
  isWorkingDay,
  monthDays,
  monthTargetSeconds,
  monthWorkingDays,
  parseCents,
  ordinal,
  parseDuration,
  periodOf,
  rate4On,
  rateDifference,
  rateTimeline,
  toRate4,
  weekday,
} from '@/engine'
import { useData } from '@/store/data'
import { usePeriod, useSchedule, useToday } from '@/store/hooks'
import { useUI } from '@/store/ui'
import { MonthSelector } from '@/components/MonthSelector'
import { AffixInput, Button, Card, CardHeader, Field, Input, Notice, PageHeader, Select, cn } from '@/components/ui'
import { undoToast } from '@/lib/toast'
import { UncountedCardsNotice } from '@/features/shared'

const WEEK = [
  { n: 1, short: 'Mon' },
  { n: 2, short: 'Tue' },
  { n: 3, short: 'Wed' },
  { n: 4, short: 'Thu' },
  { n: 5, short: 'Fri' },
  { n: 6, short: 'Sat' },
  { n: 0, short: 'Sun' },
]

export function RatesSchedule() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Rate & schedule" subtitle="Your rate history, working days and days off." />
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <div className="flex flex-col gap-5">
          <RateCard />
          <DeriveCard />
        </div>
        <div className="flex flex-col gap-5">
          <ScheduleCard />
          <DaysOffCard />
        </div>
      </div>
    </div>
  )
}

function RateCard() {
  const { rates, setRates } = useData(useShallow((s) => ({ rates: s.rates, setRates: s.setRates })))
  const openRateChange = useUI((s) => s.openRateChange)
  const today = useToday()
  const timeline = rateTimeline(rates)
  const current = rate4On(today, rates)

  return (
    <Card>
      <CardHeader
        title="Hourly rate"
        action={
          <Button variant="primary" size="sm" onClick={() => openRateChange()}>
            {rates.length ? 'Change rate' : 'Set rate'}
          </Button>
        }
      />
      <div className="px-5 pt-3 pb-5">
        {rates.length === 0 ? (
          <p className="text-[0.9375rem] text-muted">No rate yet. Set one, or derive it from your tracker's totals below.</p>
        ) : (
          <>
            <p className="num text-4xl font-semibold tracking-tight">
              {formatRate(current, 4)}
              <span className="text-lg font-medium text-muted">/h</span>
            </p>
            <h3 className="mt-6 mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Rate timeline</h3>
            <ol className="relative flex flex-col gap-1 border-l-2 border-line pl-5">
              {[...timeline].reverse().map((p) => {
                const active = p.effectiveFrom <= today && (!p.until || p.until >= today)
                return (
                  <li key={p.id} className="relative flex items-center gap-3 py-2">
                    <span
                      className={cn('absolute -left-[27px] size-3 rounded-full border-2 border-surface', active ? 'bg-primary' : 'bg-line')}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="num font-semibold">
                        {formatRate(toRate4(p.amount), 4)}/h {active && <span className="ml-1 text-xs font-medium text-primary">Current</span>}
                      </p>
                      <p className="num text-sm text-muted">
                        {formatDate(p.effectiveFrom)} – {p.until ? formatDate(p.until) : 'now'}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    {rates.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete rate from ${formatDate(p.effectiveFrom)}`}
                        className="text-muted hover:text-danger-text"
                        onClick={() => undoToast(`Removed ${formatRate(toRate4(p.amount))}/h from ${formatShortDate(p.effectiveFrom)}`, setRates(rates.filter((r) => r.id !== p.id)))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </li>
                )
              })}
            </ol>
            {timeline.length > 0 && <p className="mt-3 text-sm text-muted">The earliest rate also covers any dates before it.</p>}
          </>
        )}
      </div>
    </Card>
  )
}

function DeriveCard() {
  const rates = useData((s) => s.rates)
  const openRateChange = useUI((s) => s.openRateChange)
  const today = useToday()
  const [time, setTime] = useState('')
  const [earned, setEarned] = useState('')
  const seconds = parseDuration(time)
  const cents = parseCents(earned)
  const derived = seconds && seconds > 0 && cents && cents > 0 ? deriveRate(seconds, cents) : null
  const saved = rate4On(today, rates)
  const diff = derived && saved ? rateDifference(derived.rate4, saved) : 0

  return (
    <Card>
      <CardHeader title="Derive from tracker" hint="Enter total time and total earned from any tracker summary." />
      <form className="flex flex-col gap-4 px-5 pt-4 pb-5" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total time" htmlFor="derive-time">
            <Input id="derive-time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="118:40:48" autoComplete="off" />
          </Field>
          <Field label="Total earned" htmlFor="derive-earned">
            <AffixInput id="derive-earned" prefix="$" inputMode="decimal" value={earned} onChange={(e) => setEarned(e.target.value)} placeholder="519.82" />
          </Field>
        </div>
        {derived && seconds && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-surface-2 p-4">
            <div className="num">
              <p className="text-sm text-fg">
                {formatUSD(cents!)} ÷ {formatHMS(seconds)} ({formatHours(seconds)} h)
              </p>
              <p className="text-2xl font-semibold">{formatRate(derived.rate4, derived.decimals)}/h</p>
            </div>
            <Button variant="soft" onClick={() => openRateChange(derived.rate4 / 10_000)}>
              <Wand2 className="size-4" aria-hidden /> Use this rate
            </Button>
          </div>
        )}
        {derived && diff > 0.01 && (
          <Notice tone="warning">
            That is {(diff * 100).toFixed(1)}% {derived.rate4 > saved ? 'above' : 'below'} your saved rate of {formatRate(saved)}/h.
          </Notice>
        )}
        {derived && saved > 0 && diff <= 0.01 && <Notice tone="success">Matches your saved rate of {formatRate(saved)}/h.</Notice>}
      </form>
    </Card>
  )
}

function ScheduleCard() {
  const { settings, updateSettings } = useData(useShallow((s) => ({ settings: s.settings, updateSettings: s.updateSettings })))
  const schedule = useSchedule()
  const { month, setMonth } = useUI(useShallow((s) => ({ month: s.month, setMonth: s.setMonth })))
  const period = usePeriod()
  const today = useToday()
  const days = monthWorkingDays(month, schedule).length
  const [hours, setHours] = useState(String(settings.dailyTargetHours))

  const setStartDay = (day: number) => {
    updateSettings({ periodStartDay: day })
    setMonth(periodOf(today, day))
  }
  const currentRange = period.range(period.current)

  const toggle = (n: number) => {
    const set = new Set(settings.workingDays)
    if (set.has(n)) set.delete(n)
    else set.add(n)
    updateSettings({ workingDays: [...set].sort() })
  }

  return (
    <Card>
      <CardHeader title="Work schedule" />
      <div className="flex flex-col gap-5 px-5 pt-4 pb-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Working days</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEK.map((d) => {
              const on = settings.workingDays.includes(d.n)
              return (
                <button
                  key={d.n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(d.n)}
                  className={cn(
                    'min-h-11 rounded-[12px] border text-sm font-medium transition',
                    on ? 'border-primary bg-primary text-primary-fg' : 'border-line text-muted hover:text-fg',
                  )}
                >
                  {d.short}
                </button>
              )
            })}
          </div>
        </fieldset>
        <Field
          label="Pay period starts on"
          htmlFor="period-start"
          hint={
            currentRange
              ? `Each period runs from the ${ordinal(period.startDay)} to the ${ordinal(period.startDay - 1)}. This one: ${currentRange}.`
              : 'Calendar months. Pick another day if your pay or report period runs, say, 26th to 25th.'
          }
        >
          <Select id="period-start" value={period.startDay} onChange={(e) => setStartDay(Number(e.target.value))} className="max-w-60">
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d === 1 ? '1st (calendar month)' : `${ordinal(d)} of the month`}
              </option>
            ))}
          </Select>
        </Field>
        <UncountedCardsNotice />
        <Field label="Daily target" htmlFor="daily-target" hint="Used for projections, backfill and the period's target.">
          <AffixInput
            id="daily-target"
            suffix="h/day"
            inputMode="decimal"
            value={hours}
            onChange={(e) => {
              setHours(e.target.value)
              const v = Number(e.target.value)
              if (Number.isFinite(v) && v > 0 && v <= 24) updateSettings({ dailyTargetHours: v })
            }}
            wrapperClassName="max-w-40"
          />
        </Field>
        <p className="num rounded-[12px] bg-surface-2 px-4 py-3 text-[0.9375rem]">
          {period.label(month)}: <strong>{days}</strong> working days × {settings.dailyTargetHours} h ={' '}
          <strong>{formatHours(monthTargetSeconds(month, schedule), 0)} h</strong>
        </p>
      </div>
    </Card>
  )
}

function DaysOffCard() {
  const { daysOff, addDaysOff, deleteDayOff } = useData(
    useShallow((s) => ({ daysOff: s.daysOff, addDaysOff: s.addDaysOff, deleteDayOff: s.deleteDayOff })),
  )
  const schedule = useSchedule()
  const month = useUI((s) => s.month)
  const today = useToday()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')

  const byDate = useMemo(() => new Map(daysOff.map((d) => [d.date, d])), [daysOff])
  const days = monthDays(month)
  const lead = (weekday(firstOfMonth(month)) + 6) % 7
  const upcoming = [...daysOff].filter((d) => d.date >= firstOfMonth(month)).sort((a, b) => (a.date < b.date ? -1 : 1))

  const toggleDay = (date: string) => {
    const existing = byDate.get(date)
    if (existing) undoToast(`${formatShortDate(date)} is a working day again`, deleteDayOff(existing.id))
    else undoToast(`${formatShortDate(date)} marked as a day off`, addDaysOff([{ date }]))
  }

  const addRange = (e: FormEvent) => {
    e.preventDefault()
    if (!isISODate(from)) return
    const end = isISODate(to) && to >= from ? to : from
    const dates = eachDay(from, end).slice(0, 62)
    undoToast(`Added ${dates.length} day${dates.length === 1 ? '' : 's'} off`, addDaysOff(dates.map((date) => ({ date, reason: reason.trim() || undefined }))))
    setFrom('')
    setTo('')
    setReason('')
  }

  return (
    <Card>
      <CardHeader title="Holidays & days off" hint="Tap a day to mark it off. Days off are skipped in projections and backfill." />
      <div className="px-5 pt-3 pb-5">
        <MonthSelector />
        <div className="mt-3 grid grid-cols-7 gap-1 text-center" aria-label={`Calendar for ${formatMonth(month)}`} role="group">
          {WEEK.map((d) => (
            <div key={d.n} className="pb-1 text-xs font-semibold text-muted" aria-hidden>
              {d.short.slice(0, 2)}
            </div>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <div key={`lead-${i}`} />
          ))}
          {days.map((date) => {
            const off = byDate.get(date)
            const weekend = !schedule.workingDays.includes(weekday(date))
            const working = isWorkingDay(date, schedule)
            return (
              <button
                key={date}
                type="button"
                onClick={() => toggleDay(date)}
                aria-pressed={!!off}
                aria-label={`${formatDate(date)}${off ? `, day off${off.reason ? `: ${off.reason}` : ''}` : weekend ? ', weekend' : ', working day'}`}
                className={cn(
                  'num relative flex aspect-square min-h-10 items-center justify-center rounded-[10px] text-sm transition',
                  off && 'bg-warning-soft font-semibold text-warning-text',
                  !off && weekend && 'text-muted',
                  !off && working && 'bg-surface-2 font-medium hover:bg-primary-soft',
                  date === today && 'ring-2 ring-primary',
                )}
              >
                {Number(date.slice(8))}
                {off && <CalendarOff className="absolute right-0.5 bottom-0.5 size-3" aria-hidden />}
              </button>
            )
          })}
        </div>

        <form onSubmit={addRange} className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
          <Field label="From" htmlFor="off-from">
            <Input id="off-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="off-to" hint="Optional">
            <Input id="off-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Reason" htmlFor="off-reason" hint="Optional" className="col-span-2">
            <Input id="off-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Victory Day" />
          </Field>
          <Button type="submit" variant="soft" className="col-span-2" disabled={!isISODate(from)}>
            Add day{to && to > from ? 's' : ''} off
          </Button>
        </form>

        {upcoming.length > 0 && (
          <ul className="mt-4 divide-y divide-line">
            {upcoming.slice(0, 12).map((d) => (
              <li key={d.id} className="flex min-h-12 items-center gap-3">
                <span className="num w-28 text-sm font-medium">{formatDate(d.date)}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted">{d.reason ?? 'Day off'}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove day off on ${formatDate(d.date)}`}
                  className="text-muted hover:text-danger-text"
                  onClick={() => undoToast(`${formatShortDate(d.date)} removed from days off`, deleteDayOff(d.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
