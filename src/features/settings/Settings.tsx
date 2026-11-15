import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { Calculator, ChevronRight, Download, Gauge, RefreshCw, Share2, Trash2, Upload } from 'lucide-react'
import { BackupError, formatShortDate, parseBackup, serializeBackup } from '@/engine'
import { loadSample, pickData, useData } from '@/store/data'
import { useToday } from '@/store/hooks'
import { AffixInput, Button, Card, CardHeader, Field, Input, PageHeader, Segmented, Switch } from '@/components/ui'
import { downloadText } from '@/lib/download'
import { fetchUsdRate } from '@/lib/fx'
import { undoToast } from '@/lib/toast'

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Settings" subtitle="All data stays on this device." />
      <MoreLinks />
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <div className="flex flex-col gap-5">
          <CurrencyCard />
          <DisplayCard />
        </div>
        <div className="flex flex-col gap-5">
          <ProfileCard />
          <DataCard />
        </div>
      </div>
    </div>
  )
}

function MoreLinks() {
  const items: Array<{ href: string; label: string; hint: string; icon: typeof Gauge }> = [
    { href: '/rates', label: 'Rate & schedule', hint: 'Rate history, working days, pay period, holidays', icon: Gauge },
    { href: '/what-if', label: 'What-if', hint: 'Scenarios, rate comparison, offers', icon: Calculator },
    { href: '/share', label: 'Share & export', hint: 'Message for your manager, CSV, statement', icon: Share2 },
  ]
  return (
    <Card className="lg:hidden">
      <ul className="divide-y divide-line">
        {items.map(({ href, label, hint, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-3 px-5 py-3 hover:bg-surface-2">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-muted">{hint}</span>
              </span>
              <ChevronRight className="size-5 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="px-5 pt-4 pb-5">{children}</div>
}

function CurrencyCard() {
  const { settings, updateSettings } = useData(useShallow((s) => ({ settings: s.settings, updateSettings: s.updateSettings })))
  const today = useToday()
  const [rate, setRate] = useState(String(settings.exchangeRate))
  const [busy, setBusy] = useState(false)

  const fetchRate = async () => {
    setBusy(true)
    try {
      const r = await fetchUsdRate(settings.displayCurrency)
      updateSettings({ exchangeRate: r, exchangeRateUpdatedAt: today })
      setRate(String(r))
      toast.success(`Rate updated: ${settings.displaySymbol}${r.toFixed(2)} per $1`)
    } catch (e) {
      toast.error(`Couldn't fetch the rate. ${e instanceof Error ? e.message : ''} Your manual rate still works.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Currency" hint="Earnings are calculated in USD and also shown in your local currency." />
      <Row>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Display currency" htmlFor="cur-code">
              <Input
                id="cur-code"
                value={settings.displayCurrency}
                maxLength={3}
                onChange={(e) => updateSettings({ displayCurrency: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Symbol" htmlFor="cur-symbol">
              <Input id="cur-symbol" value={settings.displaySymbol} maxLength={4} onChange={(e) => updateSettings({ displaySymbol: e.target.value })} />
            </Field>
          </div>
          <Field
            label={`Exchange rate (${settings.displaySymbol} per $1)`}
            htmlFor="cur-rate"
            hint={
              <>
                <span className="num">
                  {settings.displaySymbol}
                  {settings.exchangeRate.toFixed(2)} per $1, set {formatShortDate(settings.exchangeRateUpdatedAt)}.
                </span>{' '}
                A bank's actual rate may differ.
              </>
            }
          >
            <div className="flex gap-2">
              <AffixInput
                id="cur-rate"
                prefix={settings.displaySymbol}
                inputMode="decimal"
                value={rate}
                onChange={(e) => {
                  setRate(e.target.value)
                  const v = Number(e.target.value)
                  if (Number.isFinite(v) && v > 0) updateSettings({ exchangeRate: v, exchangeRateUpdatedAt: today, exchangeRateSource: 'manual' })
                }}
              />
              <Button onClick={fetchRate} disabled={busy} aria-label="Fetch latest exchange rate">
                <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} aria-hidden />
                <span className="hidden sm:inline">Fetch latest</span>
              </Button>
            </div>
          </Field>
        </div>
      </Row>
    </Card>
  )
}

function DisplayCard() {
  const { settings, updateSettings } = useData(useShallow((s) => ({ settings: s.settings, updateSettings: s.updateSettings })))
  return (
    <Card>
      <CardHeader title="Display" />
      <Row>
        <div className="flex flex-col gap-5">
          <Field label="Time format">
            <Segmented
              label="Time format"
              value={settings.timeFormat}
              onChange={(timeFormat) => updateSettings({ timeFormat })}
              options={[
                { value: 'hms', label: '118:40:48' },
                { value: 'decimal', label: '118.68 h' },
              ]}
            />
          </Field>
          <Field label="Theme">
            <Segmented
              label="Theme"
              value={settings.theme}
              onChange={(theme) => updateSettings({ theme })}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </Field>
          <Switch
            checked={settings.countTodayAsWorked}
            onCheckedChange={(countTodayAsWorked) => updateSettings({ countTodayAsWorked })}
            label="Count today as worked"
            description="When on, remaining days in projections start tomorrow."
          />
        </div>
      </Row>
    </Card>
  )
}

function ProfileCard() {
  const { name, updateSettings } = useData(useShallow((s) => ({ name: s.settings.name, updateSettings: s.updateSettings })))
  return (
    <Card>
      <CardHeader title="Profile" />
      <Row>
        <Field label="Your name" htmlFor="profile-name" hint="Optional. Shown on statements and messages.">
          <Input id="profile-name" value={name} onChange={(e) => updateSettings({ name: e.target.value })} autoComplete="name" />
        </Field>
      </Row>
    </Card>
  )
}

function DataCard() {
  const { replaceAll, resetAll } = useData(useShallow((s) => ({ replaceAll: s.replaceAll, resetAll: s.resetAll })))
  const today = useToday()
  const file = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const importFile = async (f: File) => {
    try {
      const data = parseBackup(await f.text())
      undoToast(`Imported ${data.entries.length} entries and ${data.payments.length} payments`, replaceAll(data))
    } catch (e) {
      toast.error(e instanceof BackupError ? e.message : 'Could not read that file.')
    }
  }

  return (
    <Card>
      <CardHeader title="Data" hint="Saved automatically in this browser. Export a backup to move devices." />
      <Row>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadText(`earnings-backup-${today}.json`, serializeBackup(pickData(useData.getState())), 'application/json')}>
            <Download className="size-4" aria-hidden /> Export backup
          </Button>
          <Button onClick={() => file.current?.click()}>
            <Upload className="size-4" aria-hidden /> Import backup
          </Button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importFile(f)
              e.target.value = ''
            }}
          />
          <Button variant="ghost" onClick={() => undoToast('Sample data loaded', loadSample())}>
            Load sample data
          </Button>
        </div>
        <div className="mt-5 border-t border-line pt-4">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">Delete every entry, rate, payment and setting?</span>
              <Button
                variant="danger"
                onClick={() => {
                  undoToast('All data deleted', resetAll())
                  setConfirmDelete(false)
                }}
              >
                Yes, delete all
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" aria-hidden /> Delete all data
            </Button>
          )}
        </div>
      </Row>
    </Card>
  )
}
