/**
 * Domain types. All calendar dates are `YYYY-MM-DD` strings and months are
 * `YYYY-MM` strings, so no value ever carries a time zone.
 *
 * Money conventions used throughout the engine:
 * - `*Cents`  integer US cents (or integer minor units of the stated currency)
 * - `rate4`   integer USD per hour × 10 000 (the PRD stores rates to 4 decimals)
 * - `fx4`     integer display-currency units per 1 USD × 10 000
 * - `seconds` integer seconds
 */

export type ISODate = string
export type YearMonth = string

export type EntryType = 'tracked' | 'backfill' | 'adjustment'

export interface TimeEntry {
  id: string
  date: ISODate
  /** May be negative for a manual adjustment that removes time. */
  seconds: number
  type: EntryType
  note?: string
}

/**
 * A tracker "schedule card" reading: the totals a tracker shows for a span of
 * days. There is at most one per month; a newer reading replaces the old one.
 */
export interface PeriodTotal {
  id: string
  month: YearMonth
  startDate: ISODate
  /** The day the reading was taken ("as of"). */
  endDate: ISODate
  seconds: number
  trackerEarnedCents: number
  /** Which figure to count as earned when tracker and app disagree. */
  trust: 'tracker' | 'app'
}

export interface RatePeriod {
  id: string
  /** USD per hour, at most 4 decimals. */
  amount: number
  effectiveFrom: ISODate
  note?: string
}

export interface DayOff {
  id: string
  date: ISODate
  reason?: string
}

export type PaymentCurrency = 'USD' | 'BDT'

export interface Payment {
  id: string
  date: ISODate
  /** Minor units of `currency` (cents for USD, poisha for BDT). */
  amountCents: number
  currency: PaymentCurrency
  /** Display-currency per USD used to convert a non-USD payment. */
  exchangeRate?: number
  month: YearMonth
  note?: string
}

export interface Schedule {
  /** JS weekday numbers: 0 = Sunday … 6 = Saturday. Default Mon–Fri = [1..5]. */
  workingDays: number[]
  dailyTargetHours: number
  daysOff: DayOff[]
  /**
   * Day of the month a pay period starts (1–28). 1 = calendar months. With 26,
   * the period keyed "2026-11" runs Oct 26 – Nov 25. Every `YearMonth` that
   * names "a month of work" is such a period key.
   */
  periodStartDay?: number
}

export interface Settings {
  name: string
  displayCurrency: string
  displaySymbol: string
  /** Display-currency units per 1 USD. */
  exchangeRate: number
  exchangeRateUpdatedAt: ISODate
  exchangeRateSource: 'manual' | 'auto'
  dailyTargetHours: number
  workingDays: number[]
  timeFormat: 'hms' | 'decimal'
  theme: 'light' | 'dark' | 'system'
  /** When true, remaining days start tomorrow (PRD default). */
  countTodayAsWorked: boolean
  /** See `Schedule.periodStartDay`. */
  periodStartDay: number
}

export interface AppData {
  version: 1
  settings: Settings
  rates: RatePeriod[]
  entries: TimeEntry[]
  periodTotals: PeriodTotal[]
  daysOff: DayOff[]
  payments: Payment[]
}
