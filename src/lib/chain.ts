import { arcTestnet } from 'viem/chains'
import { buildAddressExplorerUrl, buildTxExplorerUrl, getUsdc, requireChain } from '@/onchain-facts'
import { usdcDecimalsFor } from '@/onchain-money'

export const TARGET_CHAIN_ID = arcTestnet.id
export const chainFacts = requireChain(TARGET_CHAIN_ID)

const usdc = getUsdc(TARGET_CHAIN_ID)
if (!usdc) throw new Error(`USDC is not deployed on chain ${TARGET_CHAIN_ID}`)

export const USDC_ADDRESS = usdc.address as `0x${string}`
export const USDC_DECIMALS = usdcDecimalsFor(TARGET_CHAIN_ID)

export const txUrl = (hash: string) => buildTxExplorerUrl(TARGET_CHAIN_ID, hash)
export const addressUrl = (address: string) => buildAddressExplorerUrl(TARGET_CHAIN_ID, address)
