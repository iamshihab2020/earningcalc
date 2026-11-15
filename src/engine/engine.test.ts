import { describe, expect, it } from 'vitest'
import {
  applyRateChange,
  backfillDates,
  buildHistory,
  buildMessage,
  clampStartDay,
  buildScenarios,
  compareRates,
  convertCents,
  deriveRate,
  divRound,
  earnCents,
  formatHMS,
  formatHours,
  formatLocal,
  formatPeriod,
  formatRate,
  formatUSD,
  historyToCSV,
  monthTargetSeconds,
  monthToCSV,
  monthWorkingDays,
  offerRate,
  paceCheck,
  periodEnd,
  periodOf,
  periodStart,
  parseBackup,
  parseCents,
  parseDuration,
  rateChangeImpact,
  rateDifference,
  reconcile,
  remainingWorkingDays,
  summarizeMonth,
  toRate4,
  toUsdCents,
  uncountedCards,
  type MonthInput,
  type PeriodTotal,
  type RatePeriod,
  type Schedule,
  type TimeEntry,
} from './index'

const weekdays: Schedule = { workingDays: [1, 2, 3, 4, 5], dailyTargetHours: 8, daysOff: [] }
const rate438: RatePeriod[] = [{ id: 'r1', amount: 4.38, effectiveFrom: '2026-01-01' }]
const H = 3600

let n = 0
const entry = (date: string, seconds: number, type: TimeEntry['type'] = 'tracked'): TimeEntry => ({
  id: `e${++n}`,
  date,
  seconds,
  type,
})
const card = (month: string, start: string, end: string, hms: string, earned: string): PeriodTotal => ({
  id: `c-${month}`,
  month,
  startDate: start,
  endDate: end,
  seconds: parseDuration(hms)!,
  trackerEarnedCents: parseCents(earned)!,
  trust: 'tracker',
})

/** October 2026 from PRD §4 worked example 1. */
function october(): MonthInput {
  const backfill = backfillDates('2026-10-01', '2026-10-09', weekdays).map((d) => entry(d, 8 * H, 'backfill'))
  return {
    rates: rate438,
    entries: backfill,
    periodTotals: [card('2026-10', '2026-10-12', '2026-10-30', '118:40:48', '519.82')],
    schedule: weekdays,
    today: '2026-11-11',
  }
}

/** November 2026 from PRD §4 worked example 2 (card read the morning of Nov 11). */
function november(): MonthInput {
  return {
    rates: rate438,
    entries: [],
    periodTotals: [card('2026-11', '2026-11-02', '2026-11-11', '62:41:12', '274.57')],
    schedule: weekdays,
    today: '2026-11-11',
    countTodayAsWorked: false,
  }
}

describe('money primitives', () => {
  it('rounds half away from zero on integer division', () => {
    expect(divRound(5, 2)).toBe(3)
    expect(divRound(4, 3)).toBe(1)
    expect(divRound(-5, 2)).toBe(-3)
    expect(divRound(0, 7)).toBe(0)
  })

  it('parses money and rates without float drift', () => {
    expect(parseCents('$519.82')).toBe(51982)
    expect(parseCents('1,234.5')).toBe(123450)
    expect(parseCents('0.105')).toBe(11)
    expect(parseCents('abc')).toBeNull()
    expect(toRate4(4.38)).toBe(43800)
    expect(toRate4(0.1 + 0.2)).toBe(3000)
  })

  it('values time to the cent', () => {
    expect(earnCents(8 * H, 43800)).toBe(3504)
    expect(earnCents(20 * H, 43800)).toBe(8760)
  })

  it('converts to and from the display currency', () => {
    expect(convertCents(76510, 123)).toBe(9410730)
    expect(formatLocal(convertCents(76510, 123), '৳')).toBe('৳94,107')
    expect(toUsdCents(9410730, 123)).toBe(76510)
  })

  it('formats amounts the way the PRD shows them', () => {
    expect(formatUSD(76510)).toBe('$765.10')
    expect(formatRate(43800)).toBe('$4.38')
    expect(formatRate(43801, 4)).toBe('$4.3801')
    expect(formatRate(50000)).toBe('$5.00')
  })
})

describe('durations (PRD §5.6)', () => {
  it('accepts HH:MM:SS, HH:MM and decimal hours', () => {
    expect(parseDuration('118:40:48')).toBe(427248)
    expect(parseDuration('118:40')).toBe(427200)
    expect(parseDuration('118.68')).toBe(427248)
    expect(parseDuration('8')).toBe(8 * H)
    expect(parseDuration('8h 30m')).toBe(8.5 * H)
    expect(parseDuration('-1:30')).toBe(-1.5 * H)
    expect(parseDuration('1:75')).toBeNull()
    expect(parseDuration('')).toBeNull()
  })

  it('formats both ways', () => {
    expect(formatHMS(427248)).toBe('118:40:48')
    expect(formatHours(427248)).toBe('118.68')
    expect(formatHMS(parseDuration('62:41:12')!)).toBe('62:41:12')
    expect(formatHours(parseDuration('62:41:12')!)).toBe('62.69')
    expect(formatHMS(-5400)).toBe('−1:30:00')
  })
})

describe('schedule (PRD §3.4)', () => {
  it('AC3: October 2026 has 22 working days and a 176 h target', () => {
    expect(monthWorkingDays('2026-10', weekdays)).toHaveLength(22)
    expect(monthTargetSeconds('2026-10', weekdays)).toBe(176 * H)
  })

  it('November 2026 has 21 working days (168 h)', () => {
    expect(monthTargetSeconds('2026-11', weekdays)).toBe(168 * H)
  })

  it('holidays reduce working days', () => {
    const s = { ...weekdays, daysOff: [{ id: 'h', date: '2026-10-15' }] }
    expect(monthWorkingDays('2026-10', s)).toHaveLength(21)
  })

  it('remaining days start tomorrow by default, or today when toggled', () => {
    expect(remainingWorkingDays('2026-11', '2026-11-11', weekdays)).toHaveLength(13)
    expect(remainingWorkingDays('2026-11', '2026-11-11', weekdays, false)).toHaveLength(14)
    expect(remainingWorkingDays('2026-10', '2026-11-11', weekdays)).toHaveLength(0)
    expect(remainingWorkingDays('2026-12', '2026-11-11', weekdays)).toHaveLength(23)
  })
})

describe('worked example 1: October 2026', () => {
  it('AC1: 118:40:48 and $519.82 suggest $4.38/h', () => {
    const r = deriveRate(parseDuration('118:40:48')!, 51982)!
    expect(r.rate4).toBe(43800)
    expect(r.reproduces).toBe(true)
  })

  it('AC2: backfilling Oct 1, 2 and 5–9 adds 56:00:00 and skips the weekend', () => {
    const dates = backfillDates('2026-10-01', '2026-10-09', weekdays)
    expect(dates).toEqual(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'])
    expect(formatHMS(dates.length * 8 * H)).toBe('56:00:00')
  })

  it('totals 174.68 h and $765.10 ($519.82 tracked + $245.28 backfill)', () => {
    const s = summarizeMonth('2026-10', october())
    expect(s.seconds.backfill).toBe(56 * H)
    expect(s.entries.reduce((sum, e) => sum + e.cents, 0)).toBe(24528)
    expect(formatHours(s.workedSeconds)).toBe('174.68')
    expect(formatHMS(s.workedSeconds)).toBe('174:40:48')
    expect(s.earnedCents).toBe(76510)
  })

  it('the full standard month is 176 h = $770.88', () => {
    const s = summarizeMonth('2026-10', october())
    expect(buildScenarios(s, rate438).standard).toEqual({ seconds: 176 * H, cents: 77088 })
  })

  it('AC6: payments of $700 + $82 total $782, gap in USD, BDT and hours', () => {
    const s = summarizeMonth('2026-10', october())
    const r = reconcile({
      month: '2026-10',
      expectedCents: s.earnedCents,
      workedSeconds: s.workedSeconds,
      rate4: s.rate4,
      fx: 123,
      payments: [
        { id: 'p1', date: '2026-11-05', amountCents: 70000, currency: 'USD', month: '2026-10' },
        { id: 'p2', date: '2026-11-07', amountCents: 8200, currency: 'USD', month: '2026-10', note: 'Extra' },
        { id: 'p3', date: '2026-12-05', amountCents: 9999, currency: 'USD', month: '2026-11' },
      ],
    })
    expect(r.paidCents).toBe(78200)
    expect(r.status).toBe('paid')
    expect(r.gapCents).toBe(-1690)
    expect(convertCents(r.gapCents, 123)).toBe(-207870)
    expect(formatHours(r.gapSeconds)).toBe('-3.86')
    expect(formatRate(r.impliedRate4)).toBe('$4.48')
  })

  it('a BDT payment converts at the rate stored on it', () => {
    const r = reconcile({
      month: '2026-10',
      expectedCents: 76510,
      workedSeconds: 0,
      rate4: 43800,
      fx: 130,
      payments: [{ id: 'p', date: '2026-11-05', amountCents: 9410730, currency: 'BDT', exchangeRate: 123, month: '2026-10' }],
    })
    expect(r.paidCents).toBe(76510)
    expect(r.status).toBe('paid')
  })

  it('reports a short payment and no-payment states', () => {
    const base = { month: '2026-10', expectedCents: 76510, workedSeconds: 174 * H, rate4: 43800, fx: 123 }
    const short = reconcile({ ...base, payments: [{ id: 'p', date: '2026-11-05', amountCents: 70000, currency: 'USD', month: '2026-10' }] })
    expect(short.status).toBe('short')
    expect(short.gapCents).toBe(6510)
    expect(formatHours(short.gapSeconds)).toBe('14.86')
    expect(reconcile({ ...base, payments: [] }).status).toBe('none')
  })
})

describe('worked example 2: November schedule card (as of Nov 11)', () => {
  it('AC11: 62:41:12 and $274.57 give $4.38/h and 62.69 h', () => {
    const seconds = parseDuration('62:41:12')!
    const r = deriveRate(seconds, 27457)!
    expect(r.rate4).toBe(43800)
    expect(r.exact).toBeCloseTo(4.38004, 5)
    expect(r.decimals).toBe(2)
    expect(formatHours(seconds)).toBe('62.69')
  })

  it('AC12: 20 h in 2 days is $87.60 and 4 h ahead of normal pace', () => {
    const p = paceCheck(20 * H, 2, 8 * H, 43800)
    expect(p.cents).toBe(8760)
    expect(p.normalSeconds).toBe(16 * H)
    expect(p.aheadSeconds).toBe(4 * H)
  })

  it('counts 14 remaining working days from Nov 11', () => {
    expect(summarizeMonth('2026-11', november()).remainingDays).toHaveLength(14)
  })

  it('AC13: tomorrow only $309.61, keep going $765.13, standard $735.84', () => {
    const s = summarizeMonth('2026-11', november())
    const sc = buildScenarios(s, rate438)
    expect(sc.now.cents).toBe(27457)
    expect(sc.nextDayOnly.cents).toBe(30961)
    expect(formatHours(sc.nextDayOnly.seconds)).toBe('70.69')
    expect(formatLocal(convertCents(sc.nextDayOnly.cents, 123), '৳')).toBe('৳38,082')
    expect(sc.keepGoing.cents).toBe(76513)
    expect(sc.keepGoing.days).toBe(14)
    expect(formatHours(sc.keepGoing.seconds)).toBe('174.69')
    expect(formatLocal(convertCents(sc.keepGoing.cents, 123), '৳')).toBe('৳94,111')
    expect(sc.standard).toEqual({ seconds: 168 * H, cents: 73584 })
    expect(formatHours(sc.aheadSeconds, 1)).toBe('6.7')
  })

  it('AC7: the projection follows the hours-per-day setting', () => {
    const s = summarizeMonth('2026-11', november())
    expect(buildScenarios(s, rate438, { hoursPerDay: 6 }).keepGoing.cents).toBe(27457 + 14 * earnCents(6 * H, 43800))
    expect(buildScenarios(s, rate438, { hoursPerDay: 7 }).keepGoing.cents).toBe(27457 + 14 * earnCents(7 * H, 43800))
  })

  it('AC14: a newer card for the same month replaces the old one (one card per month)', () => {
    const input = november()
    const newer = card('2026-11', '2026-11-02', '2026-11-12', '70:41:12', '309.61')
    const replaced = [...input.periodTotals.filter((p) => p.month !== newer.month), newer]
    const s = summarizeMonth('2026-11', { ...input, periodTotals: replaced })
    expect(s.workedSeconds).toBe(parseDuration('70:41:12'))
    expect(s.earnedCents).toBe(30961)
  })

  it('does not double count tracked entries inside the card span', () => {
    const input = november()
    input.entries = [entry('2026-11-05', 8 * H), entry('2026-11-12', 8 * H), entry('2026-11-06', 8 * H, 'backfill')]
    const s = summarizeMonth('2026-11', input)
    expect(s.entries.find((e) => e.entry.date === '2026-11-05')!.covered).toBe(true)
    expect(s.workedSeconds).toBe(parseDuration('62:41:12')! + 16 * H)
    expect(s.earnedCents).toBe(27457 + 2 * 3504)
  })

  it('shows tracker vs app when they disagree and honours the chosen side', () => {
    const input = november()
    input.periodTotals = [card('2026-11', '2026-11-02', '2026-11-11', '62:41:12', '274.60')]
    const tracker = summarizeMonth('2026-11', input)
    expect(tracker.card!.appCents).toBe(27457)
    expect(tracker.card!.mismatchCents).toBe(3)
    expect(tracker.earnedCents).toBe(27460)
    input.periodTotals = [{ ...input.periodTotals[0], trust: 'app' }]
    expect(summarizeMonth('2026-11', input).earnedCents).toBe(27457)
  })
})

describe('rate history (PRD §3.3)', () => {
  const base: RatePeriod[] = [{ id: 'r1', amount: 4.38, effectiveFrom: '2026-10-01' }]

  it('AC4: $5.00 from Nov 1 leaves October unchanged and values November at $5.00', () => {
    const rates = applyRateChange(base, { id: 'r2', amount: 5, mode: 'from-date', date: '2026-11-01', month: '2026-11' })
    const oct = summarizeMonth('2026-10', { ...october(), rates })
    expect(oct.earnedCents).toBe(76510)
    const nov = summarizeMonth('2026-11', {
      ...october(),
      rates,
      periodTotals: [],
      entries: [entry('2026-11-02', 8 * H), entry('2026-11-03', 8 * H)],
    })
    expect(nov.entries.every((e) => e.rate4 === 50000)).toBe(true)
    expect(nov.earnedCents).toBe(8000)
  })

  it('AC5: a mid-month change splits earnings across both rates', () => {
    const rates = applyRateChange(base, { id: 'r2', amount: 5, mode: 'from-date', date: '2026-11-16', month: '2026-11' })
    const input: MonthInput = {
      rates,
      entries: [entry('2026-11-13', 8 * H), entry('2026-11-16', 8 * H), entry('2026-11-17', 4 * H)],
      periodTotals: [],
      schedule: weekdays,
      today: '2026-11-17',
    }
    const s = summarizeMonth('2026-11', input)
    expect(s.earnedCents).toBe(3504 + 4000 + 2000)
    expect(s.rateSplits).toEqual([
      { rate4: 43800, seconds: 8 * H, cents: 3504 },
      { rate4: 50000, seconds: 12 * H, cents: 6000 },
    ])
  })

  it('splits a tracker card across a mid-span rate change by working days', () => {
    const rates = applyRateChange(base, { id: 'r2', amount: 5, mode: 'from-date', date: '2026-11-09', month: '2026-11' })
    const c = { ...card('2026-11', '2026-11-02', '2026-11-13', '80:00:00', '0'), trust: 'app' as const }
    const s = summarizeMonth('2026-11', { rates, entries: [], periodTotals: [c], schedule: weekdays, today: '2026-11-13' })
    expect(s.card!.segments).toEqual([
      { rate4: 43800, seconds: 40 * H, cents: 17520 },
      { rate4: 50000, seconds: 40 * H, cents: 20000 },
    ])
  })

  it('month-start and whole-month modes', () => {
    const withMid = applyRateChange(base, { id: 'r2', amount: 5, mode: 'from-date', date: '2026-11-16', month: '2026-11' })
    const monthStart = applyRateChange(withMid, { id: 'r3', amount: 4.5, mode: 'month-start', month: '2026-11', date: '' })
    expect(monthStart.map((r) => [r.effectiveFrom, r.amount])).toEqual([
      ['2026-10-01', 4.38],
      ['2026-11-01', 4.5],
      ['2026-11-16', 5],
    ])
    const whole = applyRateChange(withMid, { id: 'r3', amount: 4.5, mode: 'whole-month', month: '2026-11', date: '' })
    expect(whole.map((r) => [r.effectiveFrom, r.amount])).toEqual([
      ['2026-10-01', 4.38],
      ['2026-11-01', 4.5],
      ['2026-12-01', 5],
    ])
  })

  it('replaces a period that starts on the same day instead of duplicating it', () => {
    const rates = applyRateChange(base, { id: 'x', amount: 4.4, mode: 'from-date', date: '2026-10-01', month: '2026-10' })
    expect(rates).toEqual([{ id: 'r1', amount: 4.4, effectiveFrom: '2026-10-01', note: undefined }])
  })

  it('derives the shortest rate that reproduces a rounded tracker total', () => {
    // 100 h at $4.375/h = $437.50. Rounding to $4.38 would give $438.00, so keep 3 decimals.
    const r = deriveRate(parseDuration('100:00:00')!, 43750)!
    expect(r.rate4).toBe(43750)
    expect(r.decimals).toBe(3)
  })

  it('stores 4 decimals', () => {
    const rates = applyRateChange(base, { id: 'x', amount: 4.123456, mode: 'from-date', date: '2026-12-01', month: '2026-12' })
    expect(rates[1].amount).toBe(4.1235)
  })

  it('previews exactly which months change', () => {
    const after = applyRateChange(base, { id: 'r2', amount: 5, mode: 'from-date', date: '2026-11-01', month: '2026-11' })
    const input = { ...november(), periodTotals: [...october().periodTotals, ...november().periodTotals], entries: october().entries }
    const impact = rateChangeImpact(['2026-10', '2026-11'], input, base, after)
    expect(impact.map((i) => i.month)).toEqual(['2026-11'])
    expect(impact[0].beforeCents).toBe(27457)
    expect(impact[0].afterCents).toBe(27457) // the card is trusted at the tracker's figure
    expect(impact[0].afterProjectedCents).toBe(27457 + 14 * 4000)
  })

  it('warns when a derived rate differs by more than 1%', () => {
    expect(rateDifference(43800, 43800)).toBe(0)
    expect(rateDifference(44300, 43800)).toBeGreaterThan(0.01)
    expect(rateDifference(44200, 43800)).toBeLessThan(0.01)
  })
})

describe('offer and rate comparison (PRD §3.8)', () => {
  it('$800 for January 2027 at 8 h/day is 168 h = $4.76/h', () => {
    const o = offerRate(80000, '2027-01', 8, weekdays)
    expect(o.workingDays).toBe(21)
    expect(o.seconds).toBe(168 * H)
    expect(formatRate(o.rate4)).toBe('$4.76')
  })

  it('compares candidate rates over the same hours', () => {
    expect(compareRates([43800, 50000, 55000, 60000], 176 * H)).toEqual([77088, 88000, 96800, 105600])
  })
})

describe('summary message and backups', () => {
  it('builds a Slack-friendly summary', () => {
    const s = summarizeMonth('2026-10', october())
    const recon = reconcile({
      month: '2026-10',
      expectedCents: s.earnedCents,
      workedSeconds: s.workedSeconds,
      rate4: s.rate4,
      fx: 123,
      payments: [{ id: 'p', date: '2026-11-05', amountCents: 70000, currency: 'USD', month: '2026-10' }],
    })
    const msg = buildMessage({ summary: s, recon, fx: 123, symbol: '৳' })
    expect(msg).toContain('*Hours*')
    expect(msg).toContain('Total: 174:40:48 (174.68 h) of 176 h target')
    expect(msg).toContain('Expected: $765.10 (≈ ৳94,107)')
    expect(msg).toContain('Difference: −$65.10 (short)')
    expect(msg).toContain('Could you check the remaining $65.10 (14.9 h at $4.38/h)?')
  })

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('nope')).toThrow('not valid JSON')
    expect(() => parseBackup('{"version":2}')).toThrow('not an Earnings Tracker backup')
  })

  it('CSV export neutralises formula-like notes but keeps negative numbers', () => {
    const s = summarizeMonth('2026-11', {
      ...november(),
      periodTotals: [],
      entries: [
        { ...entry('2026-11-02', 8 * H), note: '=HYPERLINK("http://x","y")' },
        { ...entry('2026-11-03', -1 * H, 'adjustment'), note: 'late start' },
      ],
    })
    const csv = monthToCSV(s)
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""y"")"`)
    expect(csv).toContain('adjustment,−1:00:00,-1.0000,4.3800,-4.38,yes,late start')
  })
})

describe('custom pay periods (start day 26)', () => {
  const p26: Schedule = { ...weekdays, periodStartDay: 26 }

  it('keys a period by the month it ends in', () => {
    expect(periodStart('2026-11', 26)).toBe('2026-10-26')
    expect(periodEnd('2026-11', 26)).toBe('2026-11-25')
    expect(periodOf('2026-11-25', 26)).toBe('2026-11')
    expect(periodOf('2026-11-26', 26)).toBe('2026-12')
    expect(periodOf('2026-12-26', 26)).toBe('2027-01')
    expect(periodStart('2027-01', 26)).toBe('2026-12-26')
    expect(formatPeriod('2026-11', 26)).toBe('November 2026 (Oct 26 – Nov 25)')
  })

  it('start day 1 is the calendar month, as before', () => {
    expect(periodStart('2026-11')).toBe('2026-11-01')
    expect(periodEnd('2026-11', 1)).toBe('2026-11-30')
    expect(periodOf('2026-11-30', 1)).toBe('2026-11')
    expect(formatPeriod('2026-11')).toBe('November 2026')
    expect(clampStartDay(31)).toBe(28)
  })

  it('Oct 26 – Nov 25, 2026 has 23 working days (184 h) and 10 left after Nov 11', () => {
    expect(monthWorkingDays('2026-11', p26)).toHaveLength(23)
    expect(monthTargetSeconds('2026-11', p26)).toBe(184 * H)
    expect(remainingWorkingDays('2026-11', '2026-11-11', p26)).toHaveLength(10)
  })

  it('counts entries and the tracker total by period, not calendar month', () => {
    const s = summarizeMonth('2026-11', {
      rates: rate438,
      schedule: p26,
      today: '2026-11-11',
      entries: [entry('2026-10-25', 8 * H, 'backfill'), entry('2026-10-27', 8 * H, 'backfill'), entry('2026-11-26', 8 * H, 'backfill')],
      periodTotals: [card('2026-11', '2026-10-28', '2026-11-11', '62:41:12', '274.57')],
    })
    expect(s.start).toBe('2026-10-26')
    expect(s.end).toBe('2026-11-25')
    expect(s.entries.map((v) => v.entry.date)).toEqual(['2026-10-27'])
    expect(s.earnedCents).toBe(27457 + 3504)
    expect(s.targetSeconds).toBe(184 * H)
  })

  it('"from the start of the period" means the 26th', () => {
    const rates = applyRateChange(rate438, { id: 'r2', amount: 5, mode: 'month-start', date: '', month: '2026-12', startDay: 26 })
    expect(rates.map((r) => r.effectiveFrom)).toEqual(['2026-01-01', '2026-11-26'])
  })

  it('names the range in the summary message', () => {
    const s = summarizeMonth('2026-11', { ...november(), schedule: p26 })
    const recon = reconcile({ month: '2026-11', expectedCents: s.earnedCents, workedSeconds: s.workedSeconds, rate4: s.rate4, fx: 123, payments: [] })
    expect(buildMessage({ summary: s, recon, fx: 123, symbol: '৳' })).toContain('*Earnings summary — November 2026 (Oct 26 – Nov 25)*')
  })
})

describe('earnings history', () => {
  it('lists every period with data, newest first, with all-time totals', () => {
    const payments = [
      { id: 'p1', date: '2026-11-05', amountCents: 70000, currency: 'USD' as const, month: '2026-10' },
      { id: 'p2', date: '2026-11-07', amountCents: 8200, currency: 'USD' as const, month: '2026-10' },
    ]
    const h = buildHistory({ ...october(), periodTotals: [...october().periodTotals, ...november().periodTotals], payments, fx: 123 })
    expect(h.rows.map((r) => r.month)).toEqual(['2026-11', '2026-10'])
    expect(h.rows[0]).toMatchObject({ current: true, earnedCents: 27457, paidCents: 0, status: 'none' })
    expect(h.rows[1]).toMatchObject({ current: false, earnedCents: 76510, paidCents: 78200, gapCents: -1690, status: 'paid' })
    expect(h.totals).toMatchObject({ earnedCents: 76510 + 27457, paidCents: 78200, gapCents: 76510 + 27457 - 78200 })

    const csv = historyToCSV(h).split('\n')
    expect(csv[1]).toBe('"October 2026",2026-10-01,2026-10-31,174:40:48,174.6800,765.10,782.00,-16.90,paid')
    expect(csv[3]).toContain('"Total"')
  })
})

describe('changing the period start day', () => {
  it('flags a tracker total that a newer one in the same period hides', () => {
    const cards = [card('2026-10', '2026-10-12', '2026-10-30', '118:40:48', '519.82'), card('2026-11', '2026-11-02', '2026-11-11', '62:41:12', '274.57')]
    expect(uncountedCards(cards, 1)).toEqual([])
    expect(uncountedCards(cards, 26).map((c) => c.endDate)).toEqual(['2026-10-30'])
  })
})
