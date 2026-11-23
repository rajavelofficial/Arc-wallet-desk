import { decodeFunctionData, erc20Abi, getAddress, isHash } from 'viem'
import type { TrackedTransfer } from '../src/lib/api-types'
import { Amount, gasTokenDecimalsFor, gasTokenToUsdc } from '../src/onchain-money'
import { parseAddress } from './auth'
import { CHAIN_ID, USDC_ADDRESS, publicClient } from './chain'
import { HttpError } from './http'
import { addTransfer, findTransfer, pendingTransfers, removeTransfer, updateTransfer } from './store'

/**
 * Background tracker for transfers the wallet has already signed and broadcast.
 * It never holds keys and never sends anything: it watches the chain for each registered hash,
 * checks the transaction really is a USDC transfer from the claimed wallet, and records the outcome.
 */

const TICK_MS = 3000
const DROP_AFTER_MS = 10 * 60 * 1000
const MAX_PENDING_TOTAL = 200
const MAX_PENDING_PER_WALLET = 20

let running = false
let lastTickAt: number | null = null
let timer: ReturnType<typeof setInterval> | undefined

type Outcome = Partial<TrackedTransfer> | 'remove' | null

async function resolveTransfer(record: TrackedTransfer): Promise<Outcome> {
  const tx = await publicClient.getTransaction({ hash: record.hash as `0x${string}` }).catch(() => null)
  if (!tx) {
    // Not visible yet. Give a freshly broadcast transaction time to propagate before giving up.
    return Date.now() - record.submittedAt > DROP_AFTER_MS ? { status: 'dropped' } : null
  }

  const fromWallet = tx.from.toLowerCase() === record.from.toLowerCase()
  const toUsdc = tx.to?.toLowerCase() === USDC_ADDRESS.toLowerCase()
  if (!fromWallet || !toUsdc) return 'remove'

  let decoded
  try {
    decoded = decodeFunctionData({ abi: erc20Abi, data: tx.input })
  } catch {
    return 'remove'
  }
  if (decoded.functionName !== 'transfer') return 'remove'
  const [to, value] = decoded.args
  const details = { to: getAddress(to), amount: value.toString() }

  const receipt = await publicClient.getTransactionReceipt({ hash: record.hash as `0x${string}` }).catch(() => null)
  if (!receipt) return details

  // Gas is metered in the 18-decimal native view of the same USDC pool; rescale with the shared helper.
  const native = Amount.fromRaw(receipt.gasUsed * receipt.effectiveGasPrice, gasTokenDecimalsFor(CHAIN_ID))
  const fee = gasTokenToUsdc(CHAIN_ID, native, 'trunc')
  return {
    ...details,
    status: receipt.status === 'success' ? 'confirmed' : 'failed',
    blockNumber: Number(receipt.blockNumber),
    fee: fee.raw.toString(),
  }
}

async function tick(): Promise<void> {
  if (running) return
  const pending = pendingTransfers()
  lastTickAt = Date.now()
  if (pending.length === 0) return
  running = true
  try {
    for (const record of pending) {
      try {
        const outcome = await resolveTransfer(record)
        if (outcome === 'remove') await removeTransfer(record.hash)
        else if (outcome) await updateTransfer(record.hash, outcome)
      } catch (error) {
        console.error('[tracker] could not update', record.hash, error instanceof Error ? error.message : error)
      }
    }
  } finally {
    running = false
  }
}

export function startTracker(): void {
  if (timer) return
  timer = setInterval(() => void tick(), TICK_MS)
  void tick()
}

export function trackerStats(): { pending: number; lastTickAt: number | null } {
  return { pending: pendingTransfers().length, lastTickAt }
}

/** Registers a broadcast transaction. Details are read from the chain, never trusted from the client. */
export async function registerTransfer(hash: unknown, wallet: unknown): Promise<TrackedTransfer> {
  if (typeof hash !== 'string' || !isHash(hash)) throw new HttpError(400, 'hash is not a valid transaction hash')
  const from = parseAddress(wallet, 'wallet')

  const existing = findTransfer(hash)
  if (existing) return existing

  const pending = pendingTransfers()
  if (pending.length >= MAX_PENDING_TOTAL) throw new HttpError(503, 'Tracker is busy. Try again shortly.')
  if (pending.filter((t) => t.from.toLowerCase() === from.toLowerCase()).length >= MAX_PENDING_PER_WALLET) {
    throw new HttpError(429, 'Too many transfers are still pending for this wallet')
  }

  const now = Date.now()
  const record: TrackedTransfer = {
    hash,
    from,
    to: null,
    amount: null,
    status: 'pending',
    submittedAt: now,
    updatedAt: now,
    blockNumber: null,
    fee: null,
  }
  await addTransfer(record)
  void tick()
  return record
}
