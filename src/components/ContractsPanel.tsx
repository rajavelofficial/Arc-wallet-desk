import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getAddress, isAddress } from 'viem'
import { Loader2, Plus, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useContracts } from '@/hooks/useApiData'
import { useSignedRequest } from '@/hooks/useSignedRequest'
import { api } from '@/lib/api'
import { cleanText } from '@/lib/auth'
import { isUserRejection } from '@/lib/format'
import { ContractCard } from './ContractCard'
import { PanelEmpty, PanelError, PanelSkeleton } from './PanelStates'

/** Accepts a bare ABI array, or a Foundry/Hardhat artifact that carries one under `abi`. */
function parseAbiInput(text: string): unknown[] | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error('The ABI is not valid JSON.')
  }
  const abi = Array.isArray(parsed) ? parsed : (parsed as { abi?: unknown } | null)?.abi
  if (!Array.isArray(abi) || abi.length === 0) throw new Error('Paste the ABI as a JSON array.')
  return abi as unknown[]
}

export function ContractsPanel({ ownAddress }: { ownAddress: string }) {
  const queryClient = useQueryClient()
  const sign = useSignedRequest()
  const { data, isLoading, error, refetch } = useContracts(ownAddress)

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [abiText, setAbiText] = useState('')
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['contracts', ownAddress] })

  const add = async () => {
    try {
      if (!isAddress(address.trim())) throw new Error('Enter a valid contract address.')
      const payload = {
        address: getAddress(address.trim().toLowerCase()),
        name: cleanText(name),
        abi: parseAbiInput(abiText),
      }
      if (!payload.name) throw new Error('Give the contract a name.')
      setBusy(true)
      const envelope = await sign('contract.add', payload)
      await api.addContract({ ...payload, ...envelope })
      await refresh()
      setAdding(false)
      setName('')
      setAddress('')
      setAbiText('')
      toast.success('Contract added')
    } catch (e) {
      if (isUserRejection(e)) toast('Signature cancelled')
      else toast.error(e instanceof Error ? e.message : 'Could not add the contract')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (contractAddress: string) => {
    setRemoving(contractAddress)
    try {
      const envelope = await sign('contract.remove', { address: contractAddress })
      await api.removeContract({ address: contractAddress, ...envelope })
      await refresh()
    } catch (e) {
      if (isUserRejection(e)) toast('Signature cancelled')
      else toast.error(e instanceof Error ? e.message : 'Could not remove the contract')
    } finally {
      setRemoving(null)
    }
  }

  const fieldClass = 'field w-full rounded-xl border bg-white/70 px-3 py-2.5 text-sm outline-none'

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-2xl p-3.5" style={{ background: 'rgba(154,98,0,0.09)' }}>
        <ShieldAlert className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--warn)' }} aria-hidden />
        <p className="text-pretty text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          Contracts here are read-only: you can inspect their state, not send transactions to them. Only add contracts you
          recognise, since an unknown contract can report misleading data.
        </p>
      </div>

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          <Plus className="size-4" aria-hidden /> Add contract
        </button>
      ) : (
        <div className="glass-inner space-y-3 rounded-2xl p-4">
          <div>
            <label htmlFor="c-name" className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              Name
            </label>
            <input id="c-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={fieldClass} style={{ borderColor: 'var(--border)' }} />
          </div>
          <div>
            <label htmlFor="c-address" className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              Contract address on Arc Testnet
            </label>
            <input
              id="c-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x…"
              spellCheck={false}
              className={`${fieldClass} mono`}
              style={{ borderColor: 'var(--border)' }}
            />
          </div>
          <div>
            <label htmlFor="c-abi" className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              ABI (optional JSON)
            </label>
            <textarea
              id="c-abi"
              value={abiText}
              onChange={(e) => setAbiText(e.target.value)}
              rows={4}
              placeholder="Leave empty for a token. Paste an ABI array or a build artifact for anything else."
              spellCheck={false}
              className={`${fieldClass} mono resize-none text-xs`}
              style={{ borderColor: 'var(--border)' }}
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            Adding asks your wallet for a free signature. It costs no gas.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => void add()}
              disabled={busy}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {busy ? 'Adding…' : 'Save contract'}
            </button>
            <button
              onClick={() => setAdding(false)}
              disabled={busy}
              className="min-h-11 rounded-xl px-4 text-sm font-medium"
              style={{ background: 'var(--surface-muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <PanelSkeleton rows={2} />
      ) : error ? (
        <PanelError message={error.message} onRetry={() => void refetch()} />
      ) : !data || data.contracts.length === 0 ? (
        <PanelEmpty title="No contracts yet" body="Add a token or any contract to read its live state straight from Arc Testnet." />
      ) : (
        <ul className="space-y-3">
          {data.contracts.map((c) => (
            <ContractCard key={c.address} contract={c} removing={removing === c.address} onRemove={() => void remove(c.address)} />
          ))}
        </ul>
      )}
    </div>
  )
}
