import { useMemo, useState } from 'react'
import { AlertCircle, ArrowDownLeft, ArrowUpRight, TrendingUp, Trophy } from 'lucide-react'
import { useActivity } from '@/hooks/useApiData'
import type { TransferItem } from '@/lib/api-types'
import { BUCKET_NAME, RANGE_LABEL, buildSeries, hourOfDay, inRange, totals, type Range } from '@/lib/analytics'
import { addressUrl } from '@/lib/chain'
import { formatDate, formatUsdcDisplay, shortAddress, usdcFromRaw } from '@/lib/format'
import { FlowBars, HourBars, NetFlowChart, SplitBar } from './Charts'
import { PanelEmpty, PanelError, PanelSkeleton } from './PanelStates'

const RANGES: Range[] = ['24h', '7d', 'all']

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="glass-inner rounded-2xl p-3.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
        {icon}
        {label}
      </div>
      <div className="display text-xl font-bold tabular-nums">{value}</div>
      {sub && (
        <div className="text-xs" style={{ color: 'var(--subtle)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function topCounterparties(transfers: TransferItem[]) {
  const peers = new Map<string, { volume: bigint; count: number }>()
  for (const t of transfers) {
    if (t.direction === 'self') continue
    const key = t.counterparty.toLowerCase()
    const peer = peers.get(key) ?? { volume: 0n, count: 0 }
    peer.volume += BigInt(t.amount)
    peer.count++
    peers.set(key, peer)
  }
  return [...peers.entries()]
    .sort((a, b) => (a[1].volume === b[1].volume ? 0 : a[1].volume > b[1].volume ? -1 : 1))
    .slice(0, 5)
}

export function AnalyticsPanel({ address }: { address: string }) {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useActivity(address)
  const [range, setRange] = useState<Range>('7d')

  const view = useMemo(() => {
    if (!data) return null
    const scoped = inRange(data.transfers, range, dataUpdatedAt)
    const sums = totals(scoped)
    let largest = 0n
    for (const t of scoped) if (t.direction !== 'self' && BigInt(t.amount) > largest) largest = BigInt(t.amount)
    return {
      scoped,
      sums,
      largest,
      series: buildSeries(data.transfers, range, dataUpdatedAt),
      hours: hourOfDay(scoped),
      peers: topCounterparties(scoped),
    }
  }, [data, range, dataUpdatedAt])

  if (isLoading) return <PanelSkeleton rows={3} />
  if (error) return <PanelError message={error.message} onRetry={() => void refetch()} />
  if (!data || !view || data.transfers.length === 0) {
    return (
      <PanelEmpty
        title="No USDC activity yet"
        body="Once this wallet sends or receives USDC on Arc Testnet, volume and flow charts appear here."
      />
    )
  }

  const { sums, series, scoped } = view
  const windowNote = `Based on the latest ${data.transfers.length} USDC transfers${
    data.truncated && data.summary.firstAt ? `, back to ${formatDate(data.summary.firstAt)}` : ''
  }.`

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Time range" className="flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full p-1" style={{ background: 'var(--surface-muted)' }}>
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className="min-h-8 rounded-full px-3 text-xs font-semibold"
              style={{
                background: range === r ? 'var(--surface-strong)' : 'transparent',
                color: range === r ? 'var(--ink)' : 'var(--muted)',
                boxShadow: range === r ? '0 1px 3px rgba(18,45,69,0.12)' : 'none',
              }}
            >
              {r === 'all' ? 'All loaded' : r}
            </button>
          ))}
        </div>
        <span className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
          {scoped.length} transfer{scoped.length === 1 ? '' : 's'} in {RANGE_LABEL[range]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile
          icon={<ArrowDownLeft className="size-3.5" style={{ color: 'var(--success)' }} />}
          label="Received"
          value={formatUsdcDisplay(usdcFromRaw(sums.received))}
          sub={`${sums.countIn} transfers`}
        />
        <Tile
          icon={<ArrowUpRight className="size-3.5" style={{ color: 'var(--accent-hover)' }} />}
          label="Sent"
          value={formatUsdcDisplay(usdcFromRaw(sums.sent))}
          sub={`${sums.countOut} transfers`}
        />
        <Tile
          icon={<TrendingUp className="size-3.5" />}
          label="Net flow"
          value={`${sums.received >= sums.sent ? '+' : '-'}${formatUsdcDisplay(usdcFromRaw(sums.received >= sums.sent ? sums.received - sums.sent : sums.sent - sums.received))}`}
          sub="received minus sent"
        />
        <Tile
          icon={<Trophy className="size-3.5" />}
          label="Largest"
          value={formatUsdcDisplay(usdcFromRaw(view.largest))}
          sub="single transfer"
        />
      </div>

      {scoped.length === 0 ? (
        <PanelEmpty title={`Nothing in the last ${RANGE_LABEL[range]}`} body="Pick a longer range to see earlier activity." />
      ) : (
        <>
          <div className="glass-inner rounded-2xl p-4">
            <SplitBar received={sums.received} sent={sums.sent} />
          </div>
          {series.points.length > 0 && (
            <>
              <div className="glass-inner rounded-2xl p-4">
                <NetFlowChart series={series.points} />
              </div>
              <div className="glass-inner rounded-2xl p-4">
                <FlowBars series={series.points} />
                <p className="mt-2 text-xs" style={{ color: 'var(--subtle)' }}>
                  Volume per {BUCKET_NAME[series.bucketMs] ?? 'period'}. Received above the line, sent below.
                </p>
              </div>
            </>
          )}
          <div className="glass-inner rounded-2xl p-4">
            <HourBars counts={view.hours} />
          </div>
          {view.peers.length > 0 && (
            <div className="glass-inner rounded-2xl p-4">
              <h3 className="mb-2 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                Top counterparties
              </h3>
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {view.peers.map(([peer, p]) => (
                  <li key={peer} className="flex items-center justify-between py-2 text-sm">
                    <a
                      href={addressUrl(peer)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono text-xs hover:underline"
                      style={{ color: 'var(--accent-hover)' }}
                    >
                      {shortAddress(peer)}
                    </a>
                    <span className="tabular-nums" style={{ color: 'var(--ink-2)' }}>
                      {formatUsdcDisplay(usdcFromRaw(p.volume))} <span style={{ color: 'var(--subtle)' }}>· {p.count}×</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <p className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--subtle)' }}>
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {windowNote} Gas fees are not transfers, so they are not counted here.
      </p>
    </div>
  )
}
