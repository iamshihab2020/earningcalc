import { periodEnd, periodOf, periodStart } from './dates'
import { earnCents } from './money'
import { rate4On } from './rates'
import {
  dailyTargetSeconds,
  holidaySet,
  isWorkingDay,
  monthWorkingDays,
  remainingWorkingDays,
  workingDaysBetween,
} from './schedule'
import type { ISODate, PeriodTotal, RatePeriod, Schedule, TimeEntry, YearMonth } from './types'

export interface ValuedEntry {
  entry: TimeEntry
  rate4: number
  cents: number
  /** Logged on a weekend or holiday. */
  extra: boolean
  /** A tracked entry inside the tracker card's span: already in the card total. */
  covered: boolean
}

export interface RateSegment {
  rate4: number
  seconds: number
  cents: number
}

export interface CardValuation {
  card: PeriodTotal
  segments: RateSegment[]
  appCents: number
  trackerCents: number
  /** What counts toward earned, per `card.trust`. */
  usedCents: number
  /** tracker − app; non-zero means the two disagree. */
  mismatchCents: number
}

export interface MonthSummary {
  /** Pay-period key (see `Schedule.periodStartDay`). */
  month: YearMonth
  /** First and last day of the period. */
  start: ISODate
  end: ISODate
  /** The date "now" is measured from inside this month. */
  refDate: ISODate
  entries: ValuedEntry[]
  card: CardValuation | null
  seconds: { card: number; tracked: number; backfill: number; adjustment: number; extra: number }
  workedSeconds: number
  earnedCents: number
  /** Earned split by rate, for mid-month rate changes. */
  rateSplits: RateSegment[]
  workingDays: ISODate[]
  targetSeconds: number
  dailyTargetSeconds: number
  remainingDays: ISODate[]
  /** Rate on `refDate`. */
  rate4: number
}

export interface MonthInput {
  rates: RatePeriod[]
  entries: TimeEntry[]
  periodTotals: PeriodTotal[]
  schedule: Schedule
  today: ISODate
  countTodayAsWorked?: boolean
}

/** Today if it falls in the period, else the period's nearest edge. */
export function refDateFor(month: YearMonth, today: ISODate, startDay = 1): ISODate {
  const first = periodStart(month, startDay)
  const last = periodEnd(month, startDay)
  return today < first ? first : today > last ? last : today
}

/**
 * The tracker total that counts for a period: the one whose "as of" date falls
 * in it. If several do (after the period start day changed), the latest wins.
 */
export function cardFor(month: YearMonth, periodTotals: PeriodTotal[], startDay = 1): PeriodTotal | null {
  let best: PeriodTotal | null = null
  for (const p of periodTotals) {
    if (periodOf(p.endDate, startDay) === month && (!best || p.endDate > best.endDate)) best = p
  }
  return best
}

/**
 * Split a card's seconds across rate periods in proportion to the working
 * days each rate covers. One rate → exact `seconds × rate`.
 */
export function valueCard(card: PeriodTotal, rates: RatePeriod[], schedule: Schedule): CardValuation {
  let days = workingDaysBetween(card.startDate, card.endDate, schedule)
  if (days.length === 0) days = [card.endDate]
  const byRate = new Map<number, number>()
  for (const d of days) {
    const r = rate4On(d, rates)
    byRate.set(r, (byRate.get(r) ?? 0) + 1)
  }
  const groups = [...byRate.entries()]
  let assigned = 0
  const segments = groups.map(([rate4, count], i) => {
    const seconds = i === groups.length - 1 ? card.seconds - assigned : Math.floor((card.seconds * count) / days.length)
    assigned += seconds
    return { rate4, seconds, cents: earnCents(seconds, rate4) }
  })
  const appCents = segments.reduce((s, x) => s + x.cents, 0)
  const trackerCents = card.trackerEarnedCents
  return {
    card,
    segments,
    appCents,
    trackerCents,
    usedCents: card.trust === 'tracker' ? trackerCents : appCents,
    mismatchCents: trackerCents - appCents,
  }
}

/** Tracker totals that don't count because a newer one ends in the same period. */
export function uncountedCards(periodTotals: PeriodTotal[], startDay = 1): PeriodTotal[] {
  return periodTotals
    .filter((p) => cardFor(periodOf(p.endDate, startDay), periodTotals, startDay) !== p)
    .sort((a, b) => (a.endDate < b.endDate ? -1 : 1))
}

export function summarizeMonth(month: YearMonth, input: MonthInput): MonthSummary {
  const { rates, schedule, today } = input
  const startDay = schedule.periodStartDay ?? 1
  const holidays = holidaySet(schedule)
  const card = cardFor(month, input.periodTotals, startDay)
  const cardValue = card ? valueCard(card, rates, schedule) : null

  const entries: ValuedEntry[] = input.entries
    .filter((e) => periodOf(e.date, startDay) === month)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((entry) => {
      const rate4 = rate4On(entry.date, rates)
      const covered = !!card && entry.type === 'tracked' && entry.date >= card.startDate && entry.date <= card.endDate
      return {
        entry,
        rate4,
        cents: earnCents(entry.seconds, rate4),
        extra: !isWorkingDay(entry.date, schedule, holidays),
        covered,
      }
    })

  const seconds = { card: cardValue?.card.seconds ?? 0, tracked: 0, backfill: 0, adjustment: 0, extra: 0 }
  const splits = new Map<number, RateSegment>()
  const addSplit = (rate4: number, s: number, c: number) => {
    const cur = splits.get(rate4) ?? { rate4, seconds: 0, cents: 0 }
    splits.set(rate4, { rate4, seconds: cur.seconds + s, cents: cur.cents + c })
  }

  let earnedCents = cardValue?.usedCents ?? 0
  if (cardValue) {
    // Splits follow the counted figure; a tracker/app gap lands on the last rate.
    cardValue.segments.forEach((seg, i, all) =>
      addSplit(seg.rate4, seg.seconds, seg.cents + (i === all.length - 1 ? cardValue.usedCents - cardValue.appCents : 0)),
    )
  }
  for (const v of entries) {
    if (v.covered) continue
    seconds[v.entry.type] += v.entry.seconds
    if (v.extra) seconds.extra += v.entry.seconds
    earnedCents += v.cents
    addSplit(v.rate4, v.entry.seconds, v.cents)
  }

  const workingDays = monthWorkingDays(month, schedule)
  const daily = dailyTargetSeconds(schedule)
  const refDate = refDateFor(month, today, startDay)

  return {
    month,
    start: periodStart(month, startDay),
    end: periodEnd(month, startDay),
    refDate,
    entries,
    card: cardValue,
    seconds,
    workedSeconds: seconds.card + seconds.tracked + seconds.backfill + seconds.adjustment,
    earnedCents,
    rateSplits: [...splits.values()].sort((a, b) => a.rate4 - b.rate4),
    workingDays,
    targetSeconds: workingDays.length * daily,
    dailyTargetSeconds: daily,
    remainingDays: remainingWorkingDays(month, today, schedule, input.countTodayAsWorked ?? true),
    rate4: rate4On(refDate, rates),
  }
}
