import { Amount } from '@/onchain-money'
import { USDC_DECIMALS } from './chain'

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

export function usdcFromRaw(raw: bigint | string): Amount {
  return Amount.fromRaw(typeof raw === 'string' ? BigInt(raw) : raw, USDC_DECIMALS)
}

/** "1,234.56" from an exact amount, rounded down to `digits` places. */
export function formatUsdcDisplay(amount: Amount, digits = 2): string {
  const fixed = amount.toFixed(digits)
  const [whole, frac] = fixed.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac ? `${grouped}.${frac}` : grouped
}

/** Chart-only conversion. Never feed this back into money math. */
export function usdcToNumber(raw: string): number {
  return Number(usdcFromRaw(raw).toString())
}

export function timeAgo(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export const formatDateTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

interface ErrorLike {
  code?: number
  shortMessage?: string
  message?: string
}

export function isUserRejection(error: unknown): boolean {
  const e = error as ErrorLike | null
  const text = `${e?.shortMessage ?? ''} ${e?.message ?? ''}`.toLowerCase()
  return e?.code === 4001 || text.includes('user rejected') || text.includes('user denied')
}

export function parseOnchainError(error: unknown): string {
  const e = error as ErrorLike | null
  const text = `${e?.shortMessage ?? ''} ${e?.message ?? ''}`.toLowerCase()
  if (isUserRejection(error)) return 'Transaction cancelled.'
  if (text.includes('insufficient funds') || text.includes('exceeds balance')) {
    return 'Insufficient balance for this amount plus network fee.'
  }
  if (text.includes('reverted')) return 'The transaction was reverted by the network.'
  if (text.includes('network') || text.includes('timeout') || text.includes('fetch')) {
    return 'Network issue. Check your connection and try again.'
  }
  return e?.shortMessage ?? 'Something went wrong. Please try again.'
}
