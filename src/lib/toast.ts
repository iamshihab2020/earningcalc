import { toast } from 'sonner'
import type { Undo } from '@/store/data'

/** Every destructive action gets an Undo (PRD §5.1 "Never lose data"). */
export function undoToast(message: string, undo: Undo) {
  toast(message, { action: { label: 'Undo', onClick: () => undo() }, duration: 7000 })
}

export const done = (message: string) => toast.success(message, { duration: 3000 })
