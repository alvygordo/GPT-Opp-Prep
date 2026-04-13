'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toLowerCase().trim() })
    })

    const data = await response.json()

    if (!response.ok || !data.allowed) {
      setError('Access denied. Your email is not on the approved list.')
      setLoading(false)
    } else {
      // Set cookie for session
      document.cookie = `opp_prep_user=${encodeURIComponent(email.toLowerCase().trim())}; path=/; max-age=86400`
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f0f4f4' }}>

      {/* Top nav bar */}
      <div style={{ backgroundColor: '#2dbda8' }} className="px-6 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-white/20 flex items-center justify-center">
          <span className="text-white text-xs font-bold">OA</span>
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">Opportunity Preparation Assistant</p>
          <p className="text-white/80 text-xs leading-tight">Sales Ops - Core Renewals</p>
        </div>
      </div>

      {/* Login card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm w-full max-w-sm p-8">

          <div className="flex flex-col items-center mb-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl mb-3 relative"
              style={{ backgroundColor: '#2dbda8' }}
            >
              OA
              <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></span>
            </div>
            <h1 className="text-xl font-bold text-gray-800">Opp Prep AI</h1>
            <p className="text-sm text-gray-500 mt-1 text-center">
              Enter your Trilogy email to access the app
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your.email@trilogy.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold py-3 rounded-xl disabled:opacity-50 text-sm"
              style={{ backgroundColor: '#2dbda8' }}
            >
              {loading ? 'Checking...' : 'Access App'}
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}
