import { buildScenarios } from './projection'
import { summarizeMonth, type MonthInput } from './month'
import type { RatePeriod, YearMonth } from './types'

export interface MonthImpact {
  month: YearMonth
  beforeCents: number
  afterCents: number
  beforeProjectedCents: number
  afterProjectedCents: number
}

/**
 * What a rate-history edit would change, month by month. Used for the
 * confirmation sheet so the user sees exact dates and amounts before saving.
 */
export function rateChangeImpact(
  months: YearMonth[],
  input: Omit<MonthInput, 'rates'>,
  before: RatePeriod[],
  after: RatePeriod[],
): MonthImpact[] {
  const out: MonthImpact[] = []
  for (const month of [...new Set(months)].sort()) {
    const a = summarizeMonth(month, { ...input, rates: before })
    const b = summarizeMonth(month, { ...input, rates: after })
    const pa = buildScenarios(a, before).normal.cents
    const pb = buildScenarios(b, after).normal.cents
    if (a.earnedCents !== b.earnedCents || pa !== pb) {
      out.push({ month, beforeCents: a.earnedCents, afterCents: b.earnedCents, beforeProjectedCents: pa, afterProjectedCents: pb })
    }
  }
  return out
}
