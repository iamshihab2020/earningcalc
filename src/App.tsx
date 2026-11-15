import { Route, Router, Switch, Link, useLocation } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { Toaster } from 'sonner'
import { Calculator, Clock, Gauge, History as HistoryIcon, House, Plus, Settings as SettingsIcon, Share2, Wallet } from 'lucide-react'
import { useEffect } from 'react'
import { useData } from '@/store/data'
import { useThemeClass } from '@/store/hooks'
import { useUI } from '@/store/ui'
import { cn } from '@/components/ui'
import { AddTimeSheet } from '@/features/time/AddTimeSheet'
import { PaymentSheet } from '@/features/payments/PaymentSheet'
import { RateChangeSheet } from '@/features/rates/RateChangeSheet'
import { Dashboard } from '@/features/dashboard/Dashboard'
import { TimeLog } from '@/features/time/TimeLog'
import { Payments } from '@/features/payments/Payments'
import { RatesSchedule } from '@/features/rates/RatesSchedule'
import { WhatIf } from '@/features/whatif/WhatIf'
import { Share } from '@/features/share/Share'
import { SettingsPage } from '@/features/settings/Settings'
import { Statement } from '@/features/share/Statement'
import { History } from '@/features/history/History'

const primaryNav = [
  { href: '/', label: 'Home', icon: House },
  { href: '/time', label: 'Time', icon: Clock },
  { href: '/payments', label: 'Payments', icon: Wallet },
  { href: '/history', label: 'History', icon: HistoryIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
]
const secondaryNav = [
  { href: '/rates', label: 'Rate & schedule', icon: Gauge },
  { href: '/what-if', label: 'What-if', icon: Calculator },
  { href: '/share', label: 'Share & export', icon: Share2 },
]

function NavLink({ href, label, icon: Icon, variant }: (typeof primaryNav)[number] & { variant: 'side' | 'tab' }) {
  const [location] = useLocation()
  const active = href === '/' ? location === '/' : location.startsWith(href)
  if (variant === 'tab') {
    return (
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition',
          active ? 'text-primary' : 'text-muted hover:text-fg',
        )}
      >
        <Icon className="size-[22px]" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
        {label}
      </Link>
    )
  }
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-[0.9375rem] font-medium transition',
        active ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  )
}

function ScrollToTop() {
  const [location] = useLocation()
  useEffect(() => {
    // Newer Chrome returns a Promise from scrollTo; never return it from an effect.
    window.scrollTo(0, 0)
  }, [location])
  return null
}

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <Shell />
    </Router>
  )
}

function Shell() {
  useThemeClass()
  const theme = useData((s) => s.settings.theme)
  const openAddTime = useUI((s) => s.openAddTime)
  const [location] = useLocation()

  return (
    <>
      <ScrollToTop />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="lg:flex">
        {/* Desktop sidebar */}
        <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-line bg-surface px-4 py-6 lg:flex">
          <div className="flex items-center gap-2.5 px-2">
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="size-8" />
            <span className="text-lg font-semibold tracking-tight">Earnings</span>
          </div>
          <nav aria-label="Main" className="flex flex-col gap-1">
            {primaryNav.slice(0, 4).map((n) => (
              <NavLink key={n.href} {...n} variant="side" />
            ))}
            <div className="my-2 h-px bg-line" />
            {secondaryNav.map((n) => (
              <NavLink key={n.href} {...n} variant="side" />
            ))}
            <div className="my-2 h-px bg-line" />
            <NavLink {...primaryNav[4]} variant="side" />
          </nav>
          <button
            type="button"
            onClick={() => openAddTime()}
            className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-primary px-4 font-medium text-primary-fg shadow-sm hover:brightness-110"
          >
            <Plus className="size-5" aria-hidden /> Add time
          </button>
        </aside>

        <main id="main" className="mx-auto w-full max-w-6xl min-w-0 px-4 pt-4 pb-32 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/time" component={TimeLog} />
            <Route path="/payments" component={Payments} />
            <Route path="/history" component={History} />
            <Route path="/rates" component={RatesSchedule} />
            <Route path="/what-if" component={WhatIf} />
            <Route path="/share" component={Share} />
            <Route path="/statement" component={Statement} />
            <Route path="/settings" component={SettingsPage} />
            <Route>
              <p className="py-20 text-center text-muted">
                Page not found. <Link href="/" className="text-primary underline">Go home</Link>
              </p>
            </Route>
          </Switch>
        </main>
      </div>

      {/* Mobile: floating add button + bottom tabs */}
      {(location === '/' || location.startsWith('/time')) && (
        <button
          type="button"
          onClick={() => openAddTime()}
          aria-label="Add time"
          className="no-print fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg shadow-primary/30 transition hover:brightness-110 active:scale-95 lg:hidden"
        >
          <Plus className="size-7" aria-hidden />
        </button>
      )}
      <nav
        aria-label="Main"
        className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {primaryNav.map((n) => (
          <NavLink key={n.href} {...n} variant="tab" />
        ))}
      </nav>

      <AddTimeSheet />
      <PaymentSheet />
      <RateChangeSheet />
      <Toaster
        theme={theme}
        position="bottom-center"
        offset={{ bottom: 88 }}
        mobileOffset={{ bottom: 88 }}
        toastOptions={{ className: 'font-sans' }}
      />
    </>
  )
}
