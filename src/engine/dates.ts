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
