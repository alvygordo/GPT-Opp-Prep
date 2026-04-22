import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET() {const ACCOUNT_ID = process.env.NS_ACCOUNT_ID?.trim()
const CONSUMER_KEY = process.env.NS_CONSUMER_KEY?.trim()
const CONSUMER_SECRET = process.env.NS_CONSUMER_SECRET?.trim()
const TOKEN_ID = process.env.NS_TOKEN_ID?.trim()
const TOKEN_SECRET = process.env.NS_TOKEN_SECRET?.trim()

if (!ACCOUNT_ID || !CONSUMER_KEY || !CONSUMER_SECRET || !TOKEN_ID || !TOKEN_SECRET) {
  return NextResponse.json(
    { error: 'Missing NetSuite environment variables' },
    { status: 500 }
  )
}

function buildAuthHeader(
  method: string,
  url: string,
  accountId: string,
  consumerKey: string,
  consumerSecret: string,
  tokenId: string,
  tokenSecret: string
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomBytes(16).toString('hex')

  const oauthParams: [string, string][] = [
    ['oauth_consumer_key', CONSUMER_KEY],
    ['oauth_nonce', nonce],
    ['oauth_signature_method', 'HMAC-SHA256'],
    ['oauth_timestamp', timestamp],
    ['oauth_token', TOKEN_ID],
    ['oauth_version', '1.0'],
  ]

  // RFC 5849: sort by encoded key, then encoded value
  const sortedParams = [...oauthParams]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&')

  // Signing key: raw secrets joined by &  (hex chars don't need encoding but keep canonical)
  const signingKey = `${encodeURIComponent(CONSUMER_SECRET)}&${encodeURIComponent(TOKEN_SECRET)}`

  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(baseString)
    .digest('base64')

  // realm unencoded; oauth_* values encoded
  const headerParts = [
    `realm="${ACCOUNT_ID}"`,
    ...oauthParams.map(([k, v]) => `${k}="${encodeURIComponent(v)}"`),
    `oauth_signature="${encodeURIComponent(signature)}"`,
  ]

  return `OAuth ${headerParts.join(', ')}`
}

export async function GET() {
  const envCheck = {
    NS_ACCOUNT_ID: !!ACCOUNT_ID,
    NS_CONSUMER_KEY: !!CONSUMER_KEY && `${CONSUMER_KEY.slice(0, 6)}...`,
    NS_CONSUMER_SECRET: !!CONSUMER_SECRET && `${CONSUMER_SECRET.slice(0, 6)}...`,
    NS_TOKEN_ID: !!TOKEN_ID && `${TOKEN_ID.slice(0, 6)}...`,
    NS_TOKEN_SECRET: !!TOKEN_SECRET && `${TOKEN_SECRET.slice(0, 6)}...`,
  }

  // Try simplest possible authenticated request — list 1 customer record
  const testUrl = `https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/services/rest/record/v1/customer?limit=1`
  const auth = buildAuthHeader(
  'GET',
  testUrl,
  ACCOUNT_ID,
  CONSUMER_KEY,
  CONSUMER_SECRET,
  TOKEN_ID,
  TOKEN_SECRET
)

  try {
    const res = await fetch(testUrl, {
      method: 'GET',
      headers: { Authorization: auth },
    })

    const body = await res.text()
    let parsed: unknown
    try { parsed = JSON.parse(body) } catch { parsed = body }

    return NextResponse.json({
      env: envCheck,
      test: 'GET /record/v1/customer?limit=1',
      status: res.status,
      response: parsed,
    })
  } catch (err) {
    return NextResponse.json({
      env: envCheck,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
