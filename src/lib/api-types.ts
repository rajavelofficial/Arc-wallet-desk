/** Response shapes served by the backend (server/index.ts). Amounts are raw 6-decimal USDC strings. */

export type TransferDirection = 'in' | 'out' | 'self'

export interface TransferItem {
  hash: string
  blockNumber: number
  timestamp: number
  from: string
  to: string
  direction: TransferDirection
  amount: string
  counterparty: string
}

export interface SeriesPoint {
  /** Bucket start, ms since epoch. */
  t: number
  inflow: string
  outflow: string
  /** Cumulative net flow (inflow minus outflow) up to the end of this bucket. */
  net: string
}

export interface Counterparty {
  address: string
  volume: string
  count: number
}

export interface ActivitySummary {
  totalIn: string
  totalOut: string
  countIn: number
  countOut: number
  firstAt: number | null
  lastAt: number | null
  largestIn: string
  largestOut: string
  topCounterparties: Counterparty[]
}

export interface ActivityResponse {
  address: string
  fetchedAt: number
  /** True when older history exists beyond the transfers loaded. */
  truncated: boolean
  summary: ActivitySummary
  transfers: TransferItem[]
}

export type HistoryFilter = 'all' | 'in' | 'out'

export interface HistoryPage {
  items: TransferItem[]
  /** Opaque cursor for the next page, or null at the end of history. */
  nextCursor: string | null
}

export interface WalletProfile {
  address: string
  displayName: string
  bio: string
  updatedAt: number
}

export interface OnchainProfile {
  txCount: number | null
  transferCount: number | null
  isContract: boolean
  ensName: string | null
}

export interface ProfileResponse {
  profile: WalletProfile | null
  onchain: OnchainProfile
}

export interface SavedContract {
  address: string
  name: string
  abi: unknown[] | null
  addedAt: number
}

export interface ContractsResponse {
  contracts: SavedContract[]
}

export type TransferStatus = 'pending' | 'confirmed' | 'failed' | 'dropped'

/** A USDC transfer the wallet broadcast, followed by the backend until it settles. */
export interface TrackedTransfer {
  hash: string
  from: string
  /** Filled in from the chain once the transaction is visible. */
  to: string | null
  /** Raw 6-decimal USDC. */
  amount: string | null
  status: TransferStatus
  submittedAt: number
  updatedAt: number
  blockNumber: number | null
  /** Network fee actually paid, raw 6-decimal USDC. */
  fee: string | null
}

export interface TransfersResponse {
  transfers: TrackedTransfer[]
}

export interface HealthResponse {
  ok: boolean
  chainId: number
  rpc: 'proxy' | 'public'
  tracker: { pending: number; lastTickAt: number | null }
}
