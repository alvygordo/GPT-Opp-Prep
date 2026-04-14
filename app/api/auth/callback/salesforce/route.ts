import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url))
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.SF_CONSUMER_KEY!,
        client_secret: process.env.SF_CONSUMER_SECRET!,
        redirect_uri: process.env.SF_CALLBACK_URL!
      })
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('SF token error:', tokenData)
      return NextResponse.redirect(new URL('/login?error=token_failed', request.url))
    }

    // Get user info from Salesforce
    const userRes = await fetch(tokenData.id, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })
    const userData = await userRes.json()

    const email = userData.email?.toLowerCase().trim()

    if (!email) {
      return NextResponse.redirect(new URL('/login?error=no_email', request.url))
    }

    // Set session cookie and redirect to app
    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.set('opp_prep_user', email, {
      path: '/',
      maxAge: 86400,
      httpOnly: false
    })

    return response
  } catch (err) {
    console.error('SF OAuth error:', err)
    return NextResponse.redirect(new URL('/login?error=oauth_failed', request.url))
  }
}
