/**
 * Calendar-date helpers on `YYYY-MM-DD` strings. Arithmetic happens in UTC so
 * DST and the host time zone can never shift a date.
 */
import type { ISODate, YearMonth } from './types'

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

function toUTC(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUTC(d: Date): ISODate {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return fromUTC(toUTC(value)) === value
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = toUTC(date)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUTC(d)
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(date: ISODate): number {
  return toUTC(date).getUTCDay()
}

export const monthOf = (date: ISODate): YearMonth => date.slice(0, 7)

export function daysInMonth(month: YearMonth): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export const firstOfMonth = (month: YearMonth): ISODate => `${month}-01`
export const lastOfMonth = (month: YearMonth): ISODate => `${month}-${pad(daysInMonth(month))}`

export function addMonths(month: YearMonth, n: number): YearMonth {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

/** Inclusive list of dates from `start` to `end`. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

export const monthDays = (month: YearMonth) => eachDay(firstOfMonth(month), lastOfMonth(month))

/*
 * Pay periods. A period is keyed by the month it ENDS in, so with start day 26
 * the key "2026-11" is Oct 26 – Nov 25. Start day 1 is the calendar month, so
 * every existing month key keeps its meaning.
 */

/** Start days run 1–28 so every month has the day. */
export const clampStartDay = (day?: number): number => (!day || day < 1 ? 1 : Math.min(28, Math.floor(day)))

export function periodStart(key: YearMonth, startDay = 1): ISODate {
  const d = clampStartDay(startDay)
  return d === 1 ? firstOfMonth(key) : `${addMonths(key, -1)}-${pad(d)}`
}

export function periodEnd(key: YearMonth, startDay = 1): ISODate {
  const d = clampStartDay(startDay)
  return d === 1 ? lastOfMonth(key) : `${key}-${pad(d - 1)}`
}

/** The key of the pay period that contains `date`. */
export function periodOf(date: ISODate, startDay = 1): YearMonth {
  const d = clampStartDay(startDay)
  const month = monthOf(date)
  return d > 1 && Number(date.slice(8, 10)) >= d ? addMonths(month, 1) : month
}

export const periodDays = (key: YearMonth, startDay = 1) => eachDay(periodStart(key, startDay), periodEnd(key, startDay))

/** Monday of the week containing `date`. */
export function startOfWeek(date: ISODate): ISODate {
  const wd = weekday(date)
  return addDays(date, wd === 0 ? -6 : 1 - wd)
}

/** Today's calendar date in the given IANA zone (default: the device's zone). */
export function todayISO(timeZone?: string, now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const shortFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const dayFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})
const monthShortFmt = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

const longFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
/** "Oct 1, 2026" */
export const formatDate = (date: ISODate) => longFmt.format(toUTC(date))

/** "October 2026" */
export const formatMonth = (month: YearMonth) => monthFmt.format(toUTC(firstOfMonth(month)))
/** "Oct" */
export const formatMonthShort = (month: YearMonth) => monthShortFmt.format(toUTC(firstOfMonth(month)))
/** "Nov 11" */
export const formatShortDate = (date: ISODate) => shortFmt.format(toUTC(date))
/** "Fri, Oct 30" */
export const formatDay = (date: ISODate) => dayFmt.format(toUTC(date))

/** "Oct 12 – 30" or "Oct 28 – Nov 3" */
export function formatRange(start: ISODate, end: ISODate): string {
  if (start === end) return formatShortDate(start)
  if (monthOf(start) === monthOf(end)) return `${formatShortDate(start)} – ${Number(end.slice(8))}`
  return `${formatShortDate(start)} – ${formatShortDate(end)}`
}

/** 1 → "1st", 22 → "22nd", 25 → "25th" */
export function ordinal(n: number): string {
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'
  return `${n}${suffix}`
}

/** null for calendar months, else "Oct 26 – Nov 25". */
export function formatPeriodRange(key: YearMonth, startDay = 1): string | null {
  return clampStartDay(startDay) === 1 ? null : formatRange(periodStart(key, startDay), periodEnd(key, startDay))
}

/** "November 2026", or "November 2026 (Oct 26 – Nov 25)" for a custom pay period. */
export function formatPeriod(key: YearMonth, startDay = 1): string {
  const range = formatPeriodRange(key, startDay)
  return range ? `${formatMonth(key)} (${range})` : formatMonth(key)
}
