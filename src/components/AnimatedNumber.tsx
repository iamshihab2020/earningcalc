import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Briefly tweens a number when it changes (PRD §5.6). Screen readers get only
 * the final value; reduced-motion users see the change instantly.
 */
export function AnimatedNumber({ value, format, duration = 450 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const frame = useRef(0)

  useEffect(() => {
    if (from.current === value) return
    if (prefersReducedMotion()) {
      from.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    const a = from.current
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(p === 1 ? value : a + (value - a) * eased)
      if (p < 1) frame.current = requestAnimationFrame(tick)
      else from.current = value
    }
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame.current)
      from.current = value
    }
  }, [value, duration])

  return (
    <>
      <span aria-hidden>{format(Math.round(shown))}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  )
}
