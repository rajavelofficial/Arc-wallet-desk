import { useCallback } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { buildAuthMessage, type AuthAction, type SignedEnvelope } from '@/lib/auth'

/** Asks the connected wallet to sign an action so the backend can verify who requested it. */
export function useSignedRequest() {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()

  return useCallback(
    async (action: AuthAction, payload: unknown): Promise<SignedEnvelope> => {
      if (!address) throw new Error('Connect your wallet first.')
      const issuedAt = Date.now()
      const signature = await signMessageAsync({ message: buildAuthMessage(action, address, issuedAt, payload) })
      return { wallet: address, issuedAt, signature }
    },
    [address, signMessageAsync],
  )
}
