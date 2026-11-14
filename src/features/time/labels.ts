import type { EntryType } from '@/engine'

export const entryTypeLabel: Record<EntryType, string> = {
  tracked: 'Tracked',
  backfill: 'Backfill',
  adjustment: 'Adjustment',
}

export const entryTypeHint: Record<EntryType, string> = {
  tracked: 'From your tracker',
  backfill: 'Added by management',
  adjustment: 'Manual correction (can be negative)',
}
