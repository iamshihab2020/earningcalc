import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Tabs } from 'radix-ui'
import { Trash2 } from 'lucide-react'
import {
  addMonths,
  backfillDates,
  deriveRate,
  earnCents,
  eachDay,
  cardFor,
  formatHMS,
  formatHours,
  formatRange,
  formatRate,
  formatShortDate,
  formatUSD,
  isISODate,
  isWorkingDay,
  lastOfMonth,
  monthOf,
  parseCents,
  parseDuration,
  rate4On,
  rateDifference,
  type EntryType,
  type ISODate,
  type PeriodTotal,
  type TimeEntry,
} from '@/engine'
import { newId, useData } from '@/store/data'
import { useFormat, usePeriod, useSchedule, useToday } from '@/store/hooks'
import { useUI, type AddTimeTab } from '@/store/ui'
import { AffixInput, Button, Field, Input, Notice, Segmented, Sheet, Switch, cn } from '@/components/ui'
import { undoToast } from '@/lib/toast'
import { entryTypeHint, entryTypeLabel } from './labels'

export function AddTimeSheet() {
  const { addTime, closeAddTime, openAddTime } = useUI()
  const editing = addTime.editing
  const editingCard = addTime.editingCard
  const title = editing ? 'Edit entry' : editingCard ? 'Tracker total' : 'Add time'
  // Remount the body on every open so the form starts fresh.
  const key = `${addTime.open}-${editing?.id ?? ''}-${editingCard?.id ?? ''}-${addTime.tab}`

  return (
    <Sheet open={addTime.open} onOpenChange={(o) => !o && closeAddTime()} title={title}>
      {editing ? (
        <SingleForm key={key} editing={editing} onDone={closeAddTime} />
      ) : editingCard ? (
        <CardForm key={key} editing={editingCard} onDone={closeAddTime} />
      ) : (
        <Tabs.Root value={addTime.tab} onValueChange={(t) => openAddTime({ tab: t as AddTimeTab, date: addTime.date })}>
          <Tabs.List aria-label="Kind of entry" className="mb-4 grid grid-cols-3 gap-1 rounded-[12px] bg-surface-2 p-1">
            {(
              [
                ['single', 'Single entry'],
                ['backfill', 'Backfill range'],
                ['card', 'Tracker total'],
              ] as const
            ).map(([v, label]) => (
              <Tabs.Trigger
                key={v}
                value={v}
                className="min-h-10 rounded-[9px] px-1 text-sm font-medium text-muted transition hover:text-fg data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-sm"
              >
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content value="single">
            <SingleForm key={key} defaultDate={addTime.date} onDone={closeAddTime} />
          </Tabs.Content>
          <Tabs.Content value="backfill">
            <BackfillForm key={key} onDone={closeAddTime} />
          </Tabs.Content>
          <Tabs.Content value="card">
            <CardForm key={key} onDone={closeAddTime} />
          </Tabs.Content>
        </Tabs.Root>
      )}
    </Sheet>
  )
}

/** A date inside the selected pay period: today if it's in the period, else its first day. */
function useDefaultDate(): ISODate {
  const today = useToday()
  const period = usePeriod()
  const month = useUI((s) => s.month)
  return period.of(today) === month ? today : period.start(month)
}

function FormFooter({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 -mx-5 mt-5 flex gap-2 border-t border-line bg-surface px-5 pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]">{children}</div>
}

function DurationInput({
  id,
  value,
  onChange,
  invalid,
  autoFocus,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  autoFocus?: boolean
}) {
  return (
    <Input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.target.select()}
      placeholder="8:00:00 or 8.5"
      autoComplete="off"
      spellCheck={false}
      aria-invalid={invalid}
      autoFocus={autoFocus}
      className="text-lg font-semibold"
    />
  )
}

function SingleForm({ editing, defaultDate, onDone }: { editing?: TimeEntry; defaultDate?: ISODate; onDone: () => void }) {
  const { rates, periodTotals, addEntries, updateEntry, deleteEntry, dailyTargetHours } = useData(
    useShallow((s) => ({
      rates: s.rates,
      periodTotals: s.periodTotals,
      addEntries: s.addEntries,
      updateEntry: s.updateEntry,
      deleteEntry: s.deleteEntry,
      dailyTargetHours: s.settings.dailyTargetHours,
    })),
  )
  const schedule = useSchedule()
  const period = usePeriod()
  const fallbackDate = useDefaultDate()
  const [date, setDate] = useState(editing?.date ?? defaultDate ?? fallbackDate)
  const [duration, setDuration] = useState(editing ? formatHMS(editing.seconds) : formatHMS(Math.round(dailyTargetHours * 3600)))
  const [type, setType] = useState<EntryType>(editing?.type ?? 'tracked')
  const [note, setNote] = useState(editing?.note ?? '')
  const [touched, setTouched] = useState(false)

  const seconds = parseDuration(duration)
  const validDate = isISODate(date)
  const rate4 = validDate ? rate4On(date, rates) : 0
  const card = validDate ? cardFor(period.of(date), periodTotals, period.startDay) : null
  const covered = type === 'tracked' && card && date >= card.startDate && date <= card.endDate
  const extra = validDate && !isWorkingDay(date, schedule)
  const durationError = touched && seconds === null ? 'Use 8:00:00, 8:00 or 8.5' : seconds === 0 && touched ? 'Duration can’t be zero' : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (seconds === null || seconds === 0 || !validDate) return
    const entry = { date, seconds, type, note: note.trim() || undefined }
    if (editing) {
      undoToast('Entry updated', updateEntry({ ...editing, ...entry }))
    } else {
      undoToast(`Added ${formatHMS(seconds)} on ${formatShortDate(date)}`, addEntries([entry]))
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="entry-date">
          <Input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Duration" htmlFor="entry-duration" error={durationError}>
          <DurationInput id="entry-duration" value={duration} onChange={setDuration} invalid={!!durationError} autoFocus={!editing} />
        </Field>
      </div>
      <div className="-mt-1 flex flex-wrap gap-2" aria-label="Quick durations">
        {[dailyTargetHours, 4, 2, 1].filter((v, i, a) => a.indexOf(v) === i).map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setDuration(formatHMS(Math.round(h * 3600)))}
            className="num min-h-9 rounded-full border border-line px-3 text-sm font-medium hover:border-primary hover:text-primary"
          >
            {h} h
          </button>
        ))}
      </div>
      {seconds !== null && seconds !== 0 && (
        <p className="num -mt-1 text-sm text-muted">
          = {formatHours(seconds)} h{rate4 ? <> · <span className="font-medium text-fg">{formatUSD(earnCents(seconds, rate4))}</span> at {formatRate(rate4)}/h</> : null}
        </p>
      )}

      <Field label="Type" hint={entryTypeHint[type]}>
        <Segmented
          label="Entry type"
          value={type}
          onChange={setType}
          options={(['tracked', 'backfill', 'adjustment'] as const).map((t) => ({ value: t, label: entryTypeLabel[t] }))}
        />
      </Field>

      {covered && (
        <Notice tone="warning">
          {formatShortDate(date)} is inside your tracker total ({formatRange(card.startDate, card.endDate)}), so tracked time on this day is
          already counted. Use Backfill or Adjustment for time added outside the tracker.
        </Notice>
      )}
      {extra && <Notice tone="info">{formatShortDate(date)} is a day off. This entry will count as extra time.</Notice>}

      <Field label="Note" htmlFor="entry-note" hint="Optional">
        <Input id="entry-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Client call" />
      </Field>

      <FormFooter>
        {editing && (
          <Button
            variant="danger"
            onClick={() => {
              undoToast('Entry deleted', deleteEntry(editing.id))
              onDone()
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        )}
        <Button type="submit" variant="primary" className="flex-1">
          {editing ? 'Save changes' : 'Add time'}
        </Button>
      </FormFooter>
    </form>
  )
}

function BackfillForm({ onDone }: { onDone: () => void }) {
  const { rates, entries, addEntries, dailyTargetHours } = useData(
    useShallow((s) => ({
      rates: s.rates,
      entries: s.entries,
      addEntries: s.addEntries,
      dailyTargetHours: s.settings.dailyTargetHours,
    })),
  )
  const schedule = useSchedule()
  const month = useUI((s) => s.month)
  const period = usePeriod()
  const defaultDate = useDefaultDate()
  const [start, setStart] = useState(period.start(month))
  const [end, setEnd] = useState(defaultDate)
  const [hours, setHours] = useState(formatHMS(Math.round(dailyTargetHours * 3600)))
  const [skip, setSkip] = useState(true)
  const [note, setNote] = useState('')

  const perDay = parseDuration(hours)
  const valid = isISODate(start) && isISODate(end) && end >= start
  const tooLong = valid && eachDay(start, end).length > 92
  const dates = useMemo(() => (valid && !tooLong ? backfillDates(start, end, schedule, skip) : []), [valid, tooLong, start, end, schedule, skip])
  const skipped = valid && !tooLong && skip ? eachDay(start, end).filter((d) => !dates.includes(d)) : []
  const alreadyFilled = new Set(entries.filter((e) => e.type === 'backfill').map((e) => e.date))
  const dupes = dates.filter((d) => alreadyFilled.has(d))
  const totalCents = perDay ? dates.reduce((s, d) => s + earnCents(perDay, rate4On(d, rates)), 0) : 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!perDay || dates.length === 0) return
    const undo = addEntries(dates.map((date) => ({ date, seconds: perDay, type: 'backfill' as const, note: note.trim() || undefined })))
    undoToast(`Backfilled ${dates.length} day${dates.length === 1 ? '' : 's'} (${formatHMS(perDay * dates.length)})`, undo)
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" htmlFor="bf-start">
          <Input id="bf-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="To" htmlFor="bf-end" error={valid || !end ? (tooLong ? 'Pick at most 3 months' : null) : 'End must be after start'}>
          <Input
            id="bf-end"
            type="date"
            value={end}
            min={start}
            max={isISODate(start) ? lastOfMonth(addMonths(monthOf(start), 2)) : undefined}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Hours per day" htmlFor="bf-hours" error={perDay === null ? 'Use 8:00:00, 8:00 or 8.5' : null}>
        <DurationInput id="bf-hours" value={hours} onChange={setHours} invalid={perDay === null} />
      </Field>
      <Switch checked={skip} onCheckedChange={setSkip} label="Skip days off" description="Weekends and holidays from your schedule" />

      <div className="rounded-[12px] bg-surface-2 p-4">
        <p className="num text-[0.9375rem]">
          <strong>{dates.length}</strong> day{dates.length === 1 ? '' : 's'} × {perDay ? formatHours(perDay) : '—'} h ={' '}
          <strong>{perDay ? formatHMS(perDay * dates.length) : '—'}</strong>
          {totalCents > 0 && <> · <strong>{formatUSD(totalCents)}</strong></>}
        </p>
        {dates.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Days to fill">
            {dates.map((d) => (
              <li key={d} className={cn('num rounded-full bg-surface px-2.5 py-1 text-xs font-medium', alreadyFilled.has(d) && 'ring-2 ring-warning')}>
                {formatShortDate(d)}
              </li>
            ))}
          </ul>
        )}
        {skipped.length > 0 && (
          <p className="mt-3 text-sm text-fg">
            Skipping {skipped.length} day{skipped.length === 1 ? '' : 's'} off: {skipped.slice(0, 6).map(formatShortDate).join(', ')}
            {skipped.length > 6 ? '…' : ''}
          </p>
        )}
      </div>
      {dupes.length > 0 && (
        <Notice tone="warning">
          {dupes.length} of these days already have backfill ({dupes.slice(0, 4).map(formatShortDate).join(', ')}
          {dupes.length > 4 ? '…' : ''}). Adding again will count them twice.
        </Notice>
      )}

      <Field label="Note" htmlFor="bf-note" hint="Optional, added to every day">
        <Input id="bf-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Added by manager" />
      </Field>

      <FormFooter>
        <Button type="submit" variant="primary" className="flex-1" disabled={!perDay || dates.length === 0}>
          Backfill {dates.length} day{dates.length === 1 ? '' : 's'}
        </Button>
      </FormFooter>
    </form>
  )
}

function CardForm({ editing, onDone }: { editing?: PeriodTotal; onDone: () => void }) {
  const { rates, periodTotals, saveCard, deleteCard, setRates } = useData(
    useShallow((s) => ({
      rates: s.rates,
      periodTotals: s.periodTotals,
      saveCard: s.saveCard,
      deleteCard: s.deleteCard,
      setRates: s.setRates,
    })),
  )
  const openRateChange = useUI((s) => s.openRateChange)
  const f = useFormat()
  const today = useToday()
  const month = useUI((s) => s.month)
  const period = usePeriod()
  const defaultEnd = period.current === month ? today : month < period.current ? period.end(month) : period.start(month)
  const [time, setTime] = useState(editing ? formatHMS(editing.seconds) : '')
  const [earned, setEarned] = useState(editing ? (editing.trackerEarnedCents / 100).toFixed(2) : '')
  const previous = cardFor(month, periodTotals, period.startDay)
  const [start, setStart] = useState(editing?.startDate ?? previous?.startDate ?? period.start(month))
  const [end, setEnd] = useState(editing?.endDate ?? defaultEnd)
  const [touched, setTouched] = useState(false)

  const seconds = parseDuration(time)
  const cents = parseCents(earned)
  const cardMonth = isISODate(end) ? period.of(end) : month
  const datesValid = isISODate(start) && isISODate(end) && start <= end && period.of(start) === cardMonth
  const derived = seconds && seconds > 0 && cents !== null && cents > 0 ? deriveRate(seconds, cents) : null
  const saved4 = datesValid ? rate4On(end, rates) : 0
  const differs = derived && saved4 > 0 && rateDifference(derived.rate4, saved4) > 0.01
  const existing = periodTotals.find((p) => period.of(p.endDate) === cardMonth && p.id !== editing?.id)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!seconds || seconds <= 0 || cents === null || !datesValid) return
    const card = { month: cardMonth, startDate: start, endDate: end, seconds, trackerEarnedCents: cents, trust: editing?.trust ?? ('tracker' as const) }
    const undoCard = saveCard(card, editing?.id)
    if (rates.length === 0 && derived) {
      const undoRate = setRates([
        { id: newId(), amount: derived.rate4 / 10_000, effectiveFrom: period.start(cardMonth), note: 'Derived from tracker' },
      ])
      undoToast(`Saved tracker total and set your rate to ${formatRate(derived.rate4)}/h`, () => {
        undoRate()
        undoCard()
      })
    } else {
      undoToast(existing || editing ? 'Tracker total replaced' : 'Tracker total saved', undoCard)
    }
    onDone()
    if (differs && derived) {
      openRateChange(derived.rate4 / 10_000)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted">
        Copy the totals from your tracker's schedule card. Pasting a newer reading for the same {period.custom ? 'pay period' : 'month'}{' '}
        replaces the old one.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total time" htmlFor="card-time" error={touched && !seconds ? 'e.g. 62:41:12' : null}>
          <DurationInput id="card-time" value={time} onChange={setTime} invalid={touched && !seconds} autoFocus />
        </Field>
        <Field label="Total earned" htmlFor="card-earned" error={touched && cents === null ? 'e.g. 274.57' : null}>
          <AffixInput
            id="card-earned"
            prefix="$"
            inputMode="decimal"
            value={earned}
            onChange={(e) => setEarned(e.target.value)}
            placeholder="0.00"
            className="text-lg font-semibold"
            aria-invalid={touched && cents === null}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First day tracked" htmlFor="card-start" hint="Optional">
          <Input id="card-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="As of" htmlFor="card-end" error={
            !datesValid && touched
              ? period.custom
                ? `Both dates must be in one pay period (${period.range(cardMonth)})`
                : 'Both dates must be in the same month'
              : null
          }
        >
          <Input id="card-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>

      {derived && seconds && (
        <div className="rounded-[12px] bg-surface-2 p-4">
          <dl className="num grid grid-cols-3 gap-3">
            <div>
              <dt className="text-xs font-semibold tracking-wider text-muted uppercase">Hours</dt>
              <dd className="text-lg font-semibold">{formatHours(seconds)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wider text-muted uppercase">Real rate</dt>
              <dd className="text-lg font-semibold">{formatRate(derived.rate4, derived.decimals)}/h</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wider text-muted uppercase">Earned</dt>
              <dd className="text-lg font-semibold">{formatUSD(cents!)}</dd>
              <dd className="text-xs text-muted">≈ {f.local(cents!)}</dd>
            </div>
          </dl>
          <p className="num mt-2 text-xs text-muted">
            {formatUSD(cents!)} ÷ {formatHMS(seconds)} = {derived.exact.toFixed(5)}
            {derived.reproduces ? ` → ${formatRate(derived.rate4, derived.decimals)} reproduces the tracker's total exactly.` : '.'}
          </p>
        </div>
      )}
      {differs && derived && (
        <Notice tone="warning">
          Your saved rate is {formatRate(saved4)}/h, but this reading works out to {formatRate(derived.rate4, derived.decimals)}/h (
          {(rateDifference(derived.rate4, saved4) * 100).toFixed(1)}% different). After saving you can update your rate.
        </Notice>
      )}
      {rates.length === 0 && derived && <Notice tone="info">Your hourly rate will be set to {formatRate(derived.rate4, derived.decimals)}/h from {formatShortDate(period.start(cardMonth))}.</Notice>}
      {existing && (
        <Notice tone="info">
          Replaces the reading as of {formatShortDate(existing.endDate)} ({formatHMS(existing.seconds)}, {formatUSD(existing.trackerEarnedCents)}).
        </Notice>
      )}

      <FormFooter>
        {editing && (
          <Button
            variant="danger"
            onClick={() => {
              undoToast('Tracker total deleted', deleteCard(editing.id))
              onDone()
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        )}
        <Button type="submit" variant="primary" className="flex-1">
          {editing || existing ? 'Replace reading' : 'Save tracker total'}
        </Button>
      </FormFooter>
    </form>
  )
}
