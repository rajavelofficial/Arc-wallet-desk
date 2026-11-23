import { useState } from 'react'
import { useAccount } from 'wagmi'
import { BarChart3, FileCode2, History, UserRound, type LucideIcon } from 'lucide-react'
import { ActivityPanel } from '@/components/ActivityPanel'
import { AnalyticsPanel } from '@/components/AnalyticsPanel'
import { BalanceCard } from '@/components/BalanceCard'
import { ContractsPanel } from '@/components/ContractsPanel'
import { Header } from '@/components/Header'
import { Landing } from '@/components/Landing'
import { NetworkStatus } from '@/components/NetworkStatus'
import { ProfilePanel } from '@/components/ProfilePanel'
import { SendCard } from '@/components/SendCard'
import { useUsdcBalance } from '@/hooks/useUsdcBalance'

type TabId = 'analytics' | 'activity' | 'profile' | 'contracts'

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'activity', label: 'History', icon: History },
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'contracts', label: 'Contracts', icon: FileCode2 },
]

function Dashboard({ address }: { address: `0x${string}` }) {
  const [tab, setTab] = useState<TabId>('analytics')
  const balance = useUsdcBalance(address)

  return (
    <div className="grid gap-5 pb-24 lg:grid-cols-12 lg:items-start">
      <div className="space-y-5 lg:sticky lg:top-4 lg:col-span-5">
        <BalanceCard
          address={address}
          balance={balance.amount}
          isLoading={balance.isLoading}
          isError={balance.isError}
          onRefresh={() => void balance.refetch()}
        />
        <SendCard balance={balance.amount} refetchBalance={() => void balance.refetch()} />
        <NetworkStatus />
      </div>

      <section className="glass-card rounded-3xl p-4 sm:p-5 lg:col-span-7">
        <div role="tablist" aria-label="Wallet views" className="mb-4 grid grid-cols-4 gap-1 rounded-2xl p-1" style={{ background: 'var(--surface-muted)' }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const selected = tab === id
            return (
              <button
                key={id}
                role="tab"
                id={`tab-${id}`}
                aria-selected={selected}
                aria-controls={`panel-${id}`}
                onClick={() => setTab(id)}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors"
                style={{
                  background: selected ? 'var(--surface-strong)' : 'transparent',
                  color: selected ? 'var(--ink)' : 'var(--muted)',
                  boxShadow: selected ? '0 1px 3px rgba(18,45,69,0.12)' : 'none',
                }}
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
              </button>
            )
          })}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'analytics' && <AnalyticsPanel address={address} />}
          {tab === 'activity' && <ActivityPanel address={address} />}
          {tab === 'profile' && <ProfilePanel ownAddress={address} />}
          {tab === 'contracts' && <ContractsPanel ownAddress={address} />}
        </div>
      </section>
    </div>
  )
}

export default function App() {
  const { address, isConnected } = useAccount()

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4">
      <Header />
      <main>{isConnected && address ? <Dashboard key={address} address={address} /> : <Landing />}</main>
    </div>
  )
}
