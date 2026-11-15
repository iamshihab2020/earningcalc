import { create } from 'zustand'
import { addMonths, periodOf, todayISO, type ISODate, type Payment, type PeriodTotal, type TimeEntry, type YearMonth } from '@/engine'
import { useData } from './data'

export type AddTimeTab = 'single' | 'backfill' | 'card'

interface UIState {
  month: YearMonth
  setMonth(month: YearMonth): void
  shiftMonth(delta: number): void

  /** Hours/day used by the "keep going" projection; null = daily target. */
  projectionHours: number | null
  setProjectionHours(h: number | null): void

  addTime: { open: boolean; tab: AddTimeTab; editing: TimeEntry | null; editingCard: PeriodTotal | null; date?: ISODate }
  openAddTime(opts?: { tab?: AddTimeTab; editing?: TimeEntry; editingCard?: PeriodTotal; date?: ISODate }): void
  closeAddTime(): void

  paymentOpen: boolean
  editingPayment: Payment | null
  setPaymentOpen(open: boolean, editing?: Payment): void

  rateChange: { open: boolean; amount?: number }
  openRateChange(amount?: number): void
  closeRateChange(): void
}

export const useUI = create<UIState>()((set) => ({
  // The pay period that contains today (persisted settings are already loaded from localStorage).
  month: periodOf(todayISO(), useData.getState().settings.periodStartDay),
  setMonth: (month) => set({ month }),
  shiftMonth: (delta) => set((s) => ({ month: addMonths(s.month, delta) })),

  projectionHours: null,
  setProjectionHours: (projectionHours) => set({ projectionHours }),

  addTime: { open: false, tab: 'single', editing: null, editingCard: null },
  openAddTime: (opts = {}) =>
    set({
      addTime: {
        open: true,
        tab: opts.tab ?? (opts.editingCard ? 'card' : 'single'),
        editing: opts.editing ?? null,
        editingCard: opts.editingCard ?? null,
        date: opts.date,
      },
    }),
  closeAddTime: () => set((s) => ({ addTime: { ...s.addTime, open: false } })),

  paymentOpen: false,
  editingPayment: null,
  setPaymentOpen: (paymentOpen, editing) =>
    set((s) => ({ paymentOpen, editingPayment: paymentOpen ? (editing ?? null) : s.editingPayment })),

  rateChange: { open: false },
  openRateChange: (amount) => set({ rateChange: { open: true, amount } }),
  closeRateChange: () => set((s) => ({ rateChange: { ...s.rateChange, open: false } })),
}))
