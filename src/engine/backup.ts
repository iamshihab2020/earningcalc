import { formatHMS, formatHours } from './duration'
import { isISODate } from './dates'
import type { MonthSummary } from './month'
import type { AppData } from './types'

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** One month as CSV: the tracker card (if any) then every entry. */
export function monthToCSV(summary: MonthSummary): string {
  const rows: Array<Array<string | number>> = [
    ['date', 'end_date', 'type', 'duration', 'hours', 'rate_usd', 'amount_usd', 'counted', 'note'],
  ]
  const card = summary.card
  if (card) {
    rows.push([
      card.card.startDate,
      card.card.endDate,
      'tracker_total',
      formatHMS(card.card.seconds),
      formatHours(card.card.seconds, 4),
      card.segments.map((s) => (s.rate4 / 10_000).toFixed(4)).join('|'),
      (card.usedCents / 100).toFixed(2),
      'yes',
      `tracker said ${(card.trackerCents / 100).toFixed(2)}, app calculated ${(card.appCents / 100).toFixed(2)}`,
    ])
  }
  for (const v of [...summary.entries].reverse()) {
    rows.push([
      v.entry.date,
      '',
      v.entry.type,
      formatHMS(v.entry.seconds),
      formatHours(v.entry.seconds, 4),
      (v.rate4 / 10_000).toFixed(4),
      (v.cents / 100).toFixed(2),
      v.covered ? 'no (in tracker total)' : 'yes',
      v.entry.note ?? '',
    ])
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n'
}

export function serializeBackup(data: AppData): string {
  return JSON.stringify({ app: 'earnings-tracker', exportedAt: new Date().toISOString(), data }, null, 2)
}

export class BackupError extends Error {}

const isArray = (v: unknown): v is unknown[] => Array.isArray(v)
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !isArray(v)

/** Parse and sanity-check a backup file. Throws BackupError with a readable reason. */
export function parseBackup(text: string): AppData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('This file is not valid JSON.')
  }
  const data = isObj(raw) && isObj(raw.data) ? raw.data : raw
  if (!isObj(data) || data.version !== 1) throw new BackupError('This is not an Earnings Tracker backup.')
  for (const key of ['rates', 'entries', 'periodTotals', 'daysOff', 'payments'] as const) {
    if (!isArray(data[key])) throw new BackupError(`The backup is missing "${key}".`)
  }
  if (!isObj(data.settings)) throw new BackupError('The backup is missing settings.')
  const dated = [
    ...(data.entries as Array<{ date?: unknown }>).map((e) => e.date),
    ...(data.payments as Array<{ date?: unknown }>).map((p) => p.date),
    ...(data.rates as Array<{ effectiveFrom?: unknown }>).map((r) => r.effectiveFrom),
  ]
  if (dated.some((d) => typeof d !== 'string' || !isISODate(d))) {
    throw new BackupError('The backup has a date that is not in YYYY-MM-DD form.')
  }
  return data as unknown as AppData
}
