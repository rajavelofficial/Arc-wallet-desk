import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SavedContract, TrackedTransfer, WalletProfile } from '../src/lib/api-types'

interface Db {
  profiles: Record<string, WalletProfile>
  contracts: Record<string, SavedContract[]>
  transfers: TrackedTransfer[]
}

const TRANSFER_HISTORY_CAP = 500

const FILE = fileURLToPath(new URL('./data/db.json', import.meta.url))

let db: Db | null = null
let queue: Promise<unknown> = Promise.resolve()

async function load(): Promise<Db> {
  if (db) return db
  try {
    const parsed = JSON.parse(await readFile(FILE, 'utf8')) as Partial<Db>
    db = { profiles: parsed.profiles ?? {}, contracts: parsed.contracts ?? {}, transfers: parsed.transfers ?? [] }
  } catch {
    db = { profiles: {}, contracts: {}, transfers: [] }
  }
  return db
}

/** Serialises every read-modify-write so concurrent requests cannot clobber each other. */
function mutate<T>(fn: (data: Db) => T): Promise<T> {
  const run = queue.then(async () => {
    const data = await load()
    const result = fn(data)
    await mkdir(dirname(FILE), { recursive: true })
    const tmp = `${FILE}.tmp`
    await writeFile(tmp, JSON.stringify(data, null, 2))
    await rename(tmp, FILE)
    return result
  })
  queue = run.catch(() => undefined)
  return run
}

export async function getProfile(address: string): Promise<WalletProfile | null> {
  return (await load()).profiles[address.toLowerCase()] ?? null
}

export function saveProfile(profile: WalletProfile): Promise<WalletProfile> {
  return mutate((data) => {
    data.profiles[profile.address.toLowerCase()] = profile
    return profile
  })
}

export async function listContracts(owner: string): Promise<SavedContract[]> {
  return (await load()).contracts[owner.toLowerCase()] ?? []
}

export function addContract(owner: string, contract: SavedContract, limit: number): Promise<SavedContract[]> {
  return mutate((data) => {
    const key = owner.toLowerCase()
    const list = data.contracts[key] ?? []
    if (list.some((c) => c.address.toLowerCase() === contract.address.toLowerCase())) {
      throw new Error('DUPLICATE')
    }
    if (list.length >= limit) throw new Error('LIMIT')
    data.contracts[key] = [contract, ...list]
    return data.contracts[key]
  })
}

export function removeContract(owner: string, address: string): Promise<SavedContract[]> {
  return mutate((data) => {
    const key = owner.toLowerCase()
    data.contracts[key] = (data.contracts[key] ?? []).filter(
      (c) => c.address.toLowerCase() !== address.toLowerCase(),
    )
    return data.contracts[key]
  })
}

/** Loads the database once at startup so the tracker can read it synchronously. */
export async function initStore(): Promise<void> {
  await load()
}

function loaded(): Db {
  if (!db) throw new Error('Store is not initialised')
  return db
}

export const pendingTransfers = (): TrackedTransfer[] => loaded().transfers.filter((t) => t.status === 'pending')

export const findTransfer = (hash: string): TrackedTransfer | undefined =>
  loaded().transfers.find((t) => t.hash.toLowerCase() === hash.toLowerCase())

/** Newest first. */
export const listTransfers = (address: string, limit = 20): TrackedTransfer[] =>
  loaded()
    .transfers.filter((t) => t.from.toLowerCase() === address.toLowerCase())
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, limit)

export function addTransfer(record: TrackedTransfer): Promise<void> {
  return mutate((data) => {
    data.transfers.push(record)
    if (data.transfers.length > TRANSFER_HISTORY_CAP) {
      // Drop the oldest settled records first; pending ones are still being followed.
      const settled = data.transfers.filter((t) => t.status !== 'pending').sort((a, b) => a.submittedAt - b.submittedAt)
      const excess = data.transfers.length - TRANSFER_HISTORY_CAP
      const drop = new Set(settled.slice(0, excess).map((t) => t.hash))
      data.transfers = data.transfers.filter((t) => !drop.has(t.hash))
    }
  })
}

export function updateTransfer(hash: string, patch: Partial<TrackedTransfer>): Promise<void> {
  return mutate((data) => {
    const record = data.transfers.find((t) => t.hash.toLowerCase() === hash.toLowerCase())
    if (record) Object.assign(record, patch, { updatedAt: Date.now() })
  })
}

export function removeTransfer(hash: string): Promise<void> {
  return mutate((data) => {
    data.transfers = data.transfers.filter((t) => t.hash.toLowerCase() !== hash.toLowerCase())
  })
}
