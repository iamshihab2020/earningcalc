import { formatMonth, formatRange, periodOf } from './dates'
import { formatHMS, formatHours } from './duration'
import { summarizeMonth, type MonthInput } from './month'
import { reconcile, type PaymentStatus } from './reconcile'
import type { ISODate, Payment, YearMonth } from './types'

export interface HistoryRow {
  month: YearMonth
  start: ISODate
  end: ISODate
  workedSeconds: number
  earnedCents: number
  paidCents: number
  /** earned − paid. Positive = still owed. */
  gapCents: number
  status: PaymentStatus
  /** The period that contains today. */
  current: boolean
}

export interface History {
  /** Newest first. Only periods with time, a tracker total or a payment, plus the current one. */
  rows: HistoryRow[]
  totals: { workedSeconds: number; earnedCents: number; paidCents: number; gapCents: number }
}

/** Every pay period with data, valued and reconciled, plus all-time totals. */
export function buildHistory(input: MonthInput & { payments: Payment[]; fx: number }): History {
  const startDay = input.schedule.periodStartDay ?? 1
  const current = periodOf(input.today, startDay)
  const keys = new Set<YearMonth>([current])
  for (const e of input.entries) keys.add(periodOf(e.date, startDay))
  for (const c of input.periodTotals) keys.add(periodOf(c.endDate, startDay))
  for (const p of input.payments) keys.add(p.month)

  const rows = [...keys]
    .sort()
    .reverse()
    .map((month): HistoryRow => {
      const s = summarizeMonth(month, input)
      const r = reconcile({
        month,
        expectedCents: s.earnedCents,
        workedSeconds: s.workedSeconds,
        rate4: s.rate4,
        payments: input.payments,
        fx: input.fx,
      })
      return {
        month,
        start: s.start,
        end: s.end,
        workedSeconds: s.workedSeconds,
        earnedCents: s.earnedCents,
        paidCents: r.paidCents,
        gapCents: r.gapCents,
        status: r.status,
        current: month === current,
      }
    })

  const totals = rows.reduce(
    (t, r) => ({
      workedSeconds: t.workedSeconds + r.workedSeconds,
      earnedCents: t.earnedCents + r.earnedCents,
      paidCents: t.paidCents + r.paidCents,
      gapCents: t.gapCents + r.gapCents,
    }),
    { workedSeconds: 0, earnedCents: 0, paidCents: 0, gapCents: 0 },
  )
  return { rows, totals }
}

/** The history as CSV, oldest first, with a total row. */
export function historyToCSV(history: History): string {
  const usd = (c: number) => (c / 100).toFixed(2)
  const lines = [['period', 'from', 'to', 'duration', 'hours', 'earned_usd', 'paid_usd', 'gap_usd', 'status'].join(',')]
  for (const r of [...history.rows].reverse()) {
    lines.push(
      [
        `"${formatMonth(r.month)}${r.start.endsWith('-01') ? '' : ` (${formatRange(r.start, r.end)})`}"`,
        r.start,
        r.end,
        formatHMS(r.workedSeconds),
        formatHours(r.workedSeconds, 4),
        usd(r.earnedCents),
        usd(r.paidCents),
        usd(r.gapCents),
        r.status,
      ].join(','),
    )
  }
  const t = history.totals
  lines.push(['"Total"', '', '', formatHMS(t.workedSeconds), formatHours(t.workedSeconds, 4), usd(t.earnedCents), usd(t.paidCents), usd(t.gapCents), ''].join(','))
  return lines.join('\n') + '\n'
}
