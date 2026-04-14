import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'

export async function GET() {
  // Generate PKCE code verifier and challenge
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SF_CONSUMER_KEY!,
    redirect_uri: process.env.SF_CALLBACK_URL!,
    scope: 'api id email profile openid',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  })

  const authUrl = `https://login.salesforce.com/services/oauth2/authorize?${params}`

  // Store code verifier in a cookie so callback can use it
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('sf_code_verifier', codeVerifier, {
    httpOnly: true,
    maxAge: 300,
    path: '/'
  })

  return response
}
