import { backfillDates, todayISO, type AppData } from '@/engine'

/**
 * The two worked examples from the PRD (October and November 2026), so the
 * app can be explored with real-looking numbers.
 */
export function sampleData(id: () => string): AppData {
  const schedule = { workingDays: [1, 2, 3, 4, 5], dailyTargetHours: 8, daysOff: [] }
  const today = todayISO()
  return {
    version: 1,
    settings: {
      name: '',
      displayCurrency: 'BDT',
      displaySymbol: '৳',
      exchangeRate: 123,
      exchangeRateUpdatedAt: '2026-11-11',
      exchangeRateSource: 'manual',
      dailyTargetHours: 8,
      workingDays: [1, 2, 3, 4, 5],
      timeFormat: 'hms',
      theme: 'system',
      countTodayAsWorked: true,
      periodStartDay: 1,
    },
    rates: [{ id: id(), amount: 4.38, effectiveFrom: '2026-10-01', note: 'Derived from tracker' }],
    entries: backfillDates('2026-10-01', '2026-10-09', schedule).map((date) => ({
      id: id(),
      date,
      seconds: 8 * 3600,
      type: 'backfill' as const,
      note: 'Added by manager',
    })),
    periodTotals: [
      {
        id: id(),
        month: '2026-10',
        startDate: '2026-10-12',
        endDate: '2026-10-30',
        seconds: 118 * 3600 + 40 * 60 + 48,
        trackerEarnedCents: 51982,
        trust: 'tracker',
      },
      {
        id: id(),
        month: '2026-11',
        startDate: '2026-11-02',
        endDate: today < '2026-11-11' ? today : '2026-11-11',
        seconds: 62 * 3600 + 41 * 60 + 12,
        trackerEarnedCents: 27457,
        trust: 'tracker',
      },
    ],
    daysOff: [],
    payments: [
      { id: id(), date: '2026-11-05', amountCents: 70000, currency: 'USD', month: '2026-10', note: 'Oct payout' },
      { id: id(), date: '2026-11-07', amountCents: 8200, currency: 'USD', month: '2026-10', note: 'Extra for overtime' },
    ],
  }
}
