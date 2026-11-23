import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { AlertTriangle, Wallet } from 'lucide-react'
import { NetworkArc } from '@web3icons/react'
import { TARGET_CHAIN_ID, chainFacts } from '@/lib/chain'
import { shortAddress } from '@/lib/format'

export function Header() {
  const { chainId, isConnected } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const wrongChain = isConnected && chainId !== TARGET_CHAIN_ID

  return (
    <header className="flex items-center justify-between gap-3 py-5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl" style={{ background: 'var(--accent)' }}>
          <Wallet className="size-[18px] text-white" aria-hidden />
        </div>
        <span className="display text-lg font-semibold" style={{ color: 'var(--ink)' }}>
          Arc Wallet Desk
        </span>
      </div>

      <div className="flex items-center gap-2">
        {wrongChain ? (
          <button
            onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
            disabled={isPending}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold disabled:opacity-50"
            style={{ background: 'rgba(186,43,76,0.1)', color: 'var(--danger)' }}
          >
            <AlertTriangle className="size-3.5" aria-hidden />
            {isPending ? 'Switching…' : `Switch to ${chainFacts.name}`}
          </button>
        ) : (
          <span
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium sm:flex"
            style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)' }}
          >
            <NetworkArc variant="branded" size={14} />
            {chainFacts.name}
          </span>
        )}
        <ConnectKitButton.Custom>
          {({ isConnected: connected, isConnecting, show, address }) => (
            <button
              onClick={show}
              className="min-h-11 rounded-full px-4 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'var(--accent)' }}
            >
              {connected && address ? <span className="mono text-xs">{shortAddress(address)}</span> : isConnecting ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
    </header>
  )
}
