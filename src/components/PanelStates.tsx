import { Inbox, RotateCw, ServerCrash } from 'lucide-react'

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl" style={{ background: 'var(--surface-muted)' }} />
      ))}
    </div>
  )
}

export function PanelEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full" style={{ background: 'var(--surface-muted)' }}>
        <Inbox className="size-5" style={{ color: 'var(--subtle)' }} aria-hidden />
      </div>
      <h3 className="display text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-pretty text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
        {body}
      </p>
    </div>
  )
}

export function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center" role="alert">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full" style={{ background: 'rgba(186,43,76,0.1)' }}>
        <ServerCrash className="size-5" style={{ color: 'var(--danger)' }} aria-hidden />
      </div>
      <p className="max-w-xs text-pretty text-sm" style={{ color: 'var(--ink-2)' }}>
        {message}
      </p>
      <button
        onClick={onRetry}
        className="mt-3 flex min-h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
        style={{ background: 'var(--surface-muted)', color: 'var(--ink)' }}
      >
        <RotateCw className="size-3.5" aria-hidden /> Try again
      </button>
    </div>
  )
}
