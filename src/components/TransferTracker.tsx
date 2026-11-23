import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CircleSlash, ExternalLink, Loader2, XCircle } from 'lucide-react'
import { useTrackedTransfers } from '@/hooks/useApiData'
import type { TrackedTransfer, TransferStatus } from '@/lib/api-types'
import { txUrl } from '@/lib/chain'
import { formatUsdcDisplay, shortAddress, timeAgo, usdcFromRaw } from '@/lib/format'

const STATUS: Record<TransferStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'var(--accent-hover)', bg: 'rgba(16,97,166,0.1)' },
  confirmed: { label: 'Confirmed', color: 'var(--success)', bg: 'rgba(26,128,71,0.12)' },
  failed: { label: 'Failed', color: 'var(--danger)', bg: 'rgba(186,43,76,0.1)' },
  dropped: { label: 'Not found', color: 'var(--warn)', bg: 'rgba(154,98,0,0.1)' },
}

function StatusIcon({ status }: { status: TransferStatus }) {
  const color = STATUS[status].color
  if (status === 'pending') return <Loader2 className="size-4 animate-spin" style={{ color }} aria-hidden />
  if (status === 'confirmed') return <CheckCircle2 className="size-4" style={{ color }} aria-hidden />
  if (status === 'failed') return <XCircle className="size-4" style={{ color }} aria-hidden />
  return <CircleSlash className="size-4" style={{ color }} aria-hidden />
}

function Row({ t }: { t: TrackedTransfer }) {
  const s = STATUS[t.status]
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full" style={{ background: s.bg }}>
        <StatusIcon status={t.status} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="tabular-nums">{t.amount ? `${formatUsdcDisplay(usdcFromRaw(t.amount), 2)} USDC` : 'Reading transfer…'}</span>
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.color }}>
            {s.label}
          </span>
        </div>
        <div className="mono truncate text-xs" style={{ color: 'var(--muted)' }}>
          {t.to ? `to ${shortAddress(t.to)}` : shortAddress(t.hash)} · {timeAgo(t.submittedAt)}
          {t.status === 'confirmed' && t.fee !== null ? ` · fee ${usdcFromRaw(t.fee).toFixed(6)}` : ''}
          {t.status === 'dropped' ? ' · never reached the network' : ''}
        </div>
      </div>
      <a
        href={txUrl(t.hash)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View transaction on explorer"
        className="flex size-9 items-center justify-center rounded-full hover:bg-black/5"
      >
        <ExternalLink className="size-3.5" style={{ color: 'var(--subtle)' }} />
      </a>
    </li>
  )
}

/** Sends the backend is following, so a transfer is still resolved after a reload or a closed tab. */
export function TransferTracker({ address }: { address: string }) {
  const queryClient = useQueryClient()
  const { data } = useTrackedTransfers(address)
  const transfers = data?.transfers.slice(0, 5) ?? []

  // When a tracked send settles, refresh history and analytics so it shows up there too.
  const settled = (data?.transfers ?? []).filter((t) => t.status === 'confirmed').length
  const previous = useRef<number | null>(null)
  useEffect(() => {
    if (previous.current !== null && settled > previous.current) {
      void queryClient.invalidateQueries({ queryKey: ['activity'] })
    }
    previous.current = settled
  }, [settled, queryClient])

  if (transfers.length === 0) return null

  const pending = transfers.filter((t) => t.status === 'pending').length

  return (
    <section className="glass-inner mb-4 rounded-2xl p-4" aria-label="Recent sends">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          Recent sends
        </h3>
        <span className="text-xs" style={{ color: 'var(--subtle)' }}>
          {pending > 0 ? `${pending} in progress` : 'All settled'}
        </span>
      </div>
      <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {transfers.map((t) => (
          <Row key={t.hash} t={t} />
        ))}
      </ul>
    </section>
  )
}
