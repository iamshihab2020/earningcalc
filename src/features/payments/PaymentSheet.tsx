import { useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Trash2 } from 'lucide-react'
import {
  addMonths,
  formatMonth,
  formatUSD,
  isISODate,
  parseCents,
  paymentUsdCents,
  type Payment,
  type PaymentCurrency,
} from '@/engine'
import { useData } from '@/store/data'
import { useToday } from '@/store/hooks'
import { useUI } from '@/store/ui'
import { AffixInput, Button, Field, Input, Segmented, Sheet } from '@/components/ui'
import { undoToast } from '@/lib/toast'

export function PaymentSheet() {
  const { paymentOpen, editingPayment, setPaymentOpen } = useUI(
    useShallow((s) => ({ paymentOpen: s.paymentOpen, editingPayment: s.editingPayment, setPaymentOpen: s.setPaymentOpen })),
  )
  return (
    <Sheet
      open={paymentOpen}
      onOpenChange={(o) => setPaymentOpen(o)}
      title={editingPayment ? 'Edit payment' : 'Record payment'}
      description="Log money you received so it can be checked against what you earned."
    >
      <PaymentForm key={`${paymentOpen}-${editingPayment?.id ?? 'new'}`} editing={editingPayment} onDone={() => setPaymentOpen(false)} />
    </Sheet>
  )
}

function PaymentForm({ editing, onDone }: { editing: Payment | null; onDone: () => void }) {
  const { settings, addPayment, updatePayment, deletePayment } = useData(
    useShallow((s) => ({ settings: s.settings, addPayment: s.addPayment, updatePayment: s.updatePayment, deletePayment: s.deletePayment })),
  )
  const today = useToday()
  const selected = useUI((s) => s.month)
  const [date, setDate] = useState(editing?.date ?? today)
  const [amount, setAmount] = useState(editing ? (editing.amountCents / 100).toFixed(2) : '')
  const [currency, setCurrency] = useState<PaymentCurrency>(editing?.currency ?? 'USD')
  const [fx, setFx] = useState(String(editing?.exchangeRate ?? settings.exchangeRate))
  const [month, setMonth] = useState(editing?.month ?? selected)
  const [note, setNote] = useState(editing?.note ?? '')
  const [touched, setTouched] = useState(false)

  const cents = parseCents(amount)
  const fxNum = Number(fx)
  const fxValid = currency === 'USD' || (Number.isFinite(fxNum) && fxNum > 0)
  const preview =
    cents && cents > 0 && fxValid
      ? paymentUsdCents({ id: '', date, amountCents: cents, currency, exchangeRate: fxNum, month }, settings.exchangeRate)
      : null
  const monthChoices = [...new Set([addMonths(selected, -1), selected, month])].sort()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!cents || cents <= 0 || !isISODate(date) || !fxValid || !/^\d{4}-\d{2}$/.test(month)) return
    const payment = {
      date,
      amountCents: cents,
      currency,
      exchangeRate: currency === 'USD' ? undefined : fxNum,
      month,
      note: note.trim() || undefined,
    }
    if (editing) undoToast('Payment updated', updatePayment({ ...editing, ...payment }))
    else undoToast(`Recorded ${currency === 'USD' ? formatUSD(cents) : `${settings.displaySymbol}${amount}`} for ${formatMonth(month)}`, addPayment(payment))
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Amount" htmlFor="pay-amount" error={touched && (!cents || cents <= 0) ? 'Enter the amount you received' : null}>
          <AffixInput
            id="pay-amount"
            prefix={currency === 'USD' ? '$' : settings.displaySymbol}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="text-lg font-semibold"
            autoFocus
            aria-invalid={touched && (!cents || cents <= 0)}
          />
        </Field>
        <Field label="Currency">
          <Segmented
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={[
              { value: 'USD', label: 'USD' },
              { value: 'BDT', label: settings.displayCurrency },
            ]}
          />
        </Field>
      </div>
      {currency !== 'USD' && (
        <Field
          label={`Exchange rate (${settings.displaySymbol} per $1)`}
          htmlFor="pay-fx"
          hint={preview !== null ? `Counts as ${formatUSD(preview)}` : 'Use the rate your bank actually gave you'}
          error={!fxValid ? 'Enter a rate above zero' : null}
        >
          <Input id="pay-fx" inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date received" htmlFor="pay-date">
          <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Pays for" htmlFor="pay-month" hint="The month of work">
          <Input id="pay-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
      </div>
      <div className="-mt-1 flex flex-wrap gap-2">
        {monthChoices.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMonth(m)}
            aria-pressed={m === month}
            className="min-h-9 rounded-full border border-line px-3 text-sm font-medium aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary"
          >
            {formatMonth(m)}
          </button>
        ))}
      </div>
      <Field label="Note" htmlFor="pay-note" hint="Optional, e.g. “Oct payout” or “Extra for overtime”">
        <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="sticky bottom-0 -mx-5 mt-2 flex gap-2 border-t border-line bg-surface px-5 pt-3">
        {editing && (
          <Button
            variant="danger"
            onClick={() => {
              undoToast('Payment deleted', deletePayment(editing.id))
              onDone()
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        )}
        <Button type="submit" variant="primary" className="flex-1">
          {editing ? 'Save changes' : 'Record payment'}
        </Button>
      </div>
    </form>
  )
}
