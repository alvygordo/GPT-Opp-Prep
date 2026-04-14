import { NextResponse } from 'next/server'

export async function GET() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SF_CONSUMER_KEY!,
    redirect_uri: process.env.SF_CALLBACK_URL!,
    scope: 'api id email profile openid'
  })

  const authUrl = `https://login.salesforce.com/services/oauth2/authorize?${params}`
  return NextResponse.redirect(authUrl)
}
