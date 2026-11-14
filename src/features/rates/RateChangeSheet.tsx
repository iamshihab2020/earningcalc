import { useMemo, useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ArrowRight } from 'lucide-react'
import {
  applyRateChange,
  earnCents,
  effectiveDateOf,
  formatDate,
  formatMonth,
  formatRate,
  formatUSD,
  isISODate,
  monthOf,
  monthTargetSeconds,
  parseScaled,
  rate4On,
  rateChangeImpact,
  sortRates,
  toRate4,
  type RateChange,
  type RateChangeMode,
} from '@/engine'
import { newId, useData } from '@/store/data'
import { useSchedule, useToday } from '@/store/hooks'
import { useUI } from '@/store/ui'
import { AffixInput, Button, Field, Input, Notice, Sheet, cn } from '@/components/ui'
import { undoToast } from '@/lib/toast'

export function RateChangeSheet() {
  const { rateChange, closeRateChange } = useUI(useShallow((s) => ({ rateChange: s.rateChange, closeRateChange: s.closeRateChange })))
  const hasRates = useData((s) => s.rates.length > 0)
  return (
    <Sheet
      open={rateChange.open}
      onOpenChange={(o) => !o && closeRateChange()}
      title={hasRates ? 'Change hourly rate' : 'Set your hourly rate'}
      description={hasRates ? 'Past dates keep the rate they had. You choose where the new rate starts.' : 'You can change it any time without affecting past months.'}
    >
      <RateChangeForm key={String(rateChange.open)} initial={rateChange.amount} onDone={closeRateChange} />
    </Sheet>
  )
}

function RateChangeForm({ initial, onDone }: { initial?: number; onDone: () => void }) {
  const { rates, entries, periodTotals, settings, setRates } = useData(
    useShallow((s) => ({ rates: s.rates, entries: s.entries, periodTotals: s.periodTotals, settings: s.settings, setRates: s.setRates })),
  )
  const schedule = useSchedule()
  const today = useToday()
  const month = useUI((s) => s.month)
  const current4 = rate4On(today, rates)
  const [amount, setAmount] = useState(initial !== undefined ? String(initial) : current4 ? (current4 / 10_000).toFixed(2) : '')
  const [mode, setMode] = useState<RateChangeMode>(rates.length ? 'from-date' : 'month-start')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [step, setStep] = useState<'edit' | 'confirm'>('edit')

  const [id] = useState(newId)
  const rate4 = parseScaled(amount, 4)
  const valid = rate4 !== null && rate4 > 0 && (mode !== 'from-date' || isISODate(date))
  const trimmedNote = note.trim() || undefined
  const change = useMemo<RateChange | null>(
    () => (valid && rate4 ? { id, amount: rate4 / 10_000, mode, date, month, note: trimmedNote } : null),
    [valid, rate4, id, mode, date, month, trimmedNote],
  )
  const next = useMemo(() => (change ? applyRateChange(rates, change) : rates), [change, rates])
  const countTodayAsWorked = settings.countTodayAsWorked
  const impact = useMemo(() => {
    if (!change || step !== 'confirm') return []
    const months = [...entries.map((e) => monthOf(e.date)), ...periodTotals.map((p) => p.month), month, monthOf(today)]
    return rateChangeImpact(months, { entries, periodTotals, schedule, today, countTodayAsWorked }, rates, next)
  }, [change, step, entries, periodTotals, month, today, schedule, countTodayAsWorked, rates, next])

  const standard = rate4 ? earnCents(monthTargetSeconds(month, schedule), rate4) : 0
  const removed = rates.filter((r) => !next.some((n) => n.id === r.id))
  const effective = change ? effectiveDateOf(change) : null

  const apply = () => {
    const undo = setRates(next)
    undoToast(`Rate set to ${formatRate(rate4!, 4)}/h from ${formatDate(effective!)}`, undo)
    onDone()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    if (rates.length === 0) apply()
    else setStep('confirm')
  }

  if (step === 'confirm' && change && effective) {
    const prev4 = rate4On(effective, rates)
    const after = sortRates(next).find((r) => r.effectiveFrom > effective)
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-[12px] bg-surface-2 p-4">
          <p className="text-[0.9375rem] leading-relaxed">
            From <strong>{formatDate(effective)}</strong>
            {after ? (
              <>
                {' '}
                until <strong>{formatDate(after.effectiveFrom)}</strong>
              </>
            ) : (
              ' onward'
            )}
            , time is valued at <strong className="num">{formatRate(rate4!, 4)}/h</strong>{' '}
            <span className="num text-muted">(was {formatRate(prev4, 4)}/h)</span>. Dates before {formatDate(effective)} are unchanged.
          </p>
          {removed.length > 0 && (
            <p className="mt-2 text-sm text-fg">
              Replaces {removed.length} other change{removed.length === 1 ? '' : 's'} in {formatMonth(month)}:{' '}
              {removed.map((r) => `${formatRate(toRate4(r.amount))} from ${formatDate(r.effectiveFrom)}`).join(', ')}.
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">What changes</h3>
          {impact.length === 0 ? (
            <Notice tone="success">No logged earnings or projections change.</Notice>
          ) : (
            <table className="num w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 font-medium">Month</th>
                  <th className="py-2 text-right font-medium">Earned</th>
                  <th className="py-2 text-right font-medium">Projected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {impact.map((i) => (
                  <tr key={i.month}>
                    <td className="py-2.5 font-medium">{formatMonth(i.month)}</td>
                    <td className="py-2.5 text-right">
                      <Delta before={i.beforeCents} after={i.afterCents} />
                    </td>
                    <td className="py-2.5 text-right">
                      <Delta before={i.beforeProjectedCents} after={i.afterProjectedCents} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {periodTotals.some((p) => p.trust === 'tracker' && p.endDate >= effective) && (
            <p className="mt-2 text-sm text-muted">Tracker totals keep the tracker's own figure unless you switch them to the app's calculation.</p>
          )}
        </div>

        <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 pt-3">
          <Button onClick={() => setStep('edit')}>Back</Button>
          <Button variant="primary" className="flex-1" onClick={apply}>
            Apply new rate
          </Button>
        </div>
      </div>
    )
  }

  const modes: Array<{ value: RateChangeMode; label: string; hint: string }> = [
    { value: 'from-date', label: 'From a chosen date', hint: 'Dates before it keep the old rate.' },
    { value: 'month-start', label: `From the start of ${formatMonth(month)}`, hint: `Applies from ${formatDate(`${month}-01`)} onward.` },
    {
      value: 'whole-month',
      label: `All of ${formatMonth(month)}`,
      hint: `Recalculates the whole month, replacing other changes inside it. Later months keep their rates.`,
    },
  ]

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field
        label="Hourly rate (USD)"
        htmlFor="rate-amount"
        hint={rate4 ? `At ${formatRate(rate4, 4)}/h, a standard ${formatMonth(month)} would be ${formatUSD(standard)}.` : 'Up to 4 decimals, e.g. 4.375'}
      >
        <AffixInput
          id="rate-amount"
          prefix="$"
          suffix="/h"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="text-lg font-semibold"
          autoFocus
          aria-invalid={amount !== '' && !rate4}
        />
      </Field>

      {rates.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Apply</legend>
          {modes.map((m) => (
            <label
              key={m.value}
              className={cn(
                'flex cursor-pointer gap-3 rounded-[12px] border p-3.5 transition',
                mode === m.value ? 'border-primary bg-primary-soft/60' : 'border-line hover:bg-surface-2',
              )}
            >
              <input type="radio" name="rate-mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} className="mt-1 size-4 accent-[var(--primary)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium">{m.label}</span>
                <span className="block text-sm text-muted">{m.hint}</span>
                {m.value === 'from-date' && mode === 'from-date' && (
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Effective date" className="mt-2 max-w-48" />
                )}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <Field label="Note" htmlFor="rate-note" hint="Optional, e.g. “Raise after review”">
        <Input id="rate-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 pt-3">
        <Button type="submit" variant="primary" className="flex-1" disabled={!valid}>
          {rates.length ? (
            <>
              Review change <ArrowRight className="size-4" aria-hidden />
            </>
          ) : (
            'Save rate'
          )}
        </Button>
      </div>
    </form>
  )
}

function Delta({ before, after }: { before: number; after: number }) {
  if (before === after) return <span className="text-muted">{formatUSD(after)}</span>
  const up = after > before
  return (
    <span>
      <span className="text-muted line-through">{formatUSD(before)}</span>{' '}
      <span className={up ? 'font-semibold text-success-text' : 'font-semibold text-warning-text'}>{formatUSD(after)}</span>
    </span>
  )
}
