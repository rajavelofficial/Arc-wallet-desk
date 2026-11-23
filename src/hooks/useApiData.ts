import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { HistoryFilter } from '@/lib/api-types'
import { api } from '@/lib/api'

export function useActivity(address: string | undefined) {
  return useQuery({
    queryKey: ['activity', address],
    queryFn: () => api.activity(address as string),
    enabled: Boolean(address),
    refetchInterval: 20_000,
    retry: 1,
  })
}

/** Full transfer history, newest first, loaded one explorer page at a time. */
export function useHistory(address: string | undefined, filter: HistoryFilter) {
  return useInfiniteQuery({
    queryKey: ['activity', 'history', address, filter],
    queryFn: ({ pageParam }) => api.history(address as string, filter, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(address),
    retry: 1,
  })
}

/** Sends the backend is following. Polls quickly while any is unsettled, slowly otherwise. */
export function useTrackedTransfers(address: string | undefined) {
  return useQuery({
    queryKey: ['transfers', address],
    queryFn: () => api.transfers(address as string),
    enabled: Boolean(address),
    refetchInterval: (query) =>
      query.state.data?.transfers.some((t) => t.status === 'pending') ? 3000 : 30_000,
    retry: 1,
  })
}

export function useProfile(address: string | undefined) {
  return useQuery({
    queryKey: ['profile', address],
    queryFn: () => api.profile(address as string),
    enabled: Boolean(address),
    retry: 1,
  })
}

export function useContracts(address: string | undefined) {
  return useQuery({
    queryKey: ['contracts', address],
    queryFn: () => api.contracts(address as string),
    enabled: Boolean(address),
    retry: 1,
  })
}
