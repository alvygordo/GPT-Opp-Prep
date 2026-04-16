'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ReportRow = {
  id: string
  created_at: string
  report_output: string
  opportunities: {
    customer_name: string
  } | null
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('reports')
        .select('id, created_at, report_output, opportunities(customer_name)')
        .order('created_at', { ascending: false })
        .limit(50)

      setReports((data as unknown as ReportRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f4' }}>

      {/* Nav */}
      <div style={{ backgroundColor: '#2dbda8' }} className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-white/20 flex items-center justify-center">
            <span className="text-white text-xs font-bold">OA</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Opportunity Preparation Assistant</p>
            <p className="text-white/80 text-xs leading-tight">Sales Ops - Core Renewals</p>
          </div>
        </div>
        <a href="/" className="text-white/80 text-xs underline">← New Analysis</a>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-base font-bold text-gray-800 mb-4">Recent Reports</h1>

        {loading && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">
            Loading...
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">
            No reports yet. Run your first analysis to get started.
          </div>
        )}

        {!loading && reports.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {reports.map((r, i) => {
              const date = new Date(r.created_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })
              const customer = r.opportunities?.customer_name ?? 'Unknown Customer'
              const preview = r.report_output?.slice(0, 120).replace(/\n/g, ' ') + '...'

              return (
                <a
                  key={r.id}
                  href={`/report/${r.id}`}
                  className={`block px-5 py-4 hover:bg-gray-50 transition-colors ${i > 0 ? 'border-t border-gray-100' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{customer}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{date}</p>
                      <p className="text-xs text-gray-500 mt-1 truncate">{preview}</p>
                    </div>
                    <span className="text-xs text-teal-600 font-medium shrink-0 mt-0.5">View →</span>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
