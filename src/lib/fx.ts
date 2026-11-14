/**
 * Optional exchange-rate fetch (PRD §3.6, P1). Only the currency code is sent;
 * no user data leaves the device.
 */
export async function fetchUsdRate(currency: string, signal?: AbortSignal): Promise<number> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal })
  if (!res.ok) throw new Error(`Rate service returned ${res.status}`)
  const body = (await res.json()) as { result?: string; rates?: Record<string, number> }
  const rate = body.rates?.[currency.toUpperCase()]
  if (body.result !== 'success' || typeof rate !== 'number' || !(rate > 0)) throw new Error(`No rate for ${currency}`)
  return Math.round(rate * 10_000) / 10_000
}
