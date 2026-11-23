import type { SeriesPoint, TransferItem } from './api-types'

export type Range = '24h' | '7d' | 'all'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const BUCKET_SIZES = [HOUR, 6 * HOUR, DAY, 7 * DAY]
const MAX_BUCKETS = 90

export const RANGE_LABEL: Record<Range, string> = { '24h': '24 hours', '7d': '7 days', all: 'all loaded' }

const RANGE_MS: Record<Exclude<Range, 'all'>, number> = { '24h': DAY, '7d': 7 * DAY }

export function inRange(transfers: TransferItem[], range: Range, now: number): TransferItem[] {
  if (range === 'all') return transfers
  const from = now - RANGE_MS[range]
  return transfers.filter((t) => t.timestamp >= from)
}

export const BUCKET_NAME: Record<number, string> = {
  [HOUR]: 'hour',
  [6 * HOUR]: '6 hours',
  [DAY]: 'day',
  [7 * DAY]: 'week',
}

/** Buckets real transfers by time. Empty buckets stay in the series so flat periods read as flat. */
export function buildSeries(
  transfers: TransferItem[],
  range: Range,
  now: number,
): { bucketMs: number; points: SeriesPoint[] } {
  const flows = inRange(transfers, range, now).filter((t) => t.direction !== 'self')
  if (flows.length === 0) return { bucketMs: HOUR, points: [] }

  let start: number
  let bucketMs: number
  if (range === 'all') {
    start = Math.min(...flows.map((t) => t.timestamp))
    const span = now - start
    bucketMs = BUCKET_SIZES.find((size) => span / size <= MAX_BUCKETS) ?? BUCKET_SIZES[BUCKET_SIZES.length - 1]
  } else {
    start = now - RANGE_MS[range]
    bucketMs = range === '24h' ? HOUR : 6 * HOUR
  }

  const first = Math.floor(start / bucketMs) * bucketMs
  const last = Math.floor(now / bucketMs) * bucketMs
  const buckets = new Map<number, { inflow: bigint; outflow: bigint }>()
  for (const t of flows) {
    const key = Math.floor(t.timestamp / bucketMs) * bucketMs
    const bucket = buckets.get(key) ?? { inflow: 0n, outflow: 0n }
    if (t.direction === 'in') bucket.inflow += BigInt(t.amount)
    else bucket.outflow += BigInt(t.amount)
    buckets.set(key, bucket)
  }

  const points: SeriesPoint[] = []
  let net = 0n
  for (let t = first; t <= last; t += bucketMs) {
    const bucket = buckets.get(t) ?? { inflow: 0n, outflow: 0n }
    net += bucket.inflow - bucket.outflow
    points.push({ t, inflow: bucket.inflow.toString(), outflow: bucket.outflow.toString(), net: net.toString() })
  }
  return { bucketMs, points }
}

export function totals(transfers: TransferItem[]): { received: bigint; sent: bigint; countIn: number; countOut: number } {
  let received = 0n
  let sent = 0n
  let countIn = 0
  let countOut = 0
  for (const t of transfers) {
    if (t.direction === 'in') {
      received += BigInt(t.amount)
      countIn++
    } else if (t.direction === 'out') {
      sent += BigInt(t.amount)
      countOut++
    }
  }
  return { received, sent, countIn, countOut }
}

/** Transfer counts per local hour of day (index 0 to 23). */
export function hourOfDay(transfers: TransferItem[]): number[] {
  const counts = Array.from({ length: 24 }, () => 0)
  for (const t of transfers) counts[new Date(t.timestamp).getHours()]++
  return counts
}

export function dayLabel(timestamp: number, now = Date.now()): string {
  const day = (ms: number) => new Date(ms).setHours(0, 0, 0, 0)
  const diff = Math.round((day(now) - day(timestamp)) / DAY)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return new Date(timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
