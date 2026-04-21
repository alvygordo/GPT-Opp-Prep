import { NextRequest, NextResponse } from 'next/server'

const MCP_URL = 'https://mcp.csaiautomations.com/netsuite/mcp/'
const MCP_TOKEN = process.env.NS_MCP_TOKEN!

async function mcpInit(): Promise<string> {
  const res = await fetch(`${MCP_URL}?token=${MCP_TOKEN}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'opp-prep', version: '1.0' } }
    }),
  })
  const sessionId = res.headers.get('mcp-session-id')
  if (!sessionId) throw new Error('Failed to get MCP session ID')
  return sessionId
}

async function mcpCall(sessionId: string, id: number, toolName: string, args: Record<string, unknown>) {
  const res = await fetch(`${MCP_URL}?token=${MCP_TOKEN}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-session-id': sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id,
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    }),
  })

  const text = await res.text()
  // SSE format: "data: {...}"
  const match = text.match(/data: (\{[\s\S]*\})/)
  if (!match) throw new Error(`No data in MCP response for ${toolName}`)
  const parsed = JSON.parse(match[1])
  if (parsed.error) throw new Error(`MCP error (${toolName}): ${parsed.error.message}`)

  // MCP response has 4 levels of nesting. Use structuredContent as shortcut:
  // result.structuredContent.content[0].text → JSON string → .response.data → JSON string → actual data
  const layer3text = parsed.result?.structuredContent?.content?.[0]?.text
  if (!layer3text) return null

  let layer3: Record<string, unknown>
  try { layer3 = JSON.parse(layer3text) } catch { return layer3text }

  const responseData = (layer3.response as Record<string, unknown>)?.data
  if (responseData !== undefined && responseData !== null) {
    if (typeof responseData === 'string') {
      try { return JSON.parse(responseData) } catch { return responseData }
    }
    return responseData  // already a parsed object
  }

  return layer3
}

export async function POST(request: NextRequest) {
  try {
    const { customerName } = await request.json() as { customerName: string }
    if (!customerName?.trim()) {
      return NextResponse.json({ error: 'customerName is required' }, { status: 400 })
    }

    const sessionId = await mcpInit()

    // Step 1: get invoices by customer name — also gives us customer_id
    const invoicesData = await mcpCall(sessionId, 2, 'get_customer_invoices', {
      customer_name: customerName.trim()
    }).catch(e => ({ error: e.message }))

    // Extract customer_id from invoices result if available
    let customerId = invoicesData?.customer_id
      ?? invoicesData?.invoices?.[0]?.customer_id
      ?? invoicesData?.[0]?.customer_id
      ?? null

    // Step 2: fetch details + overdue + subscriptions in parallel (by customer_id if found)
    let customerData = null
    let overdueData = null
    let subscriptionData = null

    if (customerId) {
      ;[customerData, overdueData, subscriptionData] = await Promise.all([
        mcpCall(sessionId, 3, 'get_customer_details', { customer_id: String(customerId) })
          .catch(e => ({ error: e.message })),
        mcpCall(sessionId, 4, 'get_customer_overdue_balance', { customer_id: String(customerId) })
          .catch(e => ({ error: e.message })),
        mcpCall(sessionId, 5, 'get_customer_subscriptions', { customer_id: String(customerId) })
          .catch(() => null),
      ])
    } else {
      // Fallback: try subscription lookup by customer name directly
      subscriptionData = await mcpCall(sessionId, 5, 'get_customer_subscriptions', {
        customer_name: customerName.trim()
      }).catch(() => null)

      // If subscriptions found, extract customer_id and fetch details
      const subList2 = Array.isArray(subscriptionData) ? subscriptionData : subscriptionData?.subscriptions ?? subscriptionData?.data ?? []
      const firstSub = subList2[0] ?? subscriptionData
      const idFromSub = firstSub?.customer_id ?? firstSub?.customerId ?? firstSub?.customer?.id ?? null
      if (idFromSub) {
        customerId = String(idFromSub)
        ;[customerData, overdueData] = await Promise.all([
          mcpCall(sessionId, 6, 'get_customer_details', { customer_id: customerId })
            .catch(e => ({ error: e.message })),
          mcpCall(sessionId, 7, 'get_customer_overdue_balance', { customer_id: customerId })
            .catch(e => ({ error: e.message })),
        ])
      }
    }

    // Normalise subscription list and extract key fields
    const subList = Array.isArray(subscriptionData)
      ? subscriptionData
      : subscriptionData?.subscriptions ?? subscriptionData?.data ?? []
    const latestSub: Record<string, unknown> = subList[0] ?? (subscriptionData && !Array.isArray(subscriptionData) ? subscriptionData : null) ?? {}

    const subscriptionStatus = (latestSub?.status ?? latestSub?.subscriptionStatus ?? latestSub?.Status ?? null) as string | null
    const subscriptionPlan   = (latestSub?.subscriptionPlan ?? latestSub?.subscription_plan ?? latestSub?.planName ?? latestSub?.plan ?? null) as string | null
    const subsidiary         = (latestSub?.subsidiary ?? latestSub?.subsidiaryName ?? null) as string | null
    const startDate          = (latestSub?.startDate ?? latestSub?.start_date ?? null) as string | null
    const endDate            = (latestSub?.endDate ?? latestSub?.end_date ?? null) as string | null
    const arr                = (latestSub?.arr ?? latestSub?.ARR ?? latestSub?.annualRecurringRevenue ?? null) as string | number | null
    const reseller           = (latestSub?.reseller ?? latestSub?.resellerName ?? latestSub?.distributor ?? null) as string | null
    const endUser            = (latestSub?.endUser ?? latestSub?.end_user ?? latestSub?.endUserName ?? null) as string | null
    const autoRenewal        = (latestSub?.autoRenewal ?? latestSub?.auto_renewal ?? latestSub?.isAutoRenewal ?? null) as boolean | string | null

    return NextResponse.json({
      customer: customerData,
      invoices: invoicesData,
      overdue: overdueData,
      customer_id: customerId,
      subscriptions: subscriptionData,
      subscription_status: subscriptionStatus,
      subscription_plan: subscriptionPlan,
      subsidiary,
      start_date: startDate,
      end_date: endDate,
      arr,
      reseller,
      end_user: endUser,
      auto_renewal: autoRenewal,
    })

  } catch (error) {
    console.error('NetSuite MCP error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'NetSuite lookup failed' },
      { status: 500 }
    )
  }
}
