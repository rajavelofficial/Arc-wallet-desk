import { useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { TARGET_CHAIN_ID, USDC_ADDRESS, USDC_DECIMALS } from '@/lib/chain'
import { Amount } from '@/onchain-money'

/**
 * The single USDC balance, read from the 6-decimal ERC-20 view.
 * On Arc the native gas balance is the same pool, so it is deliberately not read here.
 */
export function useUsdcBalance(address: `0x${string}` | undefined) {
  const query = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: Boolean(address), refetchInterval: 6000 },
  })
  const amount = query.data === undefined ? undefined : Amount.fromRaw(query.data, USDC_DECIMALS)
  return { amount, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch }
}
