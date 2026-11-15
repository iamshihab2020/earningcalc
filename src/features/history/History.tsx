import { useMemo, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLocation } from 'wouter'
import { ChevronRight, FileSpreadsheet, History as HistoryIcon, Plus } from 'lucide-react'
import { addMonths, buildHistory, formatHours, formatUSD, historyToCSV, ordinal, type HistoryRow } from '@/engine'
import { useData } from '@/store/data'
import { useFormat, usePeriod, useSchedule, useToday } from '@/store/hooks'
import { useUI } from '@/store/ui'
import { Button, Card, CardHeader, Chip, EmptyState, PageHeader } from '@/components/ui'
import { Duration, PaymentChip, UncountedCardsNotice } from '@/features/shared'
import { downloadText } from '@/lib/download'

/** Every pay period logged so far: hours, earned, paid, and all-time totals. */
export function History() {
  const { rates, entries, periodTotals, payments, settings } = useData(
    useShallow((s) => ({ rates: s.rates, entries: s.entries, periodTotals: s.periodTotals, payments: s.payments, settings: s.settings })),
  )
  const schedule = useSchedule()
  const today = useToday()
  const period = usePeriod()
  const f = useFormat()
  const { setMonth, openAddTime } = useUI(useShallow((s) => ({ setMonth: s.setMonth, openAddTime: s.openAddTime })))
  const [, navigate] = useLocation()

  const history = useMemo(
    () =>
      buildHistory({
        rates,
        entries,
        periodTotals,
        payments,
        schedule,
        today,
        countTodayAsWorked: settings.countTodayAsWorked,
        fx: settings.exchangeRate,
      }),
    [rates, entries, periodTotals, payments, schedule, today, settings.countTodayAsWorked, settings.exchangeRate],
  )
  const { rows, totals } = history
  const hasData = rows.some((r) => r.workedSeconds !== 0 || r.paidCents !== 0)
  const oldest = rows[rows.length - 1]?.month ?? period.current

  const open = (r: HistoryRow) => {
    setMonth(r.month)
    navigate('/')
  }
  /** Open the tracker-total form on the period before the oldest one logged. */
  const addEarlier = () => {
    setMonth(hasData ? addMonths(oldest, -1) : period.current)
    openAddTime({ tab: 'card' })
  }

  const balance = totals.gapCents
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="History"
        subtitle={period.custom ? `Every pay period (${ordinal(period.startDay)} to ${ordinal(period.startDay - 1)}) you've logged.` : "Every month you've logged."}
        action={
          <Button onClick={addEarlier}>
            <Plus className="size-4" aria-hidden /> Add earlier period
          </Button>
        }
      />

      <UncountedCardsNotice />

      {!hasData ? (
        <Card>
          <EmptyState
            icon={<HistoryIcon className="size-6" />}
            title="Nothing logged yet"
            action={
              <Button variant="primary" onClick={addEarlier}>
                Enter a tracker total
              </Button>
            }
          >
            Enter what you've earned so far, one period at a time: the total time and amount from your tracker for each pay
            period. They'll add up here.
          </EmptyState>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="All time" hint={`${rows.length} period${rows.length === 1 ? '' : 's'}`} />
            <dl className="num grid grid-cols-2 gap-4 px-5 pt-4 pb-5 sm:grid-cols-4">
              <Total label="Earned" value={formatUSD(totals.earnedCents)} sub={`≈ ${f.local(totals.earnedCents)}`} />
              <Total label="Paid" value={formatUSD(totals.paidCents)} sub={`≈ ${f.local(totals.paidCents)}`} />
              <Total
                label={balance > 0 ? 'Still owed' : balance < 0 ? 'Paid extra' : 'Balance'}
                value={formatUSD(Math.abs(balance))}
                sub={balance === 0 ? 'All settled' : `≈ ${f.local(Math.abs(balance))}`}
                tone={balance > 0 ? 'text-warning-text' : balance < 0 ? 'text-success-text' : undefined}
              />
              <Total label="Hours" value={formatHours(totals.workedSeconds, 1)} sub={<Duration seconds={totals.workedSeconds} />} />
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="By period"
              action={
                <Button size="sm" variant="ghost" onClick={() => downloadText(`earnings-history-${today}.csv`, historyToCSV(history), 'text/csv')}>
                  <FileSpreadsheet className="size-4" aria-hidden /> CSV
                </Button>
              }
            />
            <ul className="divide-y divide-line px-2 py-2">
              {rows.map((r) => (
                <li key={r.month}>
                  <button
                    type="button"
                    onClick={() => open(r)}
                    className="flex min-h-16 w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left hover:bg-surface-2"
                    aria-label={`${period.label(r.month)}: earned ${formatUSD(r.earnedCents)}, paid ${formatUSD(r.paidCents)}. Open on dashboard`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold whitespace-nowrap">{period.name(r.month)}</span>
                        {r.current && (
                          <Chip tone="info" icon={false} className="px-2 py-0 text-xs">
                            Current
                          </Chip>
                        )}
                      </span>
                      <span className="num text-sm text-muted">
                        {period.range(r.month) ? `${period.range(r.month)} · ` : ''}
                        {formatHours(r.workedSeconds, 1)} h
                      </span>
                      <span className="sm:hidden">
                        <PaymentChip recon={r} />
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="num font-semibold">{formatUSD(r.earnedCents)}</span>
                      <span className="max-sm:hidden">
                        <PaymentChip recon={r} />
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}

function Total({ label, value, sub, tone }: { label: string; value: string; sub?: ReactNode; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs font-semibold tracking-wider text-muted uppercase">{label}</dt>
      <dd className={`truncate text-xl font-semibold tracking-tight sm:text-2xl ${tone ?? ''}`}>{value}</dd>
      {sub && <dd className="truncate text-sm text-muted">{sub}</dd>}
    </div>
  )
}
