import { chainFacts, USDC_ADDRESS } from './chain'
import { HttpError } from './http'
import type { HistoryFilter, HistoryPage, OnchainProfile, TransferItem } from '../src/lib/api-types'

const API = `${chainFacts.explorerBase}/api/v2`
const PAGE_CAP = 8

interface RawParty {
  hash?: string
}
interface RawTransfer {
  block_number?: number
  from?: RawParty
  to?: RawParty
  timestamp?: string
  transaction_hash?: string
  token?: { address_hash?: string }
  total?: { value?: string }
}
type PageParams = Record<string, string | number | null>
interface RawPage {
  items?: RawTransfer[]
  next_page_params?: PageParams | null
}

async function getJson<T>(path: string, attempt = 0): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(10_000) })
  if ((res.status === 429 || res.status >= 500) && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)))
    return getJson<T>(path, attempt + 1)
  }
  if (res.status === 404) throw new HttpError(404, 'Address not found on the explorer')
  if (!res.ok) throw new HttpError(502, `Explorer responded with ${res.status}`)
  return (await res.json()) as T
}

function normalize(item: RawTransfer, me: string): TransferItem | null {
  if (item.token?.address_hash?.toLowerCase() !== USDC_ADDRESS.toLowerCase()) return null
  const from = item.from?.hash
  const to = item.to?.hash
  const value = item.total?.value
  const time = item.timestamp ? Date.parse(item.timestamp) : NaN
  if (!from || !to || !value || !item.transaction_hash || Number.isNaN(time) || !/^\d+$/.test(value)) return null
  const isFrom = from.toLowerCase() === me
  const isTo = to.toLowerCase() === me
  return {
    hash: item.transaction_hash,
    blockNumber: item.block_number ?? 0,
    timestamp: time,
    from,
    to,
    direction: isFrom && isTo ? 'self' : isFrom ? 'out' : 'in',
    amount: value,
    counterparty: isFrom ? to : from,
  }
}

function queryFor(address: string, filter: HistoryFilter, params: PageParams | null): string {
  const query = new URLSearchParams({ type: 'ERC-20', token: USDC_ADDRESS })
  if (filter === 'in') query.set('filter', 'to')
  if (filter === 'out') query.set('filter', 'from')
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== null && value !== undefined) query.set(key, String(value))
  }
  return `/addresses/${address}/token-transfers?${query.toString()}`
}

async function fetchPage(address: string, filter: HistoryFilter, params: PageParams | null) {
  const me = address.toLowerCase()
  const data = await getJson<RawPage>(queryFor(address, filter, params))
  const items = (data.items ?? []).flatMap((raw) => {
    const item = normalize(raw, me)
    return item ? [item] : []
  })
  return { items, next: data.next_page_params ?? null }
}

/** Cursors travel to the browser as opaque base64url so the explorer's paging shape stays server-side. */
function encodeCursor(params: PageParams | null): string | null {
  return params ? Buffer.from(JSON.stringify(params)).toString('base64url') : null
}

function decodeCursor(cursor: string): PageParams {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('shape')
    const entries = Object.entries(parsed as Record<string, unknown>)
    if (entries.length === 0 || entries.length > 12) throw new Error('size')
    const out: PageParams = {}
    for (const [key, value] of entries) {
      const ok = typeof value === 'string' ? value.length <= 100 : typeof value === 'number'
      if (!/^[a-z_]{1,30}$/.test(key) || !ok) throw new Error('entry')
      out[key] = value as string | number
    }
    return out
  } catch {
    throw new HttpError(400, 'Invalid cursor')
  }
}

/** One page of full history, newest first, for the History tab. */
export async function fetchHistoryPage(
  address: string,
  filter: HistoryFilter,
  cursor: string | null,
): Promise<HistoryPage> {
  try {
    const { items, next } = await fetchPage(address, filter, cursor ? decodeCursor(cursor) : null)
    return { items, nextCursor: encodeCursor(next) }
  } catch (error) {
    // A brand-new wallet has no explorer record yet: that is an empty history, not a failure.
    if (error instanceof HttpError && error.status === 404 && !cursor) return { items: [], nextCursor: null }
    throw error
  }
}

/** Loads the newest USDC transfers touching `address`, newest first, for the analytics summary. */
export async function fetchUsdcTransfers(
  address: string,
): Promise<{ transfers: TransferItem[]; truncated: boolean }> {
  const transfers: TransferItem[] = []
  let params: PageParams | null = null
  for (let page = 0; page < PAGE_CAP; page++) {
    const result = await fetchHistoryPage(address, 'all', encodeCursor(params))
    transfers.push(...result.items)
    if (!result.nextCursor) return { transfers, truncated: false }
    params = decodeCursor(result.nextCursor)
  }
  return { transfers, truncated: true }
}

interface RawAddress {
  is_contract?: boolean
  ens_domain_name?: string | null
}
interface RawCounters {
  transactions_count?: string
  token_transfers_count?: string
}

function toCount(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  return Number(value)
}

export async function fetchOnchainProfile(address: string): Promise<OnchainProfile> {
  const [info, counters] = await Promise.all([
    getJson<RawAddress>(`/addresses/${address}`).catch(() => null),
    getJson<RawCounters>(`/addresses/${address}/counters`).catch(() => null),
  ])
  return {
    txCount: toCount(counters?.transactions_count),
    transferCount: toCount(counters?.token_transfers_count),
    isContract: info?.is_contract === true,
    ensName: info?.ens_domain_name ?? null,
  }
}
