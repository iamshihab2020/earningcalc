import { earnCents } from './money'
import { rate4On } from './rates'
import type { MonthSummary } from './month'
import type { ISODate, RatePeriod } from './types'

export interface Outcome {
  seconds: number
  cents: number
}

/** Value `secondsPerDay` on each of `days`, each at the rate in force that day. */
export function valueDays(days: ISODate[], secondsPerDay: number, rates: RatePeriod[]): Outcome {
  let cents = 0
  for (const d of days) cents += earnCents(secondsPerDay, rate4On(d, rates))
  return { seconds: days.length * secondsPerDay, cents }
}

const plus = (a: Outcome, b: Outcome): Outcome => ({ seconds: a.seconds + b.seconds, cents: a.cents + b.cents })

export interface Scenarios {
  /** A — where I am now. */
  now: Outcome
  /** C — work `nextDayHours` on the next remaining working day, then stop. */
  nextDayOnly: Outcome & { date: ISODate | null; addedSeconds: number }
  /** D — `hoursPerDay` on every remaining working day. */
  keepGoing: Outcome & { days: number; secondsPerDay: number }
  /** E — the standard month: every working day at the daily target. */
  standard: Outcome
  /** Projection at the daily target (what the dashboard headlines). */
  normal: Outcome
  /** Normal-pace projection minus the standard target. Positive = ahead. */
  aheadSeconds: number
}

export interface ScenarioOptions {
  hoursPerDay?: number
  nextDayHours?: number
}

export function buildScenarios(summary: MonthSummary, rates: RatePeriod[], opts: ScenarioOptions = {}): Scenarios {
  const daily = summary.dailyTargetSeconds
  const perDay = opts.hoursPerDay === undefined ? daily : Math.round(opts.hoursPerDay * 3600)
  const nextDaySeconds = opts.nextDayHours === undefined ? daily : Math.round(opts.nextDayHours * 3600)
  const now = { seconds: summary.workedSeconds, cents: summary.earnedCents }
  const nextDate = summary.remainingDays[0] ?? null

  const normal = plus(now, valueDays(summary.remainingDays, daily, rates))
  return {
    now,
    nextDayOnly: {
      ...plus(now, nextDate ? valueDays([nextDate], nextDaySeconds, rates) : { seconds: 0, cents: 0 }),
      date: nextDate,
      addedSeconds: nextDate ? nextDaySeconds : 0,
    },
    keepGoing: {
      ...plus(now, valueDays(summary.remainingDays, perDay, rates)),
      days: summary.remainingDays.length,
      secondsPerDay: perDay,
    },
    standard: valueDays(summary.workingDays, daily, rates),
    normal,
    aheadSeconds: normal.seconds - summary.targetSeconds,
  }
}

export interface PaceCheck {
  cents: number
  normalSeconds: number
  /** Worked minus normal pace for those days. Positive = ahead. */
  aheadSeconds: number
}

/** B — "I worked 20 h in 2 days": value of those hours and pace vs normal. */
export function paceCheck(workedSeconds: number, days: number, dailyTargetSeconds: number, rate4: number): PaceCheck {
  const normalSeconds = days * dailyTargetSeconds
  return { cents: earnCents(workedSeconds, rate4), normalSeconds, aheadSeconds: workedSeconds - normalSeconds }
}
