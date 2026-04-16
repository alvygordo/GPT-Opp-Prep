import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const ACCOUNT_ID = process.env.NS_ACCOUNT_ID!.trim()
const CONSUMER_KEY = process.env.NS_CONSUMER_KEY!.trim()
const CONSUMER_SECRET = process.env.NS_CONSUMER_SECRET!.trim()
const TOKEN_ID = process.env.NS_TOKEN_ID!.trim()
const TOKEN_SECRET = process.env.NS_TOKEN_SECRET!.trim()

const BASE_URL = `https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex')
}

function buildAuthHeader(method: string, url: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = generateNonce()

  const params: Record<string, string> = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_token: TOKEN_ID,
    oauth_version: '1.0',
  }

  // Build base string
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&')

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&')

  const signingKey = `${encodeURIComponent(CONSUMER_SECRET)}&${encodeURIComponent(TOKEN_SECRET)}`
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(baseString)
    .digest('base64')

  // Build Authorization header
  // realm must NOT be percent-encoded per RFC 2617
  // all oauth_* values must be percent-encoded per RFC 5849
  const oauthHeaderParts = [
    `realm="${ACCOUNT_ID}"`,
    ...Object.entries(params).map(([k, v]) => `${k}="${encodeURIComponent(v)}"`),
    `oauth_signature="${encodeURIComponent(signature)}"`,
  ]

  return `OAuth ${oauthHeaderParts.join(', ')}`
}

async function runSuiteQL(query: string) {
  const auth = buildAuthHeader('POST', BASE_URL)
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Prefer: 'transient',
    },
    body: JSON.stringify({ q: query }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`NetSuite error ${res.status}: ${text}`)
  }

  return res.json()
}

export async function POST(request: NextRequest) {
  try {
    const { customerName } = await request.json() as { customerName: string }
    if (!customerName?.trim()) {
      return NextResponse.json({ error: 'customerName is required' }, { status: 400 })
    }

    const safeName = customerName.replace(/'/g, "''")

    // Query 1: Customer — name, status, billing address, reseller/end user
    const customerQuery = `
      SELECT
        c.id,
        c.companyname,
        c.entitystatus,
        c.isperson,
        c.email,
        c.phone,
        ba.addr1,
        ba.addr2,
        ba.city,
        ba.state,
        ba.zip,
        ba.country
      FROM customer c
      LEFT JOIN address ba ON ba.nkey = c.defaultbillingaddress
      WHERE LOWER(c.companyname) LIKE LOWER('%${safeName}%')
      ORDER BY c.companyname
      FETCH FIRST 5 ROWS ONLY
    `

    // Query 2: Subscriptions — ARR, TCV, start/end, status, auto-renewal
    const subscriptionQuery = `
      SELECT
        s.id,
        s.name,
        s.status,
        s.startdate,
        s.enddate,
        s.annualrevenue,
        s.totalcontractvalue,
        s.autorenewal,
        s.billingschedule,
        c.companyname AS customername
      FROM subscription s
      JOIN customer c ON c.id = s.customer
      WHERE LOWER(c.companyname) LIKE LOWER('%${safeName}%')
      ORDER BY s.startdate DESC
      FETCH FIRST 10 ROWS ONLY
    `

    // Query 3: Invoices — last payment status and overdue balances
    const invoiceQuery = `
      SELECT
        t.id,
        t.trandate,
        t.duedate,
        t.status,
        t.amount,
        t.amountremaining,
        t.tranid,
        c.companyname AS customername
      FROM transaction t
      JOIN customer c ON c.id = t.entity
      WHERE t.type = 'CustInvc'
        AND LOWER(c.companyname) LIKE LOWER('%${safeName}%')
      ORDER BY t.trandate DESC
      FETCH FIRST 10 ROWS ONLY
    `

    const [customerData, subscriptionData, invoiceData] = await Promise.all([
      runSuiteQL(customerQuery).catch(e => ({ error: e.message, items: [] })),
      runSuiteQL(subscriptionQuery).catch(e => ({ error: e.message, items: [] })),
      runSuiteQL(invoiceQuery).catch(e => ({ error: e.message, items: [] })),
    ])

    return NextResponse.json({
      customers: customerData?.items ?? [],
      subscriptions: subscriptionData?.items ?? [],
      invoices: invoiceData?.items ?? [],
      errors: {
        customer: (customerData as { error?: string }).error ?? null,
        subscription: (subscriptionData as { error?: string }).error ?? null,
        invoice: (invoiceData as { error?: string }).error ?? null,
      }
    })
  } catch (error) {
    console.error('NetSuite API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'NetSuite lookup failed' },
      { status: 500 }
    )
  }
}
