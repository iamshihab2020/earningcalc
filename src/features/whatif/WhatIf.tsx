import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  compareRates,
  earnCents,
  formatHours,
  formatHoursShort,
  formatMonth,
  formatRate,
  formatShortDate,
  formatUSD,
  offerRate,
  paceCheck,
  parseCents,
  parseScaled,
  valueDays,
  type Schedule,
} from '@/engine'
import { useFormat, useMonthView, useSchedule, useToday } from '@/store/hooks'
import { useUI } from '@/store/ui'
import { MonthSelector } from '@/components/MonthSelector'
import { AffixInput, Card, CardHeader, Chip, Field, Input, PageHeader, cn } from '@/components/ui'
import { HoursStepper } from '../dashboard/Dashboard'
import { AheadChip, Money, ScenarioCard } from '../shared'

export function WhatIf() {
  const month = useUI((s) => s.month)
  const baseSchedule = useSchedule()
  const [extraOff, setExtraOff] = useState<string[]>([])
  const schedule: Schedule = useMemo(
    () => ({ ...baseSchedule, daysOff: [...baseSchedule.daysOff, ...extraOff.map((date) => ({ id: `whatif-${date}`, date }))] }),
    [baseSchedule, extraOff],
  )
  const { projectionHours, setProjectionHours } = useUI()
  const view = useMonthView(month, { schedule })
  const base = useMonthView(month)
  const { summary: s, scenarios: sc, settings } = view
  const hoursPerDay = projectionHours ?? settings.dailyTargetHours
  const [nextDayHours, setNextDayHours] = useState(settings.dailyTargetHours)
  const nextDayCents = sc.nextDayOnly.date
    ? sc.now.cents + valueDays([sc.nextDayOnly.date], Math.round(nextDayHours * 3600), view.rates).cents
    : sc.now.cents

  const [heavyHours, setHeavyHours] = useState('20')
  const [heavyDays, setHeavyDays] = useState('2')
  const hh = Number(heavyHours)
  const hd = Number(heavyDays)
  const pace = Number.isFinite(hh) && Number.isFinite(hd) && hd > 0 ? paceCheck(Math.round(hh * 3600), Math.round(hd), s.dailyTargetSeconds, s.rate4) : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="What-if" subtitle="Plan the rest of the month and compare offers." />
      <MonthSelector />

      <section aria-labelledby="situations" className="flex flex-col gap-3">
        <h2 id="situations" className="text-xs font-semibold tracking-wider text-muted uppercase">
          Situations for {formatMonth(month)}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ScenarioCard label="A" title="Where I am now" cents={sc.now.cents} seconds={sc.now.seconds} detail={`at ${formatRate(s.rate4)}/h`} />

          <div className="flex min-w-0 flex-col gap-3 rounded-[16px] border border-line/60 bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary" aria-hidden>
                B
              </span>
              <h3 className="text-sm font-semibold">Heavy stretch</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
              <span>I worked</span>
              <div className="w-20">
                <Input aria-label="Hours worked" inputMode="decimal" value={heavyHours} onChange={(e) => setHeavyHours(e.target.value)} className="text-center" />
              </div>
              <span>h in</span>
              <div className="w-16">
                <Input aria-label="Days" inputMode="numeric" value={heavyDays} onChange={(e) => setHeavyDays(e.target.value)} className="text-center" />
              </div>
              <span>days</span>
            </div>
            {pace && (
              <>
                <Money cents={pace.cents} />
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <AheadChip seconds={pace.aheadSeconds} />
                  <span className="num">vs normal pace of {formatHoursShort(pace.normalSeconds)}</span>
                </div>
              </>
            )}
          </div>

          <ScenarioCard
            label="C"
            title={sc.nextDayOnly.date ? `${formatShortDate(sc.nextDayOnly.date)} only, then stop` : 'One more day'}
            cents={nextDayCents}
            seconds={sc.now.seconds + (sc.nextDayOnly.date ? Math.round(nextDayHours * 3600) : 0)}
          >
            {sc.nextDayOnly.date ? (
              <HoursStepper value={nextDayHours} onChange={setNextDayHours} label="Hours on the next day" />
            ) : (
              <p className="text-sm text-muted">No working days left this month.</p>
            )}
          </ScenarioCard>

          <ScenarioCard label="D" title="Keep going" cents={sc.keepGoing.cents} seconds={sc.keepGoing.seconds} detail={`${sc.keepGoing.days} days left`} highlight>
            <HoursStepper value={hoursPerDay} onChange={(h) => setProjectionHours(h === settings.dailyTargetHours ? null : h)} />
            <input
              type="range"
              min={0}
              max={14}
              step={0.5}
              value={hoursPerDay}
              onChange={(e) => setProjectionHours(Number(e.target.value) === settings.dailyTargetHours ? null : Number(e.target.value))}
              aria-label="Hours per remaining day"
              className="w-full accent-[var(--primary)]"
            />
          </ScenarioCard>

          <ScenarioCard
            label="E"
            title="Standard month"
            cents={sc.standard.cents}
            seconds={sc.standard.seconds}
            detail={`${s.workingDays.length} days × ${settings.dailyTargetHours} h`}
          >
            <p className="num text-sm">
              Keep going is{' '}
              <strong className={sc.keepGoing.seconds >= sc.standard.seconds ? 'text-success-text' : 'text-warning-text'}>
                {formatHours(Math.abs(sc.keepGoing.seconds - sc.standard.seconds), 1)} h {sc.keepGoing.seconds >= sc.standard.seconds ? 'ahead' : 'behind'}
              </strong>{' '}
              of this.
            </p>
          </ScenarioCard>
        </div>
      </section>

      <HolidayToggle remaining={base.summary.remainingDays} extraOff={extraOff} setExtraOff={setExtraOff} />

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <RateComparison standardSeconds={sc.standard.seconds} projectedSeconds={sc.keepGoing.seconds} currentRate4={s.rate4} />
        <OfferCalculator currentRate4={s.rate4} />
      </div>
    </div>
  )
}

function HolidayToggle({ remaining, extraOff, setExtraOff }: { remaining: string[]; extraOff: string[]; setExtraOff: (d: string[]) => void }) {
  if (remaining.length === 0) return null
  return (
    <Card>
      <CardHeader title="Treat a day as a holiday" hint="Tap remaining days to take them off in these scenarios only. Your schedule is not changed." />
      <div className="flex flex-wrap gap-2 px-5 pt-4 pb-5">
        {remaining.map((d) => {
          const off = extraOff.includes(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={off}
              onClick={() => setExtraOff(off ? extraOff.filter((x) => x !== d) : [...extraOff, d])}
              className={cn(
                'num inline-flex min-h-10 items-center gap-1 rounded-full border px-3 text-sm font-medium transition',
                off ? 'border-warning bg-warning-soft text-warning-text line-through' : 'border-line hover:border-primary hover:text-primary',
              )}
            >
              {formatShortDate(d)}
            </button>
          )
        })}
        {extraOff.length > 0 && (
          <button type="button" onClick={() => setExtraOff([])} className="min-h-10 px-2 text-sm font-medium text-primary underline-offset-2 hover:underline">
            Reset
          </button>
        )}
      </div>
    </Card>
  )
}

function RateComparison({ standardSeconds, projectedSeconds, currentRate4 }: { standardSeconds: number; projectedSeconds: number; currentRate4: number }) {
  const f = useFormat()
  const [rates, setRates] = useState<number[]>(() => {
    const base = [currentRate4 || 43800, 50000, 55000, 60000]
    return [...new Set(base)].sort((a, b) => a - b)
  })
  const [draft, setDraft] = useState('')
  const add = () => {
    const r4 = parseScaled(draft, 4)
    if (r4 && r4 > 0 && !rates.includes(r4)) setRates([...rates, r4].sort((a, b) => a - b))
    setDraft('')
  }
  const std = compareRates(rates, standardSeconds)
  const proj = compareRates(rates, projectedSeconds)
  const currentProj = earnCents(projectedSeconds, currentRate4)

  return (
    <Card>
      <CardHeader title="Rate comparison" hint={`Standard month ${formatHours(standardSeconds, 0)} h · your projection ${formatHours(projectedSeconds)} h`} />
      <div className="px-5 pt-4 pb-5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <AffixInput prefix="$" suffix="/h" inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a rate" aria-label="Rate to compare" />
          <button type="submit" className="inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-primary-soft text-primary" aria-label="Add rate">
            <Plus className="size-5" />
          </button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="num w-full min-w-[22rem] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 font-medium">Rate</th>
                <th className="py-2 text-right font-medium">Standard</th>
                <th className="py-2 text-right font-medium">Projected</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rates.map((r, i) => (
                <tr key={r} className={r === currentRate4 ? 'bg-primary-soft/50' : undefined}>
                  <td className="py-2.5 font-semibold">
                    {formatRate(r, 4)}
                    {r === currentRate4 && <Chip tone="info" icon={false} className="ml-2 px-2 py-0 text-xs">Current</Chip>}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="block font-medium">{formatUSD(std[i])}</span>
                    <span className="block text-xs text-muted">{f.local(std[i])}</span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="block font-medium">{formatUSD(proj[i])}</span>
                    <span className="block text-xs text-muted">
                      {r !== currentRate4 && currentRate4 > 0 ? `${proj[i] >= currentProj ? '+' : '−'}${formatUSD(Math.abs(proj[i] - currentProj))}` : f.local(proj[i])}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => setRates(rates.filter((x) => x !== r))}
                      aria-label={`Remove ${formatRate(r, 4)}`}
                      className="inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
                    >
                      <X className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  )
}

function OfferCalculator({ currentRate4 }: { currentRate4: number }) {
  const schedule = useSchedule()
  const today = useToday()
  const [amount, setAmount] = useState('800')
  const [month, setMonth] = useState(() => {
    const [y, m] = today.split('-').map(Number)
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  })
  const [hours, setHours] = useState('8')
  const cents = parseCents(amount)
  const h = Number(hours)
  const result = cents && cents > 0 && /^\d{4}-\d{2}$/.test(month) && h > 0 ? offerRate(cents, month, h, schedule) : null
  const diff = result && currentRate4 ? result.rate4 - currentRate4 : 0

  return (
    <Card>
      <CardHeader title="Offer calculator" hint="What hourly rate does a fixed monthly amount work out to?" />
      <div className="flex flex-col gap-4 px-5 pt-4 pb-5">
        <div className="grid grid-cols-[1fr_5.5rem] gap-3 sm:grid-cols-[1fr_1fr_6rem]">
          <Field label="Monthly amount" htmlFor="offer-amount" className="col-span-2 sm:col-span-1">
            <AffixInput id="offer-amount" prefix="$" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Month" htmlFor="offer-month">
            <Input id="offer-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <Field label="Hours/day" htmlFor="offer-hours">
            <Input id="offer-hours" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
        </div>
        {result && result.seconds > 0 && (
          <div className="rounded-[12px] bg-surface-2 p-4">
            <p className="num text-sm text-fg">
              {result.workingDays} working days × {h} h = {formatHours(result.seconds, 0)} h in {formatMonth(month)}
            </p>
            <p className="num mt-1 text-3xl font-semibold">{formatRate(result.rate4)}/h</p>
            {currentRate4 > 0 && Math.abs(diff) >= 50 && (
              <p className="mt-2">
                <Chip tone={diff > 0 ? 'success' : 'warning'}>
                  {formatRate(Math.abs(diff))}/h {diff > 0 ? 'more' : 'less'} than your {formatRate(currentRate4)}/h
                </Chip>
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
