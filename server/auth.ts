import { getAddress, isAddress, isHex } from 'viem'
import { AUTH_WINDOW_MS, buildAuthMessage, type AuthAction } from '../src/lib/auth'
import { publicClient } from './chain'
import { HttpError } from './http'

export function parseAddress(value: unknown, field = 'address'): string {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) {
    throw new HttpError(400, `${field} is not a valid address`)
  }
  return getAddress(value.toLowerCase())
}

/** Confirms the wallet signed exactly this action and payload, recently. */
export async function verifySigned(
  action: AuthAction,
  body: Record<string, unknown>,
  payload: unknown,
): Promise<string> {
  const wallet = parseAddress(body.wallet, 'wallet')
  const issuedAt = body.issuedAt
  const signature = body.signature
  if (typeof issuedAt !== 'number' || !Number.isFinite(issuedAt)) throw new HttpError(400, 'issuedAt is required')
  if (typeof signature !== 'string' || !isHex(signature)) throw new HttpError(400, 'signature is required')
  if (Math.abs(Date.now() - issuedAt) > AUTH_WINDOW_MS) {
    throw new HttpError(401, 'The signed request has expired. Sign again.')
  }
  let valid = false
  try {
    valid = await publicClient.verifyMessage({
      address: wallet as `0x${string}`,
      message: buildAuthMessage(action, wallet, issuedAt, payload),
      signature,
    })
  } catch {
    valid = false
  }
  if (!valid) throw new HttpError(401, 'Signature does not match this wallet')
  return wallet
}
