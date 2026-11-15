import { formatMonth, formatRange, formatShortDate } from './dates'
import { formatHMS, formatHours, formatHoursShort } from './duration'
import { convertCents, formatLocal, formatRate, formatSignedUSD, formatUSD } from './money'
import type { MonthSummary } from './month'
import type { Reconciliation } from './reconcile'
import { rateDifference } from './rates'

export interface MessageInput {
  name?: string
  summary: MonthSummary
  recon: Reconciliation
  fx: number
  symbol: string
}

const hoursLine = (label: string, seconds: number) => `• ${label}: ${formatHMS(seconds)} (${formatHours(seconds)} h)`

/** Suggested questions for the manager, based on what the numbers show. */
export function suggestQuestions({ summary, recon }: Pick<MessageInput, 'summary' | 'recon'>): string[] {
  const qs: string[] = []
  if (recon.status === 'short') {
    qs.push(
      `Could you check the remaining ${formatUSD(recon.gapCents)} (${formatHoursShort(recon.gapSeconds)} at ${formatRate(summary.rate4)}/h)?`,
    )
  }
  if (recon.status === 'paid' && recon.gapCents < 0) {
    qs.push(`I received ${formatUSD(-recon.gapCents)} more than my calculation. Is that a bonus, overtime, or an advance?`)
  }
  if (recon.impliedRate4 > 0 && rateDifference(recon.impliedRate4, summary.rate4) > 0.01) {
    qs.push(`The payment works out to ${formatRate(recon.impliedRate4)}/h. Was a rate other than ${formatRate(summary.rate4)}/h used?`)
  }
  if (summary.seconds.backfill > 0) {
    qs.push(`Can you confirm the ${formatHoursShort(summary.seconds.backfill)} of backfilled time is included?`)
  }
  return qs
}

/** Slack-friendly summary: Hours, Rate, Payment, Questions. */
export function buildMessage(input: MessageInput): string {
  const { summary: s, recon: r, fx, symbol } = input
  const local = (cents: number) => formatLocal(convertCents(cents, fx), symbol)
  const lines: string[] = []

  const range = s.start.endsWith('-01') ? '' : ` (${formatRange(s.start, s.end)})`
  lines.push(`*Earnings summary — ${formatMonth(s.month)}${range}*${input.name ? ` (${input.name})` : ''}`, '')
  lines.push('*Hours*')
  if (s.seconds.card) lines.push(hoursLine('Tracked (tracker total)', s.seconds.card))
  if (s.seconds.tracked) lines.push(hoursLine(s.seconds.card ? 'Tracked (other days)' : 'Tracked', s.seconds.tracked))
  if (s.seconds.backfill) lines.push(hoursLine('Backfill', s.seconds.backfill))
  if (s.seconds.adjustment) lines.push(hoursLine('Adjustments', s.seconds.adjustment))
  lines.push(`${hoursLine('Total', s.workedSeconds)} of ${formatHoursShort(s.targetSeconds, 2)} target`, '')

  lines.push('*Rate*')
  if (s.rateSplits.length > 1) {
    for (const seg of s.rateSplits) lines.push(`• ${formatRate(seg.rate4)}/h × ${formatHours(seg.seconds)} h = ${formatUSD(seg.cents)}`)
  } else {
    lines.push(`• ${formatRate(s.rate4)}/h`)
  }
  lines.push(`• Expected: ${formatUSD(s.earnedCents)} (≈ ${local(s.earnedCents)})`, '')

  lines.push('*Payment*')
  if (r.payments.length === 0) {
    lines.push('• No payment received yet')
  } else {
    const parts = r.payments.map((p) => `${formatUSD(p.usdCents)} on ${formatShortDate(p.payment.date)}`)
    lines.push(`• Received: ${formatUSD(r.paidCents)}${r.payments.length > 1 ? ` (${parts.join(', ')})` : ` on ${formatShortDate(r.payments[0].payment.date)}`}`)
    const verdict = r.gapCents > 0 ? 'short' : r.gapCents < 0 ? 'more than expected' : 'matches'
    lines.push(`• Difference: ${formatSignedUSD(-r.gapCents)} (${verdict})`)
  }

  const questions = suggestQuestions(input)
  if (questions.length) {
    lines.push('', '*Questions*')
    for (const q of questions) lines.push(`• ${q}`)
  }
  return lines.join('\n')
}
