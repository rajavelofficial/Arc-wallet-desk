import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  ContractsResponse,
  HealthResponse,
  HistoryFilter,
  ProfileResponse,
  SavedContract,
  TransfersResponse,
} from '../src/lib/api-types'
import { getActivity } from './activity'
import { parseAddress, verifySigned } from './auth'
import { CHAIN_ID, publicClient, rpcKind } from './chain'
import { fetchHistoryPage, fetchOnchainProfile } from './explorer'
import { HttpError, readJson, sendJson, str } from './http'
import { addContract, getProfile, initStore, listContracts, listTransfers, removeContract, saveProfile } from './store'
import { registerTransfer, startTracker, trackerStats } from './tracker'

const PORT = Number(process.env.API_PORT ?? 3001)
const CONTRACT_LIMIT = 25
const MAX_ABI_BYTES = 100_000

function parseAbi(value: unknown): unknown[] | null {
  if (value === undefined || value === null || value === '') return null
  const abi: unknown = typeof value === 'string' ? safeParse(value) : value
  if (!Array.isArray(abi) || abi.length === 0 || abi.length > 300) {
    throw new HttpError(400, 'ABI must be a JSON array of ABI items')
  }
  for (const item of abi) {
    if (typeof item !== 'object' || item === null || typeof (item as { type?: unknown }).type !== 'string') {
      throw new HttpError(400, 'ABI contains an invalid item')
    }
  }
  if (JSON.stringify(abi).length > MAX_ABI_BYTES) throw new HttpError(413, 'ABI is too large')
  return abi as unknown[]
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'ABI is not valid JSON')
  }
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const parts = url.pathname.split('/').filter(Boolean)
  const method = req.method ?? 'GET'

  if (method === 'GET' && parts[0] === 'health') {
    const body: HealthResponse = { ok: true, chainId: CHAIN_ID, rpc: rpcKind, tracker: trackerStats() }
    return sendJson(res, 200, body)
  }

  if (method === 'GET' && parts[0] === 'activity' && parts[1]) {
    return sendJson(res, 200, await getActivity(parseAddress(parts[1])))
  }

  if (method === 'GET' && parts[0] === 'transfers' && parts[1]) {
    const body: TransfersResponse = { transfers: listTransfers(parseAddress(parts[1])) }
    return sendJson(res, 200, body)
  }

  if (method === 'POST' && parts[0] === 'transfers') {
    const body = await readJson(req)
    return sendJson(res, 202, { transfer: await registerTransfer(body.hash, body.wallet) })
  }

  if (method === 'GET' && parts[0] === 'history' && parts[1]) {
    const filterParam = url.searchParams.get('filter') ?? 'all'
    if (filterParam !== 'all' && filterParam !== 'in' && filterParam !== 'out') {
      throw new HttpError(400, 'filter must be all, in or out')
    }
    const filter: HistoryFilter = filterParam
    return sendJson(res, 200, await fetchHistoryPage(parseAddress(parts[1]), filter, url.searchParams.get('cursor')))
  }

  if (method === 'GET' && parts[0] === 'profile' && parts[1]) {
    const address = parseAddress(parts[1])
    const [profile, onchain] = await Promise.all([getProfile(address), fetchOnchainProfile(address)])
    const body: ProfileResponse = { profile, onchain }
    return sendJson(res, 200, body)
  }

  if (method === 'PUT' && parts[0] === 'profile') {
    const body = await readJson(req)
    const displayName = str(body.displayName, 'displayName', 32, { min: 1 })
    const bio = str(body.bio ?? '', 'bio', 160)
    const wallet = await verifySigned('profile.update', body, { displayName, bio })
    const profile = await saveProfile({ address: wallet, displayName, bio, updatedAt: Date.now() })
    return sendJson(res, 200, { profile })
  }

  if (method === 'GET' && parts[0] === 'contracts' && parts[1]) {
    const body: ContractsResponse = { contracts: await listContracts(parseAddress(parts[1])) }
    return sendJson(res, 200, body)
  }

  if (method === 'POST' && parts[0] === 'contracts') {
    const body = await readJson(req)
    const address = parseAddress(body.address)
    const name = str(body.name, 'name', 40, { min: 1 })
    const abi = parseAbi(body.abi)
    const wallet = await verifySigned('contract.add', body, { address, name, abi })
    const code = await publicClient.getCode({ address: address as `0x${string}` })
    if (!code || code === '0x') throw new HttpError(400, 'No contract code at that address on Arc Testnet')
    const contract: SavedContract = { address, name, abi, addedAt: Date.now() }
    try {
      const contracts = await addContract(wallet, contract, CONTRACT_LIMIT)
      const out: ContractsResponse = { contracts }
      return sendJson(res, 201, out)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message === 'DUPLICATE') throw new HttpError(409, 'That contract is already in your list')
      if (message === 'LIMIT') throw new HttpError(400, `You can save up to ${CONTRACT_LIMIT} contracts`)
      throw error
    }
  }

  if (method === 'DELETE' && parts[0] === 'contracts') {
    const body = await readJson(req)
    const address = parseAddress(body.address)
    const wallet = await verifySigned('contract.remove', body, { address })
    const out: ContractsResponse = { contracts: await removeContract(wallet, address) }
    return sendJson(res, 200, out)
  }

  throw new HttpError(404, 'Not found')
}

const server = createServer((req, res) => {
  route(req, res).catch((error: unknown) => {
    if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message })
    console.error('[api] unhandled error', error instanceof Error ? error.message : error)
    sendJson(res, 500, { error: 'Something went wrong on the server' })
  })
})

await initStore()
startTracker()

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`[api] port ${PORT} is already served by another API process, exiting`)
    process.exit(0)
  }
  throw error
})

server.listen(PORT, () => {
  console.log(`[api] listening on :${PORT} (chain ${CHAIN_ID}, rpc ${rpcKind}), transfer tracker running`)
})
