import { CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react'
import { txUrl } from '@/lib/chain'
import { shortAddress } from '@/lib/format'

export interface SendSnapshot {
  hash: `0x${string}`
  to: string
  amount: string
}

interface Props {
  awaitingWallet: boolean
  snapshot: SendSnapshot | null
  /** Receipt state for `snapshot.hash`. */
  receipt: { isLoading: boolean; isSuccess: boolean; isError: boolean; status?: 'success' | 'reverted'; blockNumber?: bigint }
  error: string | null
  onDismiss: () => void
}

type StepState = 'done' | 'active' | 'idle' | 'failed'

function Step({ label, detail, state }: { label: string; detail?: string; state: StepState }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-5 items-center justify-center">
        {state === 'done' && <CheckCircle2 className="size-5" style={{ color: 'var(--success)' }} aria-hidden />}
        {state === 'active' && <Loader2 className="size-5 animate-spin" style={{ color: 'var(--accent-hover)' }} aria-hidden />}
        {state === 'failed' && <XCircle className="size-5" style={{ color: 'var(--danger)' }} aria-hidden />}
        {state === 'idle' && <span className="size-2.5 rounded-full" style={{ background: 'var(--border)' }} />}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium" style={{ color: state === 'idle' ? 'var(--subtle)' : 'var(--ink)' }}>
          {label}
        </div>
        {detail && (
          <div className="text-xs" style={{ color: 'var(--muted)' }}>
            {detail}
          </div>
        )}
      </div>
    </li>
  )
}

export function TxStatus({ awaitingWallet, snapshot, receipt, error, onDismiss }: Props) {
  if (!awaitingWallet && !snapshot && !error) return null

  const reverted = receipt.isError || receipt.status === 'reverted'
  const confirmed = receipt.isSuccess && receipt.status !== 'reverted'

  const signState: StepState = awaitingWallet ? 'active' : snapshot ? 'done' : error ? 'failed' : 'idle'
  const netState: StepState = !snapshot ? 'idle' : confirmed ? 'done' : reverted ? 'failed' : 'active'

  return (
    <div className="glass-inner mt-4 rounded-2xl p-4" role="status" aria-live="polite">
      <ol className="space-y-3">
        <Step
          label={awaitingWallet ? 'Confirm in your wallet' : 'Signed in wallet'}
          detail={snapshot ? `${snapshot.amount} USDC to ${shortAddress(snapshot.to)}` : undefined}
          state={signState}
        />
        <Step
          label={confirmed ? 'Confirmed onchain' : reverted ? 'Transaction failed' : 'Waiting for confirmation'}
          detail={
            confirmed && receipt.blockNumber !== undefined
              ? `Block ${receipt.blockNumber.toString()}`
              : reverted
                ? 'The network reverted this transfer. No USDC moved.'
                : undefined
          }
          state={netState}
        />
      </ol>

      {error && (
        <p className="mt-3 text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        {snapshot ? (
          <a
            href={txUrl(snapshot.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold"
            style={{ color: 'var(--accent-hover)' }}
          >
            View on explorer <ExternalLink className="size-3" />
          </a>
        ) : (
          <span />
        )}
        {(confirmed || reverted || error) && (
          <button onClick={onDismiss} className="min-h-9 px-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
