import { Link } from 'wouter'
import { ArrowRight, Calculator, Clock, Minus, Plus, Receipt, Sparkles, Wallet } from 'lucide-react'
import {
  formatDay,
  formatHours,
  formatMonth,
  formatRange,
  formatRate,
  formatShortDate,
  formatUSD,
  rateOn,
} from '@/engine'
import { hasAnyData, loadSample, useData } from '@/store/data'
import { useFormat, useMonthView } from '@/store/hooks'
import { useUI } from '@/store/ui'
import { MonthSelector } from '@/components/MonthSelector'
import { Button, Card, CardHeader, EmptyState, Notice, Stat, Switch, cn } from '@/components/ui'
import { AheadChip, CardMismatch, Duration, Money, PaymentChip, ScenarioCard } from '../shared'
import { entryTypeLabel } from '../time/labels'

export function Dashboard() {
  const month = useUI((s) => s.month)
  const hasData = useData(hasAnyData)
  if (!hasData) return <Welcome />
  return <MonthDashboard month={month} />
}

function Welcome() {
  const openAddTime = useUI((s) => s.openAddTime)
  const openRateChange = useUI((s) => s.openRateChange)
  return (
    <div className="mx-auto max-w-xl pt-6 lg:pt-16">
      <Card className="overflow-hidden">
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="Know what you've earned, at a glance"
          action={
            <>
              <Button variant="primary" onClick={() => openAddTime({ tab: 'card' })}>
                Enter tracker total
              </Button>
              <Button onClick={() => openRateChange()}>Set hourly rate</Button>
            </>
          }
        >
          Add your first entry or enter your tracker total. Paste the time and amount from your tracker's schedule card and the
          app works out your real rate, this month's total and your month-end projection.
        </EmptyState>
        <div className="border-t border-line bg-surface-2/60 px-5 py-4 text-center text-sm">
          <span className="text-fg">Just looking?</span>{' '}
          <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => loadSample()}>
            Load sample data
          </button>{' '}
          <span className="text-fg">from the October and November 2026 examples.</span>
        </div>
      </Card>
      <p className="mt-4 text-center text-sm text-muted">Everything stays on this device. No account, no tracking.</p>
    </div>
  )
}

function MonthDashboard({ month }: { month: string }) {
  const view = useMonthView(month)
  const { summary: s, scenarios: sc, recon, today, settings, rates } = view
  const f = useFormat()
  const { openAddTime, setPaymentOpen, openRateChange, projectionHours, setProjectionHours } = useUI()
  const updateSettings = useData((st) => st.updateSettings)

  const isCurrent = today.slice(0, 7) === month
  const isPast = today.slice(0, 7) > month
  const hoursPerDay = projectionHours ?? settings.dailyTargetHours
  const pct = s.targetSeconds ? Math.min(100, Math.round((s.workedSeconds / s.targetSeconds) * 100)) : 0
  const ahead = isPast ? s.workedSeconds - s.targetSeconds : sc.aheadSeconds
  const period = rateOn(s.refDate, rates)
  const recent = s.entries.slice(0, 5)

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <div className="flex items-center justify-between gap-2">
        <MonthSelector />
      </div>

      {rates.length === 0 && (
        <Notice tone="warning">
          Set your hourly rate to see earnings.{' '}
          <button type="button" className="font-semibold underline" onClick={() => openRateChange()}>
            Set rate
          </button>
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        {/* Hero */}
        <Card className="p-5 sm:p-6 lg:col-span-8" data-testid="hero">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">
              {isCurrent ? 'Earned this month' : `Earned in ${formatMonth(month)}`}
            </h2>
            <AheadChip seconds={ahead} />
          </div>
          <div aria-live="polite" className="mt-3">
            <Money cents={s.earnedCents} size="lg" animate />
          </div>
          <div className="mt-6">
            <div
              className="h-3 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-label="Hours worked against this month's target"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="num mt-2 flex justify-between text-sm text-muted">
              <span>
                <span className="font-medium text-fg">{formatHours(s.workedSeconds, 1)}</span> / {formatHours(s.targetSeconds, 0)} h
                target
              </span>
              <span>{pct}%</span>
            </div>
          </div>
        </Card>

        {/* Payment */}
        <Card className="flex flex-col lg:col-span-4">
          <CardHeader
            title="Payment"
            action={
              <Link href="/payments" className="-mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary">
                Details <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
          <div className="flex flex-1 flex-col justify-between gap-4 px-5 pt-3 pb-5">
            <dl className="num grid grid-cols-2 gap-3">
              <div>
                <dt className="text-sm text-muted">Expected</dt>
                <dd className="text-lg font-semibold">{formatUSD(recon.expectedCents)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Paid</dt>
                <dd className="text-lg font-semibold">{formatUSD(recon.paidCents)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center gap-2">
              <PaymentChip recon={recon} />
              {recon.status === 'paid' && recon.gapCents < 0 && (
                <span className="num text-sm text-muted">+{formatUSD(-recon.gapCents)} over</span>
              )}
            </div>
          </div>
        </Card>
      </div>

      {s.card && <CardMismatch card={s.card} />}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
        <Stat label="Hours tracked" value={<Duration seconds={s.workedSeconds} />} sub={`${formatHours(s.workedSeconds)} h`} />
        <Stat
          label="Hourly rate"
          value={rates.length ? `${formatRate(s.rate4)}` : '—'}
          sub={
            s.rateSplits.length > 1
              ? `${s.rateSplits.length} rates this month`
              : period
                ? `since ${formatShortDate(period.effectiveFrom)}`
                : 'not set'
          }
        />
        <Stat
          label="Days left"
          value={s.remainingDays.length}
          sub={isPast ? 'month ended' : isCurrent ? (settings.countTodayAsWorked ? 'workdays from tomorrow' : 'workdays incl. today') : 'workdays in month'}
        />
        <Stat label="Projected total" value={formatUSD(sc.keepGoing.cents)} sub={`≈ ${f.local(sc.keepGoing.cents)}`} />
      </div>

      {/* Projection note */}
      {!isPast && (
        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-[0.9375rem] leading-relaxed" aria-live="polite">
              At <strong className="num">{hoursPerDay} h/day</strong> for the{' '}
              <strong className="num">{sc.keepGoing.days}</strong> remaining working day{sc.keepGoing.days === 1 ? '' : 's'}, you'll
              finish {formatMonth(month)} with <strong className="num">{formatUSD(sc.keepGoing.cents)}</strong>{' '}
              <span className="num text-muted">({formatHours(sc.keepGoing.seconds)} h)</span>.
              {sc.aheadSeconds >= 180 && (
                <span className="text-success-text"> You are {formatHours(sc.aheadSeconds, 1)} h ahead of the standard monthly target.</span>
              )}
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-4">
              <HoursStepper value={hoursPerDay} onChange={(h) => setProjectionHours(h === settings.dailyTargetHours ? null : h)} />
            </div>
          </div>
          {isCurrent && (
            <div className="mt-3 border-t border-line pt-2">
              <Switch
                checked={settings.countTodayAsWorked}
                onCheckedChange={(v) => updateSettings({ countTodayAsWorked: v })}
                label="Count today as worked"
                description={settings.countTodayAsWorked ? 'Remaining days start tomorrow' : 'Today is still counted as a remaining day'}
              />
            </div>
          )}
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <QuickAction icon={Clock} label="Add time" onClick={() => openAddTime()} />
        <QuickAction icon={Wallet} label="Record payment" onClick={() => setPaymentOpen(true)} />
        <QuickAction icon={Calculator} label="What-if" href="/what-if" />
      </div>

      {/* Scenarios */}
      {!isPast && (
        <section aria-labelledby="scenarios" className="flex flex-col gap-3">
          <div className="flex items-end justify-between">
            <h2 id="scenarios" className="text-xs font-semibold tracking-wider text-muted uppercase">
              Month-end scenarios
            </h2>
            <Link href="/what-if" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary">
              More <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:gap-6">
            <ScenarioCard
              label="C"
              title={sc.nextDayOnly.date ? `${formatShortDate(sc.nextDayOnly.date)} only, then stop` : 'One more day'}
              cents={sc.nextDayOnly.cents}
              seconds={sc.nextDayOnly.seconds}
              detail={`+${formatHours(sc.nextDayOnly.addedSeconds, 0)} h`}
            />
            <ScenarioCard
              label="D"
              title="Keep going"
              cents={sc.keepGoing.cents}
              seconds={sc.keepGoing.seconds}
              detail={`${hoursPerDay} h × ${sc.keepGoing.days} days`}
              highlight
            />
            <ScenarioCard
              label="E"
              title="Standard month"
              cents={sc.standard.cents}
              seconds={sc.standard.seconds}
              detail={`${s.workingDays.length} days × ${settings.dailyTargetHours} h`}
            />
          </div>
        </section>
      )}

      {/* Recent */}
      <Card>
        <CardHeader
          title="Recent entries"
          action={
            <Link href="/time" className="-mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary">
              Time log <ArrowRight className="size-4" aria-hidden />
            </Link>
          }
        />
        {recent.length === 0 && !s.card ? (
          <EmptyState icon={<Receipt className="size-6" />} title="Nothing logged this month">
            Add your first entry or enter your tracker total.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line px-2 pt-2 pb-2">
            {s.card && (
              <li>
                <button
                  type="button"
                  onClick={() => openAddTime({ editingCard: s.card!.card })}
                  className="flex min-h-14 w-full items-center gap-3 rounded-[12px] px-3 text-left hover:bg-surface-2"
                >
                  <span className="w-28 shrink-0 text-sm text-muted">{formatRange(s.card.card.startDate, s.card.card.endDate)}</span>
                  <Duration seconds={s.card.card.seconds} className="flex-1 font-medium" />
                  <span className="hidden text-sm text-muted sm:inline">Tracker total</span>
                  <span className="num w-24 text-right font-medium">{formatUSD(s.card.usedCents)}</span>
                </button>
              </li>
            )}
            {recent.map((v) => (
              <li key={v.entry.id}>
                <button
                  type="button"
                  onClick={() => openAddTime({ editing: v.entry })}
                  className={cn('flex min-h-14 w-full items-center gap-3 rounded-[12px] px-3 text-left hover:bg-surface-2', v.covered && 'opacity-60')}
                >
                  <span className="w-28 shrink-0 text-sm text-muted">{formatDay(v.entry.date)}</span>
                  <Duration seconds={v.entry.seconds} className="flex-1 font-medium" />
                  <span className="hidden text-sm text-muted sm:inline">{entryTypeLabel[v.entry.type]}</span>
                  <span className="num w-24 text-right font-medium">{v.covered ? '—' : formatUSD(v.cents)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function QuickAction({ icon: Icon, label, onClick, href }: { icon: typeof Clock; label: string; onClick?: () => void; href?: string }) {
  const cls =
    'flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-[16px] border border-line/60 bg-surface p-3 text-center text-sm font-medium shadow-card transition hover:border-primary/40 hover:text-primary'
  const inner = (
    <>
      <Icon className="size-5 text-primary" aria-hidden />
      {label}
    </>
  )
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  )
}

export function HoursStepper({ value, onChange, label = 'Hours per remaining day' }: { value: number; onChange: (v: number) => void; label?: string }) {
  const clamp = (v: number) => Math.max(0, Math.min(24, Math.round(v * 2) / 2))
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <Button size="icon" aria-label="Fewer hours" onClick={() => onChange(clamp(value - 0.5))} disabled={value <= 0}>
        <Minus className="size-4" />
      </Button>
      <label className="sr-only" htmlFor="hours-per-day">
        {label}
      </label>
      <input
        id="hours-per-day"
        type="number"
        inputMode="decimal"
        min={0}
        max={24}
        step={0.5}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onChange(Math.max(0, Math.min(24, v)))
        }}
        className="num h-11 w-16 rounded-[12px] border border-line bg-surface text-center text-base font-semibold focus:border-primary focus:ring-2 focus:ring-primary/40 focus:outline-none"
      />
      <Button size="icon" aria-label="More hours" onClick={() => onChange(clamp(value + 0.5))} disabled={value >= 24}>
        <Plus className="size-4" />
      </Button>
      <span className="text-sm text-muted">h/day</span>
    </div>
  )
}
