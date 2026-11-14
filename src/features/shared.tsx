import type { ReactNode } from 'react'
import { formatHMS, formatHours, formatHoursShort, formatRange, formatUSD, type CardValuation, type PaymentStatus, type Reconciliation } from '@/engine'
import { useData } from '@/store/data'
import { useFormat } from '@/store/hooks'
import { Button, Chip, Notice, cn } from '@/components/ui'
import { AnimatedNumber } from '@/components/AnimatedNumber'

/** USD with the display-currency value beneath (PRD §3.1). */
export function Money({ cents, size = 'md', animate = false, className }: { cents: number; size?: 'sm' | 'md' | 'lg'; animate?: boolean; className?: string }) {
  const f = useFormat()
  return (
    <div className={cn('num flex min-w-0 flex-col', className)}>
      <span
        className={cn(
          'truncate font-semibold tracking-tight',
          size === 'lg' && 'text-[2.75rem] leading-none sm:text-5xl',
          size === 'md' && 'text-2xl',
          size === 'sm' && 'text-lg',
        )}
      >
        {animate ? <AnimatedNumber value={cents} format={formatUSD} /> : formatUSD(cents)}
      </span>
      <span className={cn('truncate text-muted', size === 'lg' ? 'mt-2 text-lg' : 'text-sm')}>≈ {f.local(cents)}</span>
    </div>
  )
}

export function PaymentChip({ recon }: { recon: Pick<Reconciliation, 'status' | 'gapCents'> }) {
  const map: Record<PaymentStatus, ReactNode> = {
    paid: <Chip tone="success">Paid in full</Chip>,
    short: <Chip tone="warning">Short by {formatUSD(recon.gapCents)}</Chip>,
    none: <Chip tone="neutral">No payment recorded</Chip>,
  }
  return map[recon.status]
}

export function AheadChip({ seconds, className }: { seconds: number; className?: string }) {
  if (Math.abs(seconds) < 180) return <Chip tone="info" className={className}>On standard pace</Chip>
  return seconds > 0 ? (
    <Chip tone="success" className={className}>{formatHoursShort(seconds)} ahead</Chip>
  ) : (
    <Chip tone="warning" className={className}>{formatHoursShort(-seconds)} behind</Chip>
  )
}

/** "Tracker said $X, app calculated $Y" with a choice (PRD §4 edge cases). */
export function CardMismatch({ card }: { card: CardValuation }) {
  const updateCard = useData((s) => s.updateCard)
  if (card.mismatchCents === 0) return null
  const usingTracker = card.card.trust === 'tracker'
  return (
    <Notice tone="info">
      <p>
        Tracker said <strong className="num">{formatUSD(card.trackerCents)}</strong>, app calculated{' '}
        <strong className="num">{formatUSD(card.appCents)}</strong> from your rate history for{' '}
        {formatRange(card.card.startDate, card.card.endDate)}. Counting the {usingTracker ? "tracker's" : "app's"} figure.
      </p>
      <Button
        size="sm"
        variant="ghost"
        className="-ml-3 mt-1 text-primary underline-offset-2 hover:underline"
        onClick={() => updateCard({ ...card.card, trust: usingTracker ? 'app' : 'tracker' })}
      >
        Use the {usingTracker ? "app's" : "tracker's"} figure instead
      </Button>
    </Notice>
  )
}

/** Duration in the user's chosen format, with the other format as a title. */
export function Duration({ seconds, className }: { seconds: number; className?: string }) {
  const f = useFormat()
  return (
    <span className={cn('num', className)} title={`${formatHMS(seconds)} · ${formatHours(seconds)} h`}>
      {f.duration(seconds)}
    </span>
  )
}

export function ScenarioCard({
  label,
  title,
  cents,
  seconds,
  detail,
  highlight,
  children,
}: {
  label: string
  title: string
  cents: number
  seconds: number
  detail?: ReactNode
  highlight?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-[16px] border bg-surface p-4 shadow-card',
        highlight ? 'border-primary/50 ring-1 ring-primary/30' : 'border-line/60',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary" aria-hidden>
          {label}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <Money cents={cents} animate />
      <p className="num text-sm text-muted">
        {formatHours(seconds)} h{detail ? <> · {detail}</> : null}
      </p>
      {children}
    </div>
  )
}
