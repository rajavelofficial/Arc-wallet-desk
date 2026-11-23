import type {
  ActivityResponse,
  ContractsResponse,
  HistoryFilter,
  HistoryPage,
  ProfileResponse,
  TrackedTransfer,
  TransfersResponse,
  WalletProfile,
} from './api-types'
import type { SignedEnvelope } from './auth'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the backend. Is the API server running?')
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    // The dev proxy answers with an empty 5xx when nothing is listening behind it.
    if (!body.error && res.status >= 500) {
      throw new ApiError(res.status, 'The backend is not responding. Restart the app server and try again.')
    }
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`)
  }
  return body as T
}

export const api = {
  activity: (address: string) => request<ActivityResponse>(`/activity/${address}`),
  history: (address: string, filter: HistoryFilter, cursor: string | null) => {
    const query = new URLSearchParams({ filter })
    if (cursor) query.set('cursor', cursor)
    return request<HistoryPage>(`/history/${address}?${query.toString()}`)
  },
  profile: (address: string) => request<ProfileResponse>(`/profile/${address}`),
  saveProfile: (input: { displayName: string; bio: string } & SignedEnvelope) =>
    request<{ profile: WalletProfile }>('/profile', { method: 'PUT', body: JSON.stringify(input) }),
  transfers: (address: string) => request<TransfersResponse>(`/transfers/${address}`),
  trackTransfer: (input: { hash: string; wallet: string }) =>
    request<{ transfer: TrackedTransfer }>('/transfers', { method: 'POST', body: JSON.stringify(input) }),
  contracts: (owner: string) => request<ContractsResponse>(`/contracts/${owner}`),
  addContract: (input: { address: string; name: string; abi: unknown[] | null } & SignedEnvelope) =>
    request<ContractsResponse>('/contracts', { method: 'POST', body: JSON.stringify(input) }),
  removeContract: (input: { address: string } & SignedEnvelope) =>
    request<ContractsResponse>('/contracts', { method: 'DELETE', body: JSON.stringify(input) }),
}
