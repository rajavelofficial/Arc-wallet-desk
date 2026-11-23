import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isAddress } from 'viem'
import { ExternalLink, Pencil, Search, User } from 'lucide-react'
import { toast } from 'sonner'
import { useActivity, useProfile } from '@/hooks/useApiData'
import { useSignedRequest } from '@/hooks/useSignedRequest'
import { useUsdcBalance } from '@/hooks/useUsdcBalance'
import { api } from '@/lib/api'
import { cleanText } from '@/lib/auth'
import { addressUrl } from '@/lib/chain'
import { formatDate, formatUsdcDisplay, isUserRejection, shortAddress } from '@/lib/format'
import { PanelError, PanelSkeleton } from './PanelStates'

function avatarGradient(address: string): string {
  const a = parseInt(address.slice(2, 8), 16) % 360
  const b = parseInt(address.slice(8, 14), 16) % 360
  return `linear-gradient(135deg, hsl(${a} 55% 62%), hsl(${b} 60% 52%))`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-inner rounded-2xl p-3.5">
      <div className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      <div className="display mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  )
}

export function ProfilePanel({ ownAddress }: { ownAddress: string }) {
  const queryClient = useQueryClient()
  const sign = useSignedRequest()
  const [lookup, setLookup] = useState('')
  const [viewing, setViewing] = useState(ownAddress)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)

  const isOwn = viewing.toLowerCase() === ownAddress.toLowerCase()
  const profileQuery = useProfile(viewing)
  const activity = useActivity(viewing)
  const balance = useUsdcBalance(viewing as `0x${string}`)

  const profile = profileQuery.data?.profile ?? null
  const onchain = profileQuery.data?.onchain

  const startEditing = () => {
    setDisplayName(profile?.displayName ?? '')
    setBio(profile?.bio ?? '')
    setEditing(true)
  }

  const save = async () => {
    const payload = { displayName: cleanText(displayName), bio: cleanText(bio) }
    if (!payload.displayName) {
      toast.error('Add a display name first.')
      return
    }
    setSaving(true)
    try {
      const envelope = await sign('profile.update', payload)
      await api.saveProfile({ ...payload, ...envelope })
      await queryClient.invalidateQueries({ queryKey: ['profile', ownAddress] })
      setEditing(false)
      toast.success('Profile saved')
    } catch (error) {
      if (isUserRejection(error)) toast('Signature cancelled')
      else toast.error(error instanceof Error ? error.message : 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  const view = () => {
    const next = lookup.trim()
    if (isAddress(next)) {
      setViewing(next)
      setEditing(false)
    } else toast.error('Enter a valid wallet address.')
  }

  const firstAt = activity.data?.summary.firstAt ?? null

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          view()
        }}
        className="field glass-inner flex items-center gap-2 rounded-2xl px-3"
      >
        <Search className="size-4 shrink-0" style={{ color: 'var(--subtle)' }} aria-hidden />
        <input
          value={lookup}
          onChange={(e) => setLookup(e.target.value)}
          placeholder="Look up another wallet (0x…)"
          aria-label="Look up another wallet"
          spellCheck={false}
          className="mono min-h-11 w-full bg-transparent text-xs outline-none placeholder:text-slate-300"
        />
        {!isOwn && (
          <button
            type="button"
            onClick={() => {
              setViewing(ownAddress)
              setLookup('')
            }}
            className="shrink-0 text-xs font-semibold"
            style={{ color: 'var(--accent-hover)' }}
          >
            My wallet
          </button>
        )}
      </form>

      {profileQuery.isLoading ? (
        <PanelSkeleton rows={2} />
      ) : profileQuery.error ? (
        <PanelError message={profileQuery.error.message} onRetry={() => void profileQuery.refetch()} />
      ) : (
        <>
          <div className="glass-inner rounded-2xl p-4">
            <div className="flex items-start gap-3.5">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: avatarGradient(viewing) }}>
                <User className="size-6 text-white/90" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="display truncate text-xl font-semibold">
                  {profile?.displayName ?? onchain?.ensName ?? (isOwn ? 'Unnamed wallet' : 'No profile yet')}
                </h3>
                <a
                  href={addressUrl(viewing)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono inline-flex items-center gap-1 text-xs"
                  style={{ color: 'var(--accent-hover)' }}
                >
                  {shortAddress(viewing)} <ExternalLink className="size-3" />
                </a>
                {profile?.bio && (
                  <p className="mt-2 text-pretty text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    {profile.bio}
                  </p>
                )}
                {onchain?.isContract && (
                  <span className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: 'var(--surface-muted)' }}>
                    Smart contract
                  </span>
                )}
              </div>
              {isOwn && !editing && (
                <button
                  onClick={startEditing}
                  aria-label="Edit profile"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5"
                >
                  <Pencil className="size-4" style={{ color: 'var(--muted)' }} />
                </button>
              )}
            </div>

            {isOwn && editing && (
              <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <label htmlFor="displayName" className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                    Display name
                  </label>
                  <input
                    id="displayName"
                    value={displayName}
                    maxLength={32}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="field w-full rounded-xl border bg-white/70 px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
                <div>
                  <label htmlFor="bio" className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    value={bio}
                    maxLength={160}
                    rows={2}
                    onChange={(e) => setBio(e.target.value)}
                    className="field w-full resize-none rounded-xl border bg-white/70 px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
                <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                  Saving asks your wallet for a free signature. It costs no gas.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => void save()}
                    disabled={saving}
                    className="min-h-11 flex-1 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: 'var(--accent)' }}
                  >
                    {saving ? 'Waiting for signature…' : 'Save profile'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="min-h-11 rounded-xl px-4 text-sm font-medium"
                    style={{ background: 'var(--surface-muted)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="USDC balance" value={balance.amount ? formatUsdcDisplay(balance.amount) : '—'} />
            <Stat label="Transactions" value={onchain?.txCount?.toLocaleString() ?? '—'} />
            <Stat label="USDC transfers" value={onchain?.transferCount?.toLocaleString() ?? '—'} />
            <Stat label="Earliest loaded" value={firstAt ? formatDate(firstAt) : '—'} />
          </div>
        </>
      )}
    </div>
  )
}
