/**
 * Signed-request format shared by the browser and the backend.
 * The wallet signs a human-readable message that binds the action, the wallet,
 * a timestamp and the exact payload, so the backend can verify who asked for what.
 */

export const AUTH_WINDOW_MS = 5 * 60 * 1000

export type AuthAction = 'profile.update' | 'contract.add' | 'contract.remove'

export function buildAuthMessage(
  action: AuthAction,
  wallet: string,
  issuedAt: number,
  payload: unknown,
): string {
  return [
    'Arc Wallet Desk',
    `Action: ${action}`,
    `Wallet: ${wallet.toLowerCase()}`,
    `Issued: ${issuedAt}`,
    `Payload: ${JSON.stringify(payload)}`,
  ].join('\n')
}

export interface SignedEnvelope {
  wallet: string
  issuedAt: number
  signature: string
}

/** Same sanitising on both sides so the signed payload matches byte for byte. */
export function cleanText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
}
