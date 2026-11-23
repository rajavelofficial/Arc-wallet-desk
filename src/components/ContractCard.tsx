import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, usePublicClient } from 'wagmi'
import { erc20Abi, isAddress, isHex, type Abi, type AbiFunction } from 'viem'
import { ChevronDown, ExternalLink, Loader2, Play, Trash2 } from 'lucide-react'
import type { SavedContract } from '@/lib/api-types'
import { TARGET_CHAIN_ID, addressUrl } from '@/lib/chain'
import { shortAddress } from '@/lib/format'

const SIMPLE_TYPE = /^(address|bool|string|bytes\d*|u?int\d*)$/

function isReadFn(item: unknown): item is AbiFunction {
  const f = item as Partial<AbiFunction> | null
  return (
    f?.type === 'function' &&
    typeof f.name === 'string' &&
    (f.stateMutability === 'view' || f.stateMutability === 'pure') &&
    Array.isArray(f.inputs) &&
    f.inputs.every((i: { type: string }) => SIMPLE_TYPE.test(i.type))
  )
}

function parseArg(type: string, value: string): unknown {
  const v = value.trim()
  if (type === 'address') {
    if (!isAddress(v)) throw new Error('Enter a valid address')
    return v
  }
  if (type === 'bool') {
    if (v !== 'true' && v !== 'false') throw new Error('Enter true or false')
    return v === 'true'
  }
  if (type === 'string') return value
  if (type.startsWith('bytes')) {
    if (!isHex(v)) throw new Error('Enter hex starting with 0x')
    return v
  }
  if (!/^-?\d+$/.test(v)) throw new Error('Enter a whole number')
  return BigInt(v)
}

const show = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value, (_, x: unknown) => (typeof x === 'bigint' ? x.toString() : x), 2)

function ReadFunction({ address, fn, account }: { address: `0x${string}`; fn: AbiFunction; account: string | undefined }) {
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID })
  const [args, setArgs] = useState<string[]>(() =>
    fn.inputs.map((input, i) => (input.type === 'address' && i === 0 && account ? account : '')),
  )
  // Functions without inputs are read as soon as the card opens; the rest wait for a click.
  const [submitted, setSubmitted] = useState<string[] | null>(fn.inputs.length === 0 ? [] : null)

  const query = useQuery({
    queryKey: ['contract-read', address, fn.name, submitted],
    queryFn: async () => {
      const parsed = fn.inputs.map((input, i) => parseArg(input.type, submitted?.[i] ?? ''))
      const out = await (client as NonNullable<typeof client>).readContract({
        address,
        abi: [fn] as Abi,
        functionName: fn.name,
        args: parsed,
      })
      return show(out)
    },
    enabled: Boolean(client) && submitted !== null,
    retry: false,
    staleTime: 10_000,
  })

  const run = () => {
    if (submitted !== null && submitted.join('\u0000') === args.join('\u0000')) void query.refetch()
    else setSubmitted([...args])
  }

  const failure = query.error
    ? ((query.error as { shortMessage?: string }).shortMessage ?? query.error.message)
    : null

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="mono text-xs font-medium">{fn.name}</span>
        <button
          onClick={run}
          disabled={query.isFetching || !client}
          aria-label={`Read ${fn.name}`}
          className="flex size-8 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-40"
        >
          {query.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
        </button>
      </div>
      {fn.inputs.map((input, i) => (
        <input
          key={`${input.name}-${i}`}
          value={args[i] ?? ''}
          onChange={(e) => setArgs((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
          placeholder={`${input.name || `arg${i}`} (${input.type})`}
          aria-label={`${fn.name} ${input.name || `argument ${i + 1}`}`}
          spellCheck={false}
          className="mono mt-1.5 w-full rounded-lg border bg-white/70 px-2.5 py-2 text-xs outline-none"
          style={{ borderColor: 'var(--border)' }}
        />
      ))}
      {(query.data !== undefined || failure) && (
        <pre
          className="mono mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg p-2.5 text-xs"
          style={{ background: 'var(--surface-muted)', color: failure ? 'var(--danger)' : 'var(--ink-2)' }}
        >
          {failure ?? query.data}
        </pre>
      )}
    </li>
  )
}

interface Props {
  contract: SavedContract
  removing: boolean
  onRemove: () => void
}

export function ContractCard({ contract, removing, onRemove }: Props) {
  const { address: account } = useAccount()
  const [open, setOpen] = useState(false)
  const hasAbi = contract.abi !== null
  const address = contract.address as `0x${string}`

  // With no saved ABI the standard token reads are offered; a non-token contract will simply report a failed call.
  const functions = useMemo(
    () => ((hasAbi ? contract.abi : erc20Abi) as unknown[]).filter(isReadFn),
    [contract.abi, hasAbi],
  )

  return (
    <li className="glass-inner rounded-2xl">
      <div className="flex items-center gap-2 p-3.5">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--subtle)' }} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{contract.name}</span>
            <span className="mono block text-xs" style={{ color: 'var(--muted)' }}>
              {shortAddress(contract.address)} · {hasAbi ? `${functions.length} read functions` : 'token reads (no ABI saved)'}
            </span>
          </span>
        </button>
        <a
          href={addressUrl(contract.address)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View contract on explorer"
          className="flex size-9 items-center justify-center rounded-full hover:bg-black/5"
        >
          <ExternalLink className="size-3.5" style={{ color: 'var(--subtle)' }} />
        </a>
        <button
          onClick={onRemove}
          disabled={removing}
          aria-label={`Remove ${contract.name}`}
          className="flex size-9 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-40"
        >
          {removing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" style={{ color: 'var(--danger)' }} />}
        </button>
      </div>
      {open && (
        <ul className="divide-y border-t px-3.5" style={{ borderColor: 'var(--border)' }}>
          {functions.length === 0 ? (
            <li className="py-4 text-xs" style={{ color: 'var(--muted)' }}>
              This ABI has no read-only functions with simple inputs.
            </li>
          ) : (
            functions.map((fn, i) => <ReadFunction key={`${fn.name}-${i}`} address={address} fn={fn} account={account} />)
          )}
        </ul>
      )}
    </li>
  )
}
