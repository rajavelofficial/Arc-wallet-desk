import { createPublicClient, http } from 'viem'
import { arcTestnet } from 'viem/chains'
import { requireChain, getUsdc } from '../src/onchain-facts'

export const CHAIN_ID = arcTestnet.id
export const chainFacts = requireChain(CHAIN_ID)

const usdcFact = getUsdc(CHAIN_ID)
if (!usdcFact) throw new Error(`USDC is not deployed on chain ${CHAIN_ID}`)
export const USDC_ADDRESS = usdcFact.address

// Compass chain key used by the sandbox RPC proxy.
const CHAIN_KEY = 'Arc_Testnet'

function resolveRpc(): { url: string; kind: 'proxy' | 'public' } {
  const override = process.env['RPC_URL_' + CHAIN_KEY]
  if (override) return { url: override, kind: 'public' }
  const proxyChains = (process.env.RPC_PROXY_CHAINS || '').split(',')
  if (process.env.RPC_PROXY_BASE_URL && proxyChains.includes(CHAIN_KEY)) {
    return {
      url: `${process.env.RPC_PROXY_BASE_URL}/api/rpc/${CHAIN_KEY}?_rpc_token=${process.env.RPC_PROXY_TOKEN}`,
      kind: 'proxy',
    }
  }
  return { url: chainFacts.rpcUrls[0], kind: 'public' }
}

const rpc = resolveRpc()
export const rpcKind = rpc.kind

export const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpc.url) })
