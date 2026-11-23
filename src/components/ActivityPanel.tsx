import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Copy, Download, ExternalLink, Loader2, Repeat, Search } from 'lucide-react'
import { useHistory } from '@/hooks/useApiData'
import type { HistoryFilter, TransferItem } from '@/lib/api-types'
import { dayLabel } from '@/lib/analytics'
import { addressUrl, txUrl } from '@/lib/chain'
import { formatDateTime, formatUsdcDisplay, shortAddress, timeAgo, usdcFromRaw } from '@/lib/format'
import { PanelEmpty, PanelError, PanelSkeleton } from './PanelStates'
import { TransferTracker } from './TransferTracker'

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in', label: 'Received' },
  { id: 'out', label: 'Sent' },
]

function exportCsv(address: string, items: TransferItem[]) {
  const rows = [
    ['time_utc', 'direction', 'amount_usdc', 'counterparty', 'tx_hash', 'block'],
    ...items.map((t) => [
      new Date(t.timestamp).toISOString(),
      t.direction,
      usdcFromRaw(t.amount).toString(),
      t.counterparty,
      t.hash,
      String(t.blockNumber),
    ]),
  ]
  const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `usdc-history-${address.slice(0, 8)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <button
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          })
        }}
        className="mono flex min-h-8 items-center gap-1.5 text-xs"
        style={{ color: 'var(--ink-2)' }}
        aria-label={`Copy ${label}`}
      >
        {shortAddress(value)}
        {copied ? <Check className="size-3" style={{ color: 'var(--success)' }} /> : <Copy className="size-3" />}
      </button>
    </div>
  )
}

function Row({ t }: { t: TransferItem }) {
  const [open, setOpen] = useState(false)
  const incoming = t.direction === 'in'
  const self = t.direction === 'self'
  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center gap-3 py-2 text-left"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: self ? 'var(--surface-muted)' : incoming ? 'rgba(26,128,71,0.12)' : 'rgba(16,97,166,0.1)' }}
        >
          {self ? (
            <Repeat className="size-4" style={{ color: 'var(--muted)' }} aria-hidden />
          ) : incoming ? (
            <ArrowDownLeft className="size-4" style={{ color: 'var(--success)' }} aria-hidden />
          ) : (
            <ArrowUpRight className="size-4" style={{ color: 'var(--accent-hover)' }} aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{self ? 'To self' : incoming ? 'Received' : 'Sent'}</span>
          <span className="mono block truncate text-xs" style={{ color: 'var(--muted)' }}>
            {incoming ? 'from' : 'to'} {shortAddress(t.counterparty)}
          </span>
        </span>
        <span className="text-right">
          <span
            className="block text-sm font-semibold tabular-nums"
            style={{ color: self ? 'var(--ink-2)' : incoming ? 'var(--success)' : 'var(--ink)' }}
          >
            {self ? '' : incoming ? '+' : '-'}
            {formatUsdcDisplay(usdcFromRaw(t.amount), 2)}
          </span>
          <span className="block text-xs" style={{ color: 'var(--subtle)' }}>
            {timeAgo(t.timestamp)}
          </span>
        </span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--subtle)' }} />
      </button>
      {open && (
        <div className="mb-2 rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
          <div className="flex items-center justify-between py-1 text-xs">
            <span style={{ color: 'var(--muted)' }}>Exact amount</span>
            <span className="mono tabular-nums">{usdcFromRaw(t.amount).toString()} USDC</span>
          </div>
          <div className="flex items-center justify-between py-1 text-xs">
            <span style={{ color: 'var(--muted)' }}>Time</span>
            <span className="tabular-nums">{formatDateTime(t.timestamp)}</span>
          </div>
          <div className="flex items-center justify-between py-1 text-xs">
            <span style={{ color: 'var(--muted)' }}>Block</span>
            <span className="mono tabular-nums">{t.blockNumber.toLocaleString()}</span>
          </div>
          <CopyValue label="From" value={t.from} />
          <CopyValue label="To" value={t.to} />
          <CopyValue label="Transaction" value={t.hash} />
          <div className="mt-1 flex gap-4">
            <a href={txUrl(t.hash)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold" style={{ color: 'var(--accent-hover)' }}>
              Transaction <ExternalLink className="size-3" />
            </a>
            <a href={addressUrl(t.counterparty)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold" style={{ color: 'var(--accent-hover)' }}>
              Counterparty <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      )}
    </li>
  )
}

export function ActivityPanel({ address }: { address: string }) {
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [search, setSearch] = useState('')
  const history = useHistory(address, filter)

  const loaded = useMemo(() => history.data?.pages.flatMap((p) => p.items) ?? [], [history.data])
  const term = search.trim().toLowerCase()
  const items = useMemo(
    () =>
      term
        ? loaded.filter((t) => t.counterparty.toLowerCase().includes(term) || t.hash.toLowerCase().includes(term))
        : loaded,
    [loaded, term],
  )

  const groups = useMemo(() => {
    const out: { label: string; items: TransferItem[] }[] = []
    for (const t of items) {
      const label = dayLabel(t.timestamp)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(t)
      else out.push({ label, items: [t] })
    }
    return out
  }, [items])

  return (
    <div>
      <TransferTracker address={address} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter transfers" className="flex gap-1 rounded-full p-1" style={{ background: 'var(--surface-muted)' }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className="min-h-8 rounded-full px-3 text-xs font-semibold"
              style={{
                background: filter === f.id ? 'var(--surface-strong)' : 'transparent',
                color: filter === f.id ? 'var(--ink)' : 'var(--muted)',
                boxShadow: filter === f.id ? '0 1px 3px rgba(18,45,69,0.12)' : 'none',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => exportCsv(address, items)}
          disabled={items.length === 0}
          className="ml-auto flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold disabled:opacity-40"
          style={{ background: 'var(--surface-muted)', color: 'var(--ink)' }}
        >
          <Download className="size-3.5" aria-hidden /> Export CSV
        </button>
      </div>

      <div className="field glass-inner mb-3 flex items-center gap-2 rounded-2xl px-3">
        <Search className="size-4 shrink-0" style={{ color: 'var(--subtle)' }} aria-hidden />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search loaded transfers by address or hash"
          aria-label="Search loaded transfers"
          spellCheck={false}
          className="min-h-11 w-full bg-transparent text-xs outline-none placeholder:text-slate-300"
        />
      </div>

      {history.isLoading ? (
        <PanelSkeleton rows={4} />
      ) : history.error ? (
        <PanelError message={history.error.message} onRetry={() => void history.refetch()} />
      ) : loaded.length === 0 ? (
        <PanelEmpty
          title={filter === 'all' ? 'No transfers yet' : `No ${filter === 'in' ? 'received' : 'sent'} transfers`}
          body="Send some USDC or fund this wallet with Get test USDC in the Arc Studio sidebar. Transfers show up here within seconds."
        />
      ) : items.length === 0 ? (
        <PanelEmpty title="No matches" body="Nothing loaded matches that search. Load more history or try another address or hash." />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <section key={group.label}>
              <h3 className="sticky top-0 py-1 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
                {group.label}
              </h3>
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {group.items.map((t, i) => (
                  <Row key={`${t.hash}-${i}`} t={t} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {loaded.length > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
            {loaded.length} loaded{history.hasNextPage ? '' : ' · start of history'}
          </span>
          {history.hasNextPage && (
            <button
              onClick={() => void history.fetchNextPage()}
              disabled={history.isFetchingNextPage}
              className="flex min-h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold disabled:opacity-60"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {history.isFetchingNextPage && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              Load older transfers
            </button>
          )}
        </div>
      )}
    </div>
  )
}
