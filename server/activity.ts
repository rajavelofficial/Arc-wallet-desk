import type {
  ActivityResponse,
  ActivitySummary,
  Counterparty,
  TransferItem,
} from '../src/lib/api-types'
import { fetchUsdcTransfers } from './explorer'

const CACHE_MS = 15_000

const cache = new Map<string, { at: number; value: ActivityResponse }>()

function summarize(transfers: TransferItem[]): ActivitySummary {
  let totalIn = 0n
  let totalOut = 0n
  let countIn = 0
  let countOut = 0
  let largestIn = 0n
  let largestOut = 0n
  const peers = new Map<string, { volume: bigint; count: number }>()

  for (const t of transfers) {
    if (t.direction === 'self') continue
    const amount = BigInt(t.amount)
    if (t.direction === 'in') {
      totalIn += amount
      countIn++
      if (amount > largestIn) largestIn = amount
    } else {
      totalOut += amount
      countOut++
      if (amount > largestOut) largestOut = amount
    }
    const key = t.counterparty.toLowerCase()
    const peer = peers.get(key) ?? { volume: 0n, count: 0 }
    peer.volume += amount
    peer.count++
    peers.set(key, peer)
  }

  const topCounterparties: Counterparty[] = [...peers.entries()]
    .sort((a, b) => (a[1].volume === b[1].volume ? 0 : a[1].volume > b[1].volume ? -1 : 1))
    .slice(0, 5)
    .map(([address, p]) => ({ address, volume: p.volume.toString(), count: p.count }))

  const times = transfers.map((t) => t.timestamp)
  return {
    totalIn: totalIn.toString(),
    totalOut: totalOut.toString(),
    countIn,
    countOut,
    firstAt: times.length ? Math.min(...times) : null,
    lastAt: times.length ? Math.max(...times) : null,
    largestIn: largestIn.toString(),
    largestOut: largestOut.toString(),
    topCounterparties,
  }
}

export async function getActivity(address: string): Promise<ActivityResponse> {
  const key = address.toLowerCase()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value

  const { transfers, truncated } = await fetchUsdcTransfers(address)
  const summary = summarize(transfers)
  const value: ActivityResponse = {
    address,
    fetchedAt: Date.now(),
    truncated,
    summary,
    transfers,
  }
  cache.set(key, { at: Date.now(), value })
  if (cache.size > 200) cache.delete(cache.keys().next().value as string)
  return value
}
