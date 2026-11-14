import { Pencil, Plus, Wallet } from 'lucide-react'
import {
  convertCents,
  formatHours,
  formatLocal,
  formatMonth,
  formatRate,
  formatShortDate,
  formatUSD,
  rateDifference,
} from '@/engine'
import { useData } from '@/store/data'
import { useFormat, useMonthView } from '@/store/hooks'
import { useUI } from '@/store/ui'
import { MonthSelector } from '@/components/MonthSelector'
import { Button, Card, CardHeader, EmptyState, Notice, PageHeader } from '@/components/ui'
import { PaymentChip } from '../shared'

export function Payments() {
  const month = useUI((s) => s.month)
  const setPaymentOpen = useUI((s) => s.setPaymentOpen)
  const { summary: s, recon } = useMonthView(month)
  const f = useFormat()
  const settings = useData((st) => st.settings)

  const gapAbs = Math.abs(recon.gapCents)
  const implied = recon.impliedRate4
  const rateGap = implied > 0 && s.rate4 > 0 ? rateDifference(implied, s.rate4) : 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Payments"
        subtitle="Check what you were paid against what you earned."
        action={
          <Button variant="primary" onClick={() => setPaymentOpen(true)}>
            <Plus className="size-4" aria-hidden /> Record payment
          </Button>
        }
      />
      <MonthSelector />

      <Card>
        <CardHeader title={`Reconciliation · ${formatMonth(month)}`} action={<PaymentChip recon={recon} />} />
        <div className="grid gap-4 px-5 pt-4 pb-5 sm:grid-cols-3">
          <Figure label="Expected" cents={recon.expectedCents} sub={`${formatHours(s.workedSeconds)} h from entries and rates`} />
          <Figure label="Paid" cents={recon.paidCents} sub={`${recon.payments.length} payment${recon.payments.length === 1 ? '' : 's'}`} />
          <div className="flex flex-col gap-1 rounded-[12px] bg-surface-2 p-4">
            <span className="text-xs font-semibold tracking-wider text-muted uppercase">
              {recon.gapCents > 0 ? 'Still owed' : recon.gapCents < 0 ? 'Paid extra' : 'Gap'}
            </span>
            <span className={`num text-2xl font-semibold ${recon.gapCents > 0 ? 'text-warning-text' : recon.gapCents < 0 ? 'text-success-text' : ''}`}>
              {formatUSD(gapAbs)}
            </span>
            <span className="num text-sm text-fg">
              ≈ {formatLocal(convertCents(gapAbs, settings.exchangeRate), settings.displaySymbol)} · {formatHours(Math.abs(recon.gapSeconds))} h at{' '}
              {formatRate(s.rate4)}/h
            </span>
          </div>
        </div>
        {recon.status !== 'none' && implied > 0 && (
          <div className="border-t border-line px-5 py-4">
            <p className="text-[0.9375rem]">
              Your payment matches <strong className="num">{formatRate(implied)}/h</strong> for{' '}
              <strong className="num">{formatHours(s.workedSeconds)} h</strong>.
              {rateGap > 0.01 && (
                <span className="text-muted">
                  {' '}
                  That is {formatRate(Math.abs(implied - s.rate4))}/h {implied > s.rate4 ? 'more' : 'less'} than your rate of {formatRate(s.rate4)}/h
                  {implied < s.rate4 ? ', so a different rate may have been used.' : '.'}
                </span>
              )}
            </p>
          </div>
        )}
      </Card>

      {recon.status === 'short' && (
        <Notice tone="warning">
          You are short {formatUSD(recon.gapCents)}, which is {formatHours(recon.gapSeconds, 1)} h of work at {formatRate(s.rate4)}/h. The{' '}
          <a href="#/share" className="font-semibold underline">
            message generator
          </a>{' '}
          can write this up for your manager.
        </Notice>
      )}

      <Card>
        <CardHeader title={`Payments for ${formatMonth(month)}`} />
        {recon.payments.length === 0 ? (
          <EmptyState
            icon={<Wallet className="size-6" />}
            title="No payment recorded"
            action={
              <Button variant="primary" onClick={() => setPaymentOpen(true)}>
                Record payment
              </Button>
            }
          >
            When money arrives, record it here to see whether it matches what you earned.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line px-2 py-2">
            {recon.payments.map(({ payment: p, usdCents }) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPaymentOpen(true, p)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-[12px] px-3 text-left hover:bg-surface-2"
                >
                  <span className="w-20 shrink-0 text-sm text-muted">{formatShortDate(p.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{p.note || 'Payment'}</span>
                  <span className="num text-right">
                    <span className="block font-semibold">{formatUSD(usdCents)}</span>
                    {p.currency !== 'USD' && (
                      <span className="block text-xs text-muted">
                        {settings.displaySymbol}
                        {(p.amountCents / 100).toLocaleString('en-US')} at {p.exchangeRate}
                      </span>
                    )}
                    {p.currency === 'USD' && <span className="block text-xs text-muted">≈ {f.local(usdCents)}</span>}
                  </span>
                  <Pencil className="size-4 shrink-0 text-muted" aria-hidden />
                </button>
              </li>
            ))}
            <li className="num flex justify-between px-3 pt-3 pb-1 text-sm font-semibold">
              <span>Total</span>
              <span>{formatUSD(recon.paidCents)}</span>
            </li>
          </ul>
        )}
      </Card>
    </div>
  )
}

function Figure({ label, cents, sub }: { label: string; cents: number; sub: string }) {
  const f = useFormat()
  return (
    <div className="flex flex-col gap-1 p-1 sm:p-4">
      <span className="text-xs font-semibold tracking-wider text-muted uppercase">{label}</span>
      <span className="num text-2xl font-semibold">{formatUSD(cents)}</span>
      <span className="num text-sm text-muted">≈ {f.local(cents)}</span>
      <span className="text-sm text-muted">{sub}</span>
    </div>
  )
}
