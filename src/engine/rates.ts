import { addDays, addMonths, firstOfMonth, lastOfMonth } from './dates'
import { divRound, earnCents, fromRate4, toRate4 } from './money'
import type { ISODate, RatePeriod, YearMonth } from './types'

export const sortRates = (periods: RatePeriod[]) =>
  [...periods].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0))

/**
 * The rate period covering `date`: the latest one that starts on or before it.
 * Dates before the first period use the first period, so a freshly set rate
 * applies to everything logged before it.
 */
export function rateOn(date: ISODate, periods: RatePeriod[]): RatePeriod | null {
  if (periods.length === 0) return null
  const sorted = sortRates(periods)
  let found = sorted[0]
  for (const p of sorted) {
    if (p.effectiveFrom <= date) found = p
    else break
  }
  return found
}

export function rate4On(date: ISODate, periods: RatePeriod[]): number {
  const p = rateOn(date, periods)
  return p ? toRate4(p.amount) : 0
}

export interface DerivedRate {
  /** Unrounded earned ÷ hours, for display only. */
  exact: number
  /** Best stored rate (rate4): the fewest decimals that reproduce the tracker total. */
  rate4: number
  decimals: number
  /** Whether `rate4 × hours` lands exactly on the tracker's earned figure. */
  reproduces: boolean
}

/**
 * Rate from a tracker reading. Trackers round earnings to the cent, so the raw
 * quotient is noisy (62:41:12 / $274.57 = 4.380077…). Prefer the shortest rate
 * that reproduces the tracker's own total: that is almost always the real rate.
 */
export function deriveRate(seconds: number, earnedCents: number): DerivedRate | null {
  if (seconds <= 0) return null
  const exact = (earnedCents / 100) / (seconds / 3600)
  for (const decimals of [2, 3, 4]) {
    const step = 10 ** (4 - decimals)
    const rate4 = divRound(earnedCents * 360_000, seconds * step) * step
    if (earnCents(seconds, rate4) === earnedCents) return { exact, rate4, decimals, reproduces: true }
  }
  return { exact, rate4: divRound(earnedCents * 360_000, seconds), decimals: 4, reproduces: false }
}

/** Relative difference between two rates, e.g. 0.012 for 1.2 %. */
export function rateDifference(a4: number, b4: number): number {
  if (b4 === 0) return a4 === 0 ? 0 : Infinity
  return Math.abs(a4 - b4) / b4
}

export type RateChangeMode = 'from-date' | 'month-start' | 'whole-month'

export interface RateChange {
  id: string
  amount: number
  mode: RateChangeMode
  /** Used by `from-date`. */
  date: ISODate
  /** Used by `month-start` and `whole-month`. */
  month: YearMonth
  note?: string
}

export function effectiveDateOf(change: RateChange): ISODate {
  return change.mode === 'from-date' ? change.date : firstOfMonth(change.month)
}

/**
 * Apply a rate change and return the new rate history. A change never edits
 * an existing period; it inserts a new one, so dates before `effectiveFrom`
 * keep their old rate.
 *
 * `whole-month` additionally removes other changes inside that month so the
 * whole month uses the new rate, while preserving whatever rate was scheduled
 * to apply after the month.
 */
export function applyRateChange(periods: RatePeriod[], change: RateChange): RatePeriod[] {
  const amount = fromRate4(toRate4(change.amount))
  const effectiveFrom = effectiveDateOf(change)
  let next = sortRates(periods)

  if (change.mode === 'whole-month') {
    const monthStart = firstOfMonth(change.month)
    const monthEnd = lastOfMonth(change.month)
    const nextMonthStart = firstOfMonth(addMonths(change.month, 1))
    const rateAfter = rateOn(nextMonthStart, next)
    const removed = next.filter((p) => p.effectiveFrom > monthStart && p.effectiveFrom <= monthEnd)
    if (removed.length > 0) {
      next = next.filter((p) => !removed.includes(p))
      const hasNextStart = next.some((p) => p.effectiveFrom === nextMonthStart)
      if (rateAfter && removed.includes(rateAfter) && !hasNextStart) {
        next.push({ ...rateAfter, effectiveFrom: nextMonthStart })
      }
    }
  }

  const existing = next.find((p) => p.effectiveFrom === effectiveFrom)
  if (existing) {
    next = next.map((p) => (p === existing ? { ...p, amount, note: change.note ?? p.note } : p))
  } else {
    next.push({ id: change.id, amount, effectiveFrom, note: change.note })
  }
  return sortRates(next)
}

/** Each period with the last date it applies to (null = still current). */
export function rateTimeline(periods: RatePeriod[]): Array<RatePeriod & { until: ISODate | null }> {
  const sorted = sortRates(periods)
  return sorted.map((p, i) => ({ ...p, until: i < sorted.length - 1 ? addDays(sorted[i + 1].effectiveFrom, -1) : null }))
}
