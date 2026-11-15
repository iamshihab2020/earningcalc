import { addDays, eachDay, periodDays, periodEnd, periodOf, periodStart, weekday } from './dates'
import type { DayOff, ISODate, Schedule, Settings, YearMonth } from './types'

export function scheduleFrom(
  settings: Pick<Settings, 'workingDays' | 'dailyTargetHours'> & { periodStartDay?: number },
  daysOff: DayOff[],
): Schedule {
  return {
    workingDays: settings.workingDays,
    dailyTargetHours: settings.dailyTargetHours,
    daysOff,
    periodStartDay: settings.periodStartDay ?? 1,
  }
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

/** Working days in the pay period `month` (the calendar month when periods start on the 1st). */
export function monthWorkingDays(month: YearMonth, schedule: Schedule): ISODate[] {
  const holidays = holidaySet(schedule)
  return periodDays(month, schedule.periodStartDay).filter((d) => isWorkingDay(d, schedule, holidays))
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
  const first = periodStart(month, schedule.periodStartDay)
  const last = periodEnd(month, schedule.periodStartDay)
  if (from > last) return []
  return workingDaysBetween(from > first ? from : first, last, schedule)
}

/** Dates to fill for a bulk backfill, skipping days off unless told otherwise. */
export function backfillDates(start: ISODate, end: ISODate, schedule: Schedule, skipDaysOff = true): ISODate[] {
  if (end < start) return []
  return skipDaysOff ? workingDaysBetween(start, end, schedule) : eachDay(start, end)
}

export const isInMonth = (date: ISODate, month: YearMonth, startDay = 1) => periodOf(date, startDay) === month
