import { ConnectKitButton } from 'connectkit'
import { BarChart3, Droplets, SendHorizontal, UserRound } from 'lucide-react'
import { chainFacts } from '@/lib/chain'

const FEATURES = [
  { icon: SendHorizontal, title: 'Send USDC', body: 'Pay any address with live fee estimates and confirmation tracking.' },
  { icon: BarChart3, title: 'See your flow', body: 'Charts of what you received and sent, drawn from real transfers.' },
  { icon: UserRound, title: 'Wallet profile', body: 'A name and bio tied to your wallet by a free signature.' },
]

export function Landing() {
  return (
    <div className="mx-auto max-w-md pt-6">
      <section className="glass-card overflow-hidden rounded-3xl">
        <div className="spectral-strip h-1" />
        <div className="p-6">
          <h1 className="display text-balance text-4xl font-bold leading-tight">Your USDC on {chainFacts.name}.</h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            Connect a wallet to see your balance, send USDC and follow every transfer. Network fees are paid in USDC too, so
            there is only one balance to think about.
          </p>
          <ConnectKitButton.Custom>
            {({ show, isConnecting }) => (
              <button
                onClick={show}
                className="mt-6 min-h-12 w-full rounded-2xl text-sm font-semibold text-white transition-transform hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: 'var(--accent)' }}
              >
                {isConnecting ? 'Connecting…' : 'Connect wallet'}
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </section>

      <ul className="mt-4 space-y-2.5">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="glass-inner flex items-start gap-3 rounded-2xl p-3.5">
            <Icon className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--accent-hover)' }} aria-hidden />
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {body}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-start gap-2 text-xs" style={{ color: 'var(--subtle)' }}>
        <Droplets className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Need test funds? Use <strong>Get test USDC</strong> in the Arc Studio sidebar after connecting.
      </p>
    </div>
  )
}
