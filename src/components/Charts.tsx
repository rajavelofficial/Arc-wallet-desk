import { useMemo, useState } from 'react'
import type { SeriesPoint } from '@/lib/api-types'
import { formatDateTime, usdcToNumber } from '@/lib/format'

const W = 600
const H = 200
const PAD = 10

const money = (n: number) =>
  `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function useScrub(count: number) {
  const [index, setIndex] = useState<number | null>(null)
  const handlers = {
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      setIndex(Math.round(ratio * (count - 1)))
    },
    onPointerLeave: () => setIndex(null),
  }
  return { index, handlers }
}

function Readout({ label, value, time, tone }: { label: string; value: string; time: string; tone?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <div>
        <div className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          {label}
        </div>
        <div className="display text-2xl font-bold tabular-nums" style={{ color: tone ?? 'var(--ink)' }}>
          {value} <span className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
        </div>
      </div>
      <div className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
        {time}
      </div>
    </div>
  )
}

export function NetFlowChart({ series }: { series: SeriesPoint[] }) {
  const values = useMemo(() => series.map((p) => usdcToNumber(p.net)), [series])
  const { index, handlers } = useScrub(series.length)

  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1
  const x = (i: number) => PAD + (series.length === 1 ? (W - 2 * PAD) / 2 : (i / (series.length - 1)) * (W - 2 * PAD))
  const y = (v: number) => PAD + (1 - (v - min) / range) * (H - 2 * PAD)

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L ${x(values.length - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`
  const active = index ?? series.length - 1
  const latest = values[active]

  return (
    <div>
      <Readout
        label="Cumulative net flow"
        value={money(latest)}
        time={formatDateTime(series[active].t)}
        tone={latest < 0 ? 'var(--danger)' : 'var(--success)'}
      />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label="Cumulative net USDC flow over time"
        {...handlers}
      >
        <defs>
          <linearGradient id="net-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1061a6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#1061a6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} stroke="rgba(18,45,69,0.18)" strokeDasharray="4 4" />
        <path d={area} fill="url(#net-fill)" />
        <path d={line} fill="none" stroke="#1061a6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {index !== null && (
          <>
            <line x1={x(active)} x2={x(active)} y1={PAD} y2={H - PAD} stroke="rgba(18,45,69,0.25)" />
            <circle cx={x(active)} cy={y(latest)} r={4.5} fill="#fff" stroke="#1061a6" strokeWidth={2} />
          </>
        )}
      </svg>
    </div>
  )
}

export function FlowBars({ series }: { series: SeriesPoint[] }) {
  const data = useMemo(
    () => series.map((p) => ({ t: p.t, inflow: usdcToNumber(p.inflow), outflow: usdcToNumber(p.outflow) })),
    [series],
  )
  const { index, handlers } = useScrub(series.length)
  const top = Math.max(...data.map((d) => d.inflow), 0.000001)
  const bottom = Math.max(...data.map((d) => d.outflow), 0.000001)
  const mid = PAD + (top / (top + bottom)) * (H - 2 * PAD)
  const slot = (W - 2 * PAD) / data.length
  const barW = Math.max(2, slot * 0.7)
  const active = index ?? data.length - 1
  const d = data[active]

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="flex gap-5">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              <span className="size-2 rounded-full" style={{ background: 'var(--success)' }} /> Received
            </div>
            <div className="display text-lg font-bold tabular-nums">{money(d.inflow)}</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              <span className="size-2 rounded-full" style={{ background: 'var(--accent-hover)' }} /> Sent
            </div>
            <div className="display text-lg font-bold tabular-nums">{money(d.outflow)}</div>
          </div>
        </div>
        <div className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
          {formatDateTime(d.t)}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" role="img" aria-label="USDC received and sent per period" {...handlers}>
        <line x1={PAD} x2={W - PAD} y1={mid} y2={mid} stroke="rgba(18,45,69,0.18)" />
        {data.map((p, i) => {
          const bx = PAD + i * slot + (slot - barW) / 2
          const inH = (p.inflow / top) * (mid - PAD)
          const outH = (p.outflow / bottom) * (H - PAD - mid)
          const dim = index !== null && index !== i ? 0.45 : 1
          return (
            <g key={p.t} opacity={dim}>
              {inH > 0 && <rect x={bx} y={mid - inH} width={barW} height={inH} rx={1.5} fill="#1a8047" />}
              {outH > 0 && <rect x={bx} y={mid} width={barW} height={outH} rx={1.5} fill="#1061a6" />}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Received versus sent share of volume. Shares come from exact bigint totals. */
export function SplitBar({ received, sent }: { received: bigint; sent: bigint }) {
  const total = received + sent
  const inShare = total === 0n ? 0 : Number((received * 1000n) / total) / 10
  const outShare = total === 0n ? 0 : Math.round((100 - inShare) * 10) / 10
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold" style={{ color: 'var(--muted)' }}>
        <span>Volume split</span>
        <span className="tabular-nums">{total === 0n ? 'No volume' : `${inShare}% in · ${outShare}% out`}</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }} role="img" aria-label={`${inShare} percent received, ${outShare} percent sent`}>
        <div style={{ width: `${inShare}%`, background: 'var(--success)' }} />
        <div style={{ width: `${outShare}%`, background: 'var(--accent-hover)' }} />
      </div>
    </div>
  )
}

/** Transfer counts by local hour of day. */
export function HourBars({ counts }: { counts: number[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...counts, 1)
  const busiest = counts.indexOf(Math.max(...counts))
  const active = hover ?? busiest
  const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          {hover === null ? 'Busiest hour' : 'Hour'}
        </div>
        <div className="text-xs tabular-nums" style={{ color: 'var(--ink-2)' }}>
          {hourLabel(active)} · {counts[active]} transfer{counts[active] === 1 ? '' : 's'}
        </div>
      </div>
      <div className="flex h-24 items-end gap-[3px]" onPointerLeave={() => setHover(null)}>
        {counts.map((c, h) => (
          <div
            key={h}
            onPointerEnter={() => setHover(h)}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${Math.max(c === 0 ? 2 : 6, (c / max) * 100)}%`,
              background: c === 0 ? 'var(--border)' : 'var(--accent-hover)',
              opacity: hover === null || hover === h ? 1 : 0.45,
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--subtle)' }}>
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>11 PM</span>
      </div>
    </div>
  )
}

export function Sparkline({ values, height = 36 }: { values: number[]; height?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const range = Math.max(...values) - min || 1
  const width = 120
  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${((i / (values.length - 1)) * width).toFixed(1)} ${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`)
    .join(' ')
  const up = values[values.length - 1] >= values[0]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden>
      <path d={path} fill="none" stroke={up ? '#1a8047' : '#ba2b4c'} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
