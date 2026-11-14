import { earnCents, impliedRate4 } from './money'
import { monthWorkingDays } from './schedule'
import type { Schedule, YearMonth } from './types'

export interface OfferResult {
  workingDays: number
  seconds: number
  rate4: number
}

/** "$800 for January at 8 h/day" → implied hourly rate. */
export function offerRate(amountCents: number, month: YearMonth, hoursPerDay: number, schedule: Schedule): OfferResult {
  const workingDays = monthWorkingDays(month, schedule).length
  const seconds = workingDays * Math.round(hoursPerDay * 3600)
  return { workingDays, seconds, rate4: impliedRate4(amountCents, seconds) }
}

/** Month total in cents for each candidate rate over the same hours. */
export function compareRates(rate4s: number[], seconds: number): number[] {
  return rate4s.map((r) => earnCents(seconds, r))
}
