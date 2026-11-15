import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  periodOf,
  todayISO,
  type AppData,
  type DayOff,
  type Payment,
  type PeriodTotal,
  type RatePeriod,
  type Settings,
  type TimeEntry,
} from '@/engine'
import { sampleData } from './sample'

export type Undo = () => void

type Collections = Pick<AppData, 'entries' | 'periodTotals' | 'daysOff' | 'payments'>
type CollectionKey = keyof Collections
type Item = { id: string }
interface Change {
  key: CollectionKey
  before: Item | null
  after: Item | null
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const defaultSettings = (): Settings => ({
  name: '',
  displayCurrency: 'BDT',
  displaySymbol: '৳',
  exchangeRate: 123,
  exchangeRateUpdatedAt: todayISO(),
  exchangeRateSource: 'manual',
  dailyTargetHours: 8,
  workingDays: [1, 2, 3, 4, 5],
  timeFormat: 'hms',
  theme: 'system',
  countTodayAsWorked: true,
  periodStartDay: 1,
})

export const emptyData = (): AppData => ({
  version: 1,
  settings: defaultSettings(),
  rates: [],
  entries: [],
  periodTotals: [],
  daysOff: [],
  payments: [],
})

interface Actions {
  addEntries(entries: Array<Omit<TimeEntry, 'id'>>): Undo
  updateEntry(entry: TimeEntry): Undo
  deleteEntry(id: string): Undo
  /** Save a tracker reading; replaces any existing reading for that month. */
  /** Save a tracker total, replacing the one in its pay period (and `replaceId`, when editing). */
  saveCard(card: Omit<PeriodTotal, 'id'>, replaceId?: string): Undo
  updateCard(card: PeriodTotal): Undo
  deleteCard(id: string): Undo
  setRates(rates: RatePeriod[]): Undo
  addDaysOff(days: Array<Omit<DayOff, 'id'>>): Undo
  deleteDayOff(id: string): Undo
  addPayment(payment: Omit<Payment, 'id'>): Undo
  updatePayment(payment: Payment): Undo
  deletePayment(id: string): Undo
  updateSettings(patch: Partial<Settings>): void
  replaceAll(data: AppData): Undo
  resetAll(): Undo
}

export type DataStore = AppData & Actions

export const pickData = (s: AppData): AppData => ({
  version: 1,
  settings: s.settings,
  rates: s.rates,
  entries: s.entries,
  periodTotals: s.periodTotals,
  daysOff: s.daysOff,
  payments: s.payments,
})

let persistRequested = false
function requestPersistentStorage() {
  if (persistRequested) return
  persistRequested = true
  navigator.storage?.persist?.().catch(() => {})
}

export const useData = create<DataStore>()(
  persist(
    (set, get) => {
      /** Apply item-level changes and return their inverse as an undo. */
      const commit = (changes: Change[]): Undo => {
        const apply = (list: Change[]) =>
          set((state) => {
            const next: Partial<Collections> = {}
            for (const c of list) {
              const current = (next[c.key] ?? state[c.key]) as Item[]
              const id = (c.after ?? c.before)!.id
              let updated: Item[]
              if (!c.after) updated = current.filter((x) => x.id !== id)
              else if (current.some((x) => x.id === id)) updated = current.map((x) => (x.id === id ? c.after! : x))
              else updated = [...current, c.after]
              ;(next as Record<CollectionKey, Item[]>)[c.key] = updated
            }
            return next
          })
        apply(changes)
        requestPersistentStorage()
        return () => apply([...changes].reverse().map((c) => ({ key: c.key, before: c.after, after: c.before })))
      }
      const find = <K extends CollectionKey>(key: K, id: string) =>
        (get()[key] as Item[]).find((x) => x.id === id) ?? null

      const snapshotUndo = (): Undo => {
        const snap = pickData(get())
        return () => set(snap)
      }

      return {
        ...emptyData(),

        addEntries: (entries) =>
          commit(entries.map((e) => ({ key: 'entries', before: null, after: { ...e, id: newId() } }))),
        updateEntry: (entry) => commit([{ key: 'entries', before: find('entries', entry.id), after: entry }]),
        deleteEntry: (id) => commit([{ key: 'entries', before: find('entries', id), after: null }]),

        saveCard: (card, replaceId) => {
          // One tracker total per pay period: the one whose "as of" date is in it.
          const startDay = get().settings.periodStartDay
          const month = periodOf(card.endDate, startDay)
          const existing = get().periodTotals.filter((p) => p.id === replaceId || periodOf(p.endDate, startDay) === month)
          const saved: PeriodTotal = { ...card, month, id: newId() }
          return commit([
            ...existing.map((p) => ({ key: 'periodTotals' as const, before: p, after: null })),
            { key: 'periodTotals', before: null, after: saved },
          ])
        },
        updateCard: (card) => commit([{ key: 'periodTotals', before: find('periodTotals', card.id), after: card }]),
        deleteCard: (id) => commit([{ key: 'periodTotals', before: find('periodTotals', id), after: null }]),

        setRates: (rates) => {
          const before = get().rates
          set({ rates })
          requestPersistentStorage()
          return () => set({ rates: before })
        },

        addDaysOff: (days) => {
          const taken = new Set(get().daysOff.map((d) => d.date))
          return commit(
            days
              .filter((d) => !taken.has(d.date))
              .map((d) => ({ key: 'daysOff', before: null, after: { ...d, id: newId() } })),
          )
        },
        deleteDayOff: (id) => commit([{ key: 'daysOff', before: find('daysOff', id), after: null }]),

        addPayment: (payment) => commit([{ key: 'payments', before: null, after: { ...payment, id: newId() } }]),
        updatePayment: (payment) => commit([{ key: 'payments', before: find('payments', payment.id), after: payment }]),
        deletePayment: (id) => commit([{ key: 'payments', before: find('payments', id), after: null }]),

        updateSettings: (patch) =>
          set((s) => {
            const settings = { ...s.settings, ...patch }
            if (settings.periodStartDay === s.settings.periodStartDay) return { settings }
            // Keep each tracker total's period key in step with the new period boundaries.
            const periodTotals = s.periodTotals.map((p) => ({ ...p, month: periodOf(p.endDate, settings.periodStartDay) }))
            return { settings, periodTotals }
          }),

        replaceAll: (data) => {
          const undo = snapshotUndo()
          set(pickData({ ...emptyData(), ...data, settings: { ...defaultSettings(), ...data.settings } }))
          return undo
        },
        resetAll: () => {
          const undo = snapshotUndo()
          const keepTheme = get().settings.theme
          const fresh = emptyData()
          set({ ...fresh, settings: { ...fresh.settings, theme: keepTheme } })
          return undo
        },
      }
    },
    {
      name: 'earnings-tracker:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => pickData(s),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppData>
        return { ...current, ...p, settings: { ...defaultSettings(), ...p.settings } }
      },
    },
  ),
)

// Another tab saved: load its data, so this tab doesn't show (and later write back) stale numbers.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === useData.persist.getOptions().name) void useData.persist.rehydrate()
  })
}

export const loadSample = () => useData.getState().replaceAll(sampleData(newId))

export const hasAnyData = (s: AppData) =>
  s.rates.length > 0 || s.entries.length > 0 || s.periodTotals.length > 0 || s.payments.length > 0
