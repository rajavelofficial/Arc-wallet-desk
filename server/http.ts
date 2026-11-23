import type { IncomingMessage, ServerResponse } from 'node:http'
import { cleanText } from '../src/lib/auth'

export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

const MAX_BODY_BYTES = 200_000

export async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = chunk as Buffer
    size += buf.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large')
    chunks.push(buf)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new HttpError(400, 'Body must be a JSON object')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'Body is not valid JSON')
  }
}

export function str(value: unknown, field: string, max: number, opts: { min?: number } = {}): string {
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be a string`)
  const clean = cleanText(value)
  if (clean.length < (opts.min ?? 0)) throw new HttpError(400, `${field} is too short`)
  if (clean.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`)
  return clean
}
