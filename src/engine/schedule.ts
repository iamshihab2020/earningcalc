import { addDays, eachDay, firstOfMonth, lastOfMonth, monthDays, monthOf, weekday } from './dates'
import type { DayOff, ISODate, Schedule, Settings, YearMonth } from './types'

export function scheduleFrom(settings: Pick<Settings, 'workingDays' | 'dailyTargetHours'>, daysOff: DayOff[]): Schedule {
  return { workingDays: settings.workingDays, dailyTargetHours: settings.dailyTargetHours, daysOff }
}

export function holidaySet(schedule: Schedule): Set<ISODate> {
  return new Set(schedule.daysOff.map((d) => d.date))
}

export function isWorkingDay(date: ISODate, schedule: Schedule, holidays = holidaySet(schedule)): boolean {
  return schedule.workingDays.includes(weekday(date)) && !holidays.has(date)
}

export function workingDaysBetween(start: ISODate, end: ISODate, schedule: Schedule): ISODate[] {
  const holidays = holidaySet(schedule)
  return eachDay(start, end).filter((d) => isWorkingDay(d, schedule, holidays))
}

export function monthWorkingDays(month: YearMonth, schedule: Schedule): ISODate[] {
  const holidays = holidaySet(schedule)
  return monthDays(month).filter((d) => isWorkingDay(d, schedule, holidays))
}

export const dailyTargetSeconds = (schedule: Pick<Schedule, 'dailyTargetHours'>) =>
  Math.round(schedule.dailyTargetHours * 3600)

export function monthTargetSeconds(month: YearMonth, schedule: Schedule): number {
  return monthWorkingDays(month, schedule).length * dailyTargetSeconds(schedule)
}

/**
 * Working days still ahead in `month`. By default "today" counts as already
 * worked, so remaining days start tomorrow (PRD §3.5).
 */
export function remainingWorkingDays(
  month: YearMonth,
  today: ISODate,
  schedule: Schedule,
  countTodayAsWorked = true,
): ISODate[] {
  const from = countTodayAsWorked ? addDays(today, 1) : today
  const first = firstOfMonth(month)
  const last = lastOfMonth(month)
  if (from > last) return []
  return workingDaysBetween(from > first ? from : first, last, schedule)
}

/** Dates to fill for a bulk backfill, skipping days off unless told otherwise. */
export function backfillDates(start: ISODate, end: ISODate, schedule: Schedule, skipDaysOff = true): ISODate[] {
  if (end < start) return []
  return skipDaysOff ? workingDaysBetween(start, end, schedule) : eachDay(start, end)
}

export const isInMonth = (date: ISODate, month: YearMonth) => monthOf(date) === month
