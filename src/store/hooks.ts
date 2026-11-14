import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  buildScenarios,
  convertCents,
  formatDuration,
  formatLocal,
  reconcile,
  scheduleFrom,
  summarizeMonth,
  todayISO,
  type Schedule,
  type YearMonth,
} from '@/engine'
import { useData } from './data'
import { useUI } from './ui'

/** Today's date, refreshed when the tab regains focus or the day rolls over. */
export function useToday() {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const check = () => setToday((t) => (todayISO() === t ? t : todayISO()))
    const timer = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}

export function useSchedule(): Schedule {
  const { workingDays, dailyTargetHours, daysOff } = useData(
    useShallow((s) => ({
      workingDays: s.settings.workingDays,
      dailyTargetHours: s.settings.dailyTargetHours,
      daysOff: s.daysOff,
    })),
  )
  return useMemo(() => scheduleFrom({ workingDays, dailyTargetHours }, daysOff), [workingDays, dailyTargetHours, daysOff])
}

/** Everything a screen needs about one month, recomputed only when inputs change. */
export function useMonthView(month: YearMonth, opts: { schedule?: Schedule; hoursPerDay?: number | null } = {}) {
  const today = useToday()
  const baseSchedule = useSchedule()
  const schedule = opts.schedule ?? baseSchedule
  const { rates, entries, periodTotals, payments, settings } = useData(
    useShallow((s) => ({
      rates: s.rates,
      entries: s.entries,
      periodTotals: s.periodTotals,
      payments: s.payments,
      settings: s.settings,
    })),
  )
  const projectionHours = useUI((s) => s.projectionHours)
  const hoursPerDay = opts.hoursPerDay === undefined ? projectionHours : opts.hoursPerDay

  return useMemo(() => {
    const summary = summarizeMonth(month, {
      rates,
      entries,
      periodTotals,
      schedule,
      today,
      countTodayAsWorked: settings.countTodayAsWorked,
    })
    const scenarios = buildScenarios(summary, rates, { hoursPerDay: hoursPerDay ?? undefined })
    const recon = reconcile({
      month,
      expectedCents: summary.earnedCents,
      workedSeconds: summary.workedSeconds,
      rate4: summary.rate4,
      payments,
      fx: settings.exchangeRate,
    })
    return { summary, scenarios, recon, today, schedule, settings, rates }
  }, [month, rates, entries, periodTotals, payments, settings, schedule, today, hoursPerDay])
}

/** Formatters bound to the user's settings. */
export function useFormat() {
  const { exchangeRate, displaySymbol, timeFormat } = useData(
    useShallow((s) => ({
      exchangeRate: s.settings.exchangeRate,
      displaySymbol: s.settings.displaySymbol,
      timeFormat: s.settings.timeFormat,
    })),
  )
  return useMemo(
    () => ({
      local: (usdCents: number) => formatLocal(convertCents(usdCents, exchangeRate), displaySymbol),
      duration: (seconds: number) => formatDuration(seconds, timeFormat),
      symbol: displaySymbol,
      fx: exchangeRate,
    }),
    [exchangeRate, displaySymbol, timeFormat],
  )
}

/** Apply light/dark/system theme to <html>. */
export function useThemeClass() {
  const theme = useData((s) => s.settings.theme)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E1116' : '#F7F8FA')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
