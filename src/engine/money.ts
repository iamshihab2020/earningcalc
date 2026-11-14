/**
 * Exact money arithmetic on integers. Nothing in here multiplies a float by a
 * price: amounts are cents, rates are ten-thousandths of a dollar.
 */

/** Integer division rounding half away from zero (financial "half-up"). */
export function divRound(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  const sign = Math.sign(numerator) * Math.sign(denominator)
  const n = Math.abs(numerator)
  const d = Math.abs(denominator)
  const q = Math.floor(n / d)
  const r = n - q * d
  return sign * (r * 2 >= d ? q + 1 : q) || 0
}

/** Parse a decimal string into an integer scaled by 10^places, without float math. */
export function parseScaled(input: string, places: number): number | null {
  const s = input.trim().replace(/[\s,$৳€£]/g, '')
  const m = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(s)
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) return null
  const sign = m[1] === '-' ? -1 : 1
  const whole = m[2] || '0'
  const frac = m[3] ?? ''
  const kept = frac.slice(0, places).padEnd(places, '0')
  let value = Number(whole) * 10 ** places + Number(kept || '0')
  // Round on the first dropped digit.
  if (frac.length > places && Number(frac[places]) >= 5) value += 1
  return sign * value || 0
}

export const parseCents = (input: string) => parseScaled(input, 2)

/** Number (≤ 4 decimals) → rate4 integer. */
export function toRate4(amount: number): number {
  return parseScaled(amount.toFixed(6), 4) ?? 0
}

export const fromRate4 = (rate4: number) => rate4 / 10_000

/** Value of `seconds` at `rate4`, rounded half-up to the cent. */
export function earnCents(seconds: number, rate4: number): number {
  // seconds × (USD×10⁴/h) / 3600 s/h / 100 cents/USD → cents
  return divRound(seconds * rate4, 360_000)
}

/** Hours (as seconds) that `cents` buys at `rate4`. */
export function centsToSeconds(cents: number, rate4: number): number {
  if (rate4 === 0) return 0
  return divRound(cents * 360_000, rate4)
}

/** Implied hourly rate (rate4) of `cents` over `seconds`. */
export function impliedRate4(cents: number, seconds: number): number {
  if (seconds === 0) return 0
  return divRound(cents * 360_000, seconds)
}

/** USD cents → display-currency minor units at `fx` units per USD. */
export function convertCents(usdCents: number, fx: number): number {
  return divRound(usdCents * toRate4(fx), 10_000)
}

/** Display-currency minor units → USD cents at `fx` units per USD. */
export function toUsdCents(minor: number, fx: number): number {
  const fx4 = toRate4(fx)
  if (fx4 === 0) return 0
  return divRound(minor * 10_000, fx4)
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

export function formatUSD(cents: number): string {
  return usd.format(cents / 100)
}

/** Signed USD, e.g. "+$16.90" / "−$4.20". */
export function formatSignedUSD(cents: number): string {
  if (cents === 0) return usd.format(0)
  return (cents > 0 ? '+' : '−') + usd.format(Math.abs(cents) / 100)
}

/** Display currency, whole units by default: "৳94,107". */
export function formatLocal(minor: number, symbol: string, decimals = 0): string {
  const units = decimals === 0 ? divRound(minor, 100) : minor / 100
  const abs = Math.abs(units).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return (units < 0 ? '−' : '') + symbol + abs
}

/** "$4.38" — the PRD displays rates to 2 decimals. */
export function formatRate(rate4: number, maxDecimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  }).format(rate4 / 10_000)
}
