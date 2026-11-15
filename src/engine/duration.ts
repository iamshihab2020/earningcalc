import { parseScaled } from './money'
/**
 * Durations are integer seconds. Input accepts `118:40:48`, `118:40`,
 * `118.68` (decimal hours), and friendly forms like `8h 30m`.
 */

export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  const negative = s.startsWith('-')
  const body = negative ? s.slice(1).trim() : s
  const sign = negative ? -1 : 1

  // HH:MM[:SS]
  const colon = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.exec(body)
  if (colon) {
    const [, h, m, sec] = colon
    return sign * (Number(h) * 3600 + Number(m) * 60 + Number(sec ?? 0))
  }

  // Decimal hours: 118.68, 8, .5
  if (/^(\d+\.?\d*|\.\d+)$/.test(body)) {
    return sign * Math.round(Number(body) * 3600)
  }

  // 8h 30m 15s, 8h, 45m
  const unit = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/.exec(body)
  if (unit && (unit[1] || unit[2] || unit[3])) {
    const h = Number(unit[1] ?? 0)
    const m = Number(unit[2] ?? 0)
    const sec = Number(unit[3] ?? 0)
    return sign * Math.round(h * 3600 + m * 60 + sec)
  }
  return null
}

/** 427248 → "118:40:48" */
export function formatHMS(seconds: number): string {
  const sign = seconds < 0 ? '−' : ''
  const abs = Math.abs(Math.round(seconds))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  return `${sign}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const secondsToHours = (seconds: number) => seconds / 3600

/** 427248 → "118.68" (rounded half away from zero). */
export function formatHours(seconds: number, decimals = 2): string {
  const factor = 10 ** decimals
  const h = seconds / 3600
  const rounded = (Math.sign(h) * Math.round(Math.abs(h) * factor + 1e-9)) / factor
  return rounded.toFixed(decimals)
}

/** Respect the user's time-format preference. */
export function formatDuration(seconds: number, format: 'hms' | 'decimal'): string {
  return format === 'hms' ? formatHMS(seconds) : `${formatHours(seconds)} h`
}

/** Compact hours for prose: "6.7 h", "4 h". */
export function formatHoursShort(seconds: number, decimals = 1): string {
  const value = Number(formatHours(seconds, decimals))
  return `${Number.isInteger(value) ? value.toFixed(0) : value} h`
}

/**
 * Pull "Total time" and "Total earned" out of a summary copied from a tracker,
 * e.g. "Total time 126:13:47 … Total earned $552.89". Either may be missing.
 */
export function parseTrackerSummary(text: string): { seconds: number | null; cents: number | null } {
  const time = /total\s*time\D{0,40}?(\d+:\d{2}(?::\d{2})?)/i.exec(text)
  const earned = /total\s*earned[^\d]{0,40}?(\d[\d,]*(?:\.\d{1,2})?)/i.exec(text)
  const cents = earned ? parseScaled(earned[1], 2) : null
  return { seconds: time ? parseDuration(time[1]) : null, cents }
}
