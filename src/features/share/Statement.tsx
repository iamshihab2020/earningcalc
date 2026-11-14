import { Link } from 'wouter'
import { ArrowLeft, Printer } from 'lucide-react'
import {
  formatDate,
  formatDay,
  formatHMS,
  formatHours,
  formatMonth,
  formatRange,
  formatRate,
  formatSignedUSD,
  formatUSD,
} from '@/engine'
import { useFormat, useMonthView } from '@/store/hooks'
import { useUI } from '@/store/ui'
import { Button } from '@/components/ui'
import { entryTypeLabel } from '../time/labels'

/** Print-friendly monthly statement (browser print → PDF). */
export function Statement() {
  const month = useUI((s) => s.month)
  const { summary: s, recon, settings, today } = useMonthView(month)
  const f = useFormat()
  const rows = [...s.entries].reverse()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href="/share" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary">
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Link>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> Print or save PDF
        </Button>
      </div>

      <article className="print-plain rounded-[16px] border border-line/60 bg-surface p-6 shadow-card sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">Earnings statement</p>
            <h1 className="mt-1 text-2xl font-semibold">{formatMonth(month)}</h1>
            {settings.name && <p className="mt-1 text-muted">{settings.name}</p>}
          </div>
          <p className="text-sm text-muted">Prepared {formatDate(today)}</p>
        </header>

        <section className="num grid grid-cols-2 gap-6 border-b border-line py-6 sm:grid-cols-4">
          <Item label="Hours" value={formatHMS(s.workedSeconds)} sub={`${formatHours(s.workedSeconds)} h of ${formatHours(s.targetSeconds, 0)} h`} />
          <Item label="Rate" value={`${formatRate(s.rate4)}/h`} sub={s.rateSplits.length > 1 ? `${s.rateSplits.length} rates` : undefined} />
          <Item label="Expected" value={formatUSD(recon.expectedCents)} sub={`≈ ${f.local(recon.expectedCents)}`} />
          <Item label="Paid" value={formatUSD(recon.paidCents)} sub={recon.payments.length ? `Gap ${formatSignedUSD(-recon.gapCents)}` : 'No payment yet'} />
        </section>

        {s.rateSplits.length > 1 && (
          <section className="border-b border-line py-6">
            <h2 className="mb-3 text-sm font-semibold">Earnings by rate</h2>
            <table className="num w-full text-sm">
              <tbody className="divide-y divide-line">
                {s.rateSplits.map((r) => (
                  <tr key={r.rate4}>
                    <td className="py-2">{formatRate(r.rate4, 4)}/h</td>
                    <td className="py-2 text-right">{formatHours(r.seconds)} h</td>
                    <td className="py-2 text-right font-medium">{formatUSD(r.cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="py-6">
          <h2 className="mb-3 text-sm font-semibold">Time</h2>
          <table className="num w-full text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 text-right font-medium">Duration</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {s.card && (
                <tr>
                  <td className="py-2">{formatRange(s.card.card.startDate, s.card.card.endDate)}</td>
                  <td className="py-2">Tracker total</td>
                  <td className="py-2 text-right">{formatHMS(s.card.card.seconds)}</td>
                  <td className="py-2 text-right">{formatUSD(s.card.usedCents)}</td>
                </tr>
              )}
              {rows.map((v) => (
                <tr key={v.entry.id} className={v.covered ? 'text-muted' : undefined}>
                  <td className="py-2">{formatDay(v.entry.date)}</td>
                  <td className="py-2">
                    {entryTypeLabel[v.entry.type]}
                    {v.extra ? ' (extra)' : ''}
                    {v.covered ? ' (in tracker total)' : ''}
                  </td>
                  <td className="py-2 text-right">{formatHMS(v.entry.seconds)}</td>
                  <td className="py-2 text-right">{v.covered ? '—' : formatUSD(v.cents)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="pt-3" colSpan={2}>
                  Total
                </td>
                <td className="pt-3 text-right">{formatHMS(s.workedSeconds)}</td>
                <td className="pt-3 text-right">{formatUSD(s.earnedCents)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {recon.payments.length > 0 && (
          <section className="border-t border-line py-6">
            <h2 className="mb-3 text-sm font-semibold">Payments</h2>
            <table className="num w-full text-sm">
              <tbody className="divide-y divide-line">
                {recon.payments.map(({ payment: p, usdCents }) => (
                  <tr key={p.id}>
                    <td className="py-2">{formatDate(p.date)}</td>
                    <td className="py-2">{p.note ?? 'Payment'}</td>
                    <td className="py-2 text-right font-medium">{formatUSD(usdCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="border-t border-line pt-4 text-xs text-muted">
          Amounts in USD. Local values at {settings.displaySymbol}
          {settings.exchangeRate.toFixed(2)} per $1, set {formatDate(settings.exchangeRateUpdatedAt)}; a bank's actual rate may differ.
        </footer>
      </article>
    </div>
  )
}

function Item({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wider text-muted uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  )
}
