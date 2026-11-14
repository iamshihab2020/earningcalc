import { forwardRef, useId, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Dialog, Switch as RSwitch, ToggleGroup } from 'radix-ui'
import { AlertTriangle, CheckCircle2, CircleDashed, Info, X, XCircle } from 'lucide-react'

export const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

/* ---------- Button ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg hover:brightness-110 active:brightness-95 shadow-sm',
  secondary: 'bg-surface text-fg border border-line hover:bg-surface-2',
  soft: 'bg-primary-soft text-primary hover:brightness-95 dark:hover:brightness-125',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger-text hover:brightness-95 dark:hover:brightness-125',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'sm' | 'icon'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[12px] font-medium transition select-none',
        'disabled:opacity-50 disabled:pointer-events-none',
        size === 'md' && 'min-h-11 px-4 text-[0.9375rem]',
        size === 'sm' && 'min-h-11 px-3 text-sm sm:min-h-9',
        size === 'icon' && 'size-11 shrink-0',
        variants[variant],
        className,
      )}
      {...rest}
    />
  )
})

/* ---------- Card ---------- */

export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('min-w-0 rounded-[16px] bg-surface shadow-card border border-line/60', className)} {...rest} />
}

export function CardHeader({ title, action, hint }: { title: ReactNode; action?: ReactNode; hint?: ReactNode }) {
  return (
    <div className={cn('flex justify-between gap-3 px-5 pt-5', hint ? 'items-start' : 'items-center')}>
      <div className="min-w-0">
        <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

/* ---------- Form fields ---------- */

const inputBase =
  'w-full min-h-11 rounded-[12px] border border-line bg-surface px-3.5 text-[1rem] text-fg placeholder:text-muted/70 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition aria-[invalid=true]:border-danger'

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  htmlFor?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger-text" role="alert">
          {error}
        </p>
      ) : hint ? (
        <div className="text-sm text-muted">{hint}</div>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(inputBase, 'num', className)} {...rest} />
})

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, 'appearance-none bg-[length:16px] pr-9', className)} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, 'py-3 leading-relaxed', className)} {...rest} />
}

/** Input with a leading symbol, e.g. "$". */
export function AffixInput({
  prefix,
  suffix,
  wrapperClassName,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string; wrapperClassName?: string }) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">{prefix}</span>}
      <Input {...rest} className={cn(prefix && 'pl-8', suffix && 'pr-12', rest.className)} />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted">{suffix}</span>}
    </div>
  )
}

/* ---------- Segmented control (single choice) ---------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: ReactNode }>
  label: string
  className?: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn('grid auto-cols-fr grid-flow-col gap-1 rounded-[12px] bg-surface-2 p-1', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            'min-h-10 rounded-[9px] px-2 text-sm font-medium text-muted transition',
            'data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-sm',
            'hover:text-fg',
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

/* ---------- Switch ---------- */

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label: ReactNode
  description?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[0.9375rem] font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </label>
      <RSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-7 w-12 shrink-0 rounded-full bg-line transition data-[state=checked]:bg-primary"
      >
        <RSwitch.Thumb className="block size-6 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[22px]" />
      </RSwitch.Root>
    </div>
  )
}

/* ---------- Status chip (icon + text + color, never color alone) ---------- */

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'
const toneClass: Record<Tone, string> = {
  success: 'bg-success-soft text-success-text',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
  neutral: 'bg-surface-2 text-fg',
  info: 'bg-primary-soft text-primary',
}
const toneIcon: Record<Tone, typeof Info> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: CircleDashed,
  info: Info,
}

export function Chip({ tone, children, icon = true, className }: { tone: Tone; children: ReactNode; icon?: boolean; className?: string }) {
  const Icon = toneIcon[tone]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium whitespace-nowrap', toneClass[tone], className)}>
      {icon && <Icon className="size-4 shrink-0" aria-hidden />}
      {children}
    </span>
  )
}

export function Notice({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  const Icon = toneIcon[tone]
  return (
    <div className={cn('flex gap-2.5 rounded-[12px] px-3.5 py-3 text-sm', toneClass[tone], className)} role="status">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/* ---------- Sheet: bottom sheet on mobile, centered dialog on desktop ---------- */

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex max-h-[92dvh] flex-col bg-surface shadow-2xl focus:outline-none',
            'inset-x-0 bottom-0 rounded-t-[20px] data-[state=open]:animate-[sheet-up_220ms_cubic-bezier(0.2,0.8,0.2,1)]',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px]',
            'sm:data-[state=open]:animate-[pop-in_180ms_ease-out]',
          )}
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2 sm:pt-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" className="-mt-1 -mr-2">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-5">{children}</div>
          {footer && (
            <div className="flex gap-2 border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* ---------- Misc ---------- */

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[0.9375rem] text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-[16px] border border-line/60 bg-surface p-4 shadow-card', className)}>
      <span className="text-xs font-semibold tracking-wider text-muted uppercase">{label}</span>
      <span className="num truncate text-xl font-semibold sm:text-2xl">{value}</span>
      {sub && <span className="num truncate text-sm text-muted">{sub}</span>}
    </div>
  )
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      {icon && <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <p className="max-w-sm text-[0.9375rem] text-muted">{children}</p>}
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
