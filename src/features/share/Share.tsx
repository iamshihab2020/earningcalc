import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import { Copy, FileJson, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { buildMessage, monthToCSV, serializeBackup } from '@/engine'
import { pickData, useData } from '@/store/data'
import { useMonthView } from '@/store/hooks'
import { useUI } from '@/store/ui'
import { MonthSelector } from '@/components/MonthSelector'
import { Button, Card, CardHeader, PageHeader, Textarea } from '@/components/ui'
import { copyText, downloadText } from '@/lib/download'

export function Share() {
  const month = useUI((s) => s.month)
  const { summary, recon, settings } = useMonthView(month)
  const generated = buildMessage({ name: settings.name, summary, recon, fx: settings.exchangeRate, symbol: settings.displaySymbol })
  const [text, setText] = useState(generated)
  const [edited, setEdited] = useState(false)

  // Follow the numbers until the user edits the text.
  useEffect(() => {
    if (!edited) setText(generated)
  }, [generated, edited])

  const copy = async () => {
    if (await copyText(text)) toast.success('Copied. Paste it into Slack or email.')
    else toast.error('Could not copy. Select the text and copy it manually.')
  }

  const exportJSON = () => downloadText(`earnings-backup-${month}.json`, serializeBackup(pickData(useData.getState())), 'application/json')

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Share & export" subtitle="A ready-to-send summary, plus files for your records." />
      <MonthSelector />

      <Card>
        <CardHeader
          title="Message"
          hint="Slack-friendly summary: hours, rate, payment and questions. Edit anything before copying."
          action={
            edited ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEdited(false)
                  setText(generated)
                }}
              >
                <RefreshCw className="size-4" aria-hidden /> Regenerate
              </Button>
            ) : null
          }
        />
        <div className="flex flex-col gap-3 px-5 pt-4 pb-5">
          <label htmlFor="message" className="sr-only">
            Message text
          </label>
          <Textarea
            id="message"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setEdited(true)
            }}
            rows={16}
            className="font-mono text-sm"
          />
          <Button variant="primary" onClick={copy} className="self-start">
            <Copy className="size-4" aria-hidden /> Copy message
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Export this month" />
        <div className="flex flex-wrap gap-2 px-5 pt-4 pb-5">
          <Button onClick={() => downloadText(`earnings-${month}.csv`, monthToCSV(summary), 'text/csv')}>
            <FileSpreadsheet className="size-4" aria-hidden /> CSV
          </Button>
          <Button onClick={exportJSON}>
            <FileJson className="size-4" aria-hidden /> JSON backup
          </Button>
          <Link
            href="/statement"
            className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-line bg-surface px-4 text-[0.9375rem] font-medium hover:bg-surface-2"
          >
            <Printer className="size-4" aria-hidden /> Printable statement
          </Link>
        </div>
      </Card>
    </div>
  )
}
