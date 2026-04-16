'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const searchParams = useSearchParams()
  const oauthError = searchParams.get('error')

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
        <div className="bg-white rounded-2xl shadow-sm w-full max-w-sm p-10">

          <div className="flex flex-col items-center mb-8">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl mb-4 relative"
              style={{ backgroundColor: '#2dbda8' }}
            >
              OA
              <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white"></span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Opp Prep AI</h1>
            <p className="text-sm text-gray-500 mt-1 text-center">
              Sign in with your Salesforce account
            </p>
          </div>

          {oauthError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4">
              Salesforce login failed. Please try again.
            </div>
          )}

          <a
            href="/api/auth/salesforce"
            className="w-full flex items-center justify-center text-white font-semibold py-4 rounded-2xl text-base"
            style={{ backgroundColor: '#2dbda8' }}
          >
            Click to Login
          </a>

        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
