import { centsToSeconds, impliedRate4, toUsdCents } from './money'
import type { Payment, YearMonth } from './types'

export type PaymentStatus = 'none' | 'paid' | 'short'

export interface Reconciliation {
  expectedCents: number
  paidCents: number
  /** expected − paid. Positive = still owed, negative = paid more. */
  gapCents: number
  /** The gap in hours at the reference rate. */
  gapSeconds: number
  status: PaymentStatus
  /** paid ÷ hours worked. 0 when nothing was paid or worked. */
  impliedRate4: number
  payments: Array<{ payment: Payment; usdCents: number }>
}

/** A payment's value in USD cents. Non-USD payments use their stored rate. */
export function paymentUsdCents(p: Payment, fallbackFx: number): number {
  if (p.currency === 'USD') return p.amountCents
  return toUsdCents(p.amountCents, p.exchangeRate ?? fallbackFx)
}

export function reconcile(args: {
  month: YearMonth
  expectedCents: number
  workedSeconds: number
  rate4: number
  payments: Payment[]
  fx: number
}): Reconciliation {
  const payments = args.payments
    .filter((p) => p.month === args.month)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((payment) => ({ payment, usdCents: paymentUsdCents(payment, args.fx) }))
  const paidCents = payments.reduce((s, p) => s + p.usdCents, 0)
  const gapCents = args.expectedCents - paidCents
  const status: PaymentStatus = payments.length === 0 ? 'none' : gapCents <= 0 ? 'paid' : 'short'
  return {
    expectedCents: args.expectedCents,
    paidCents,
    gapCents,
    gapSeconds: centsToSeconds(gapCents, args.rate4),
    status,
    impliedRate4: paidCents > 0 ? impliedRate4(paidCents, args.workedSeconds) : 0,
    payments,
  }
}
