import { useMemo, useState } from 'react'
import { Check, Copy, Droplets, ExternalLink, RefreshCw } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { useActivity } from '@/hooks/useApiData'
import { buildSeries, inRange, totals } from '@/lib/analytics'
import { addressUrl, chainFacts } from '@/lib/chain'
import { formatUsdcDisplay, shortAddress, usdcFromRaw, usdcToNumber } from '@/lib/format'
import { Sparkline } from './Charts'
import type { Amount } from '@/onchain-money'

interface Props {
  address: string
  balance: Amount | undefined
  isLoading: boolean
  isError: boolean
  onRefresh: () => void
}

const LOW_BALANCE_RAW = 1_000_000n

export function BalanceCard({ address, balance, isLoading, isError, onRefresh }: Props) {
  const [copied, setCopied] = useState(false)
  const lowBalance = balance !== undefined && balance.raw < LOW_BALANCE_RAW
  const activity = useActivity(address)

  // Seven-day figures come from real transfers only; nothing is shown until they load.
  const week = useMemo(() => {
    if (!activity.data) return null
    const now = activity.dataUpdatedAt
    const sums = totals(inRange(activity.data.transfers, '7d', now))
    const spark = buildSeries(activity.data.transfers, '7d', now).points.map((p) => usdcToNumber(p.net))
    return { sums, spark }
  }, [activity.data, activity.dataUpdatedAt])

  const copy = async () => {
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="glass-card rounded-3xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          <TokenUSDC variant="branded" size={16} />
          USDC balance
        </span>
        <button
          onClick={onRefresh}
          aria-label="Refresh balance"
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-black/5"
        >
          <RefreshCw className="size-3.5" style={{ color: 'var(--subtle)' }} />
        </button>
      </div>

      <div className="flex items-baseline gap-1.5">
        {isLoading ? (
          <div className="h-10 w-40 animate-pulse rounded-lg" style={{ background: 'var(--surface-muted)' }} />
        ) : isError || balance === undefined ? (
          <span className="display text-2xl font-semibold" style={{ color: 'var(--subtle)' }}>
            Balance unavailable
          </span>
        ) : (
          <>
            <span className="display text-5xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {formatUsdcDisplay(balance, 2)}
            </span>
            <span className="text-lg font-medium" style={{ color: 'var(--subtle)' }}>
              USDC
            </span>
          </>
        )}
      </div>
      <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
        {chainFacts.name} · network fees are paid in this same USDC
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => void copy()}
          className="glass-inner flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium"
          style={{ color: 'var(--ink-2)' }}
        >
          <span className="mono">{shortAddress(address)}</span>
          {copied ? <Check className="size-3.5" style={{ color: 'var(--success)' }} /> : <Copy className="size-3.5" />}
        </button>
        <a
          href={addressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-medium"
          style={{ color: 'var(--accent-hover)' }}
        >
          Explorer <ExternalLink className="size-3" />
        </a>
      </div>

      <div className="mt-4 grid grid-cols-3 items-center gap-2 rounded-2xl p-3" style={{ background: 'var(--surface-muted)' }}>
        <div>
          <div className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>
            7d received
          </div>
          <div className="text-sm font-bold tabular-nums" style={{ color: 'var(--success)' }}>
            {week ? `+${formatUsdcDisplay(usdcFromRaw(week.sums.received))}` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>
            7d sent
          </div>
          <div className="text-sm font-bold tabular-nums">{week ? `-${formatUsdcDisplay(usdcFromRaw(week.sums.sent))}` : '—'}</div>
        </div>
        <div className="flex justify-end" aria-label="Seven day net flow trend">
          {week && week.spark.length > 1 ? (
            <Sparkline values={week.spark} />
          ) : (
            <span className="text-[11px]" style={{ color: 'var(--subtle)' }}>
              {activity.isLoading ? 'Loading…' : 'No 7d trend'}
            </span>
          )}
        </div>
      </div>

      {lowBalance && (
        <div className="mt-4 flex gap-3 rounded-2xl p-3.5" style={{ background: 'rgba(133,177,237,0.16)' }}>
          <Droplets className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--accent-hover)' }} aria-hidden />
          <p className="text-pretty text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {balance.isZero() ? 'No test USDC yet.' : 'Running low on test USDC.'} Use <strong>Get test USDC</strong> in the Arc
            Studio sidebar. Your balance here updates on its own once the funds land.
          </p>
        </div>
      )}
    </section>
  )
}
