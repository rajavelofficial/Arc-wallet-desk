import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, usePublicClient } from 'wagmi'
import { erc20Abi } from 'viem'
import { TARGET_CHAIN_ID, USDC_ADDRESS } from '@/lib/chain'
import { Amount, gasTokenDecimalsFor, gasTokenToUsdc } from '@/onchain-money'

/**
 * Estimates the network fee of a USDC transfer, returned in the 6-decimal USDC view.
 * Gas is metered in the 18-decimal native view of the same pool; the rescale goes through
 * `gasTokenToUsdc`, never a hand-written divisor.
 */
export function useFeeEstimator() {
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID })
  const { address } = useAccount()

  return useCallback(
    async (to: `0x${string}`, raw: bigint): Promise<Amount> => {
      if (!client || !address) throw new Error('Wallet or network client unavailable')
      const [gas, fees] = await Promise.all([
        client.estimateContractGas({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [to, raw],
          account: address,
        }),
        client.estimateFeesPerGas(),
      ])
      const perGas = fees.maxFeePerGas ?? fees.gasPrice
      if (perGas === undefined) throw new Error('Gas price unavailable')
      const native = Amount.fromRaw(gas * perGas, gasTokenDecimalsFor(TARGET_CHAIN_ID))
      return gasTokenToUsdc(TARGET_CHAIN_ID, native, 'trunc')
    },
    [client, address],
  )
}

export function useFeeEstimate(to: `0x${string}` | undefined, raw: bigint | undefined) {
  const estimate = useFeeEstimator()
  const { address } = useAccount()
  return useQuery({
    queryKey: ['fee', address, to, raw?.toString()],
    queryFn: () => estimate(to as `0x${string}`, raw as bigint),
    enabled: Boolean(address && to && raw !== undefined && raw > 0n),
    staleTime: 15_000,
    retry: false,
  })
}
