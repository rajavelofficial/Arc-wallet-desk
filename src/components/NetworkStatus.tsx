import { useBlockNumber } from 'wagmi'
import { NetworkArc } from '@web3icons/react'
import { TARGET_CHAIN_ID, chainFacts } from '@/lib/chain'

export function NetworkStatus() {
  const block = useBlockNumber({ chainId: TARGET_CHAIN_ID, query: { refetchInterval: 5000 } })
  const live = block.data !== undefined && !block.isError

  return (
    <section className="glass-card rounded-3xl p-4" aria-label="Network status">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <NetworkArc variant="branded" size={18} />
          {chainFacts.name}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: live ? 'var(--success)' : 'var(--subtle)' }}>
          <span className="size-2 rounded-full" style={{ background: live ? 'var(--success)' : 'var(--border-strong)' }} />
          {live ? 'Live' : block.isError ? 'Unreachable' : 'Connecting'}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt style={{ color: 'var(--muted)' }}>Latest block</dt>
          <dd className="mono mt-0.5 font-medium tabular-nums">{block.data !== undefined ? block.data.toLocaleString() : '—'}</dd>
        </div>
        <div>
          <dt style={{ color: 'var(--muted)' }}>Chain ID</dt>
          <dd className="mono mt-0.5 font-medium tabular-nums">{chainFacts.chainId}</dd>
        </div>
        <div>
          <dt style={{ color: 'var(--muted)' }}>Gas token</dt>
          <dd className="mt-0.5 font-medium">{chainFacts.nativeCurrency.symbol}</dd>
        </div>
      </dl>
    </section>
  )
}
