import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    const { data, error } = await supabase
      .from('allowed_users')
      .select('email, name')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error || !data) {
      return NextResponse.json({ allowed: false }, { status: 403 })
    }

    return NextResponse.json({ allowed: true, name: data.name })
  } catch {
    return NextResponse.json({ allowed: false }, { status: 500 })
  }
}
