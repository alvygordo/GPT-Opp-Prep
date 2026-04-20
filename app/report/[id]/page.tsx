'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Report = {
  id: string
  created_at: string
  report_output: string
  opportunity_id: string
  opportunities?: {
    customer_name: string
  }
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  function copySection(sectionText: string, label: string) {
    navigator.clipboard.writeText(sectionText.trim())
    setCopiedSection(label)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  function parseSections(text: string): { label: string; content: string }[] {
    const sectionPattern = /^(SECTION \d+[^\n]*)/gm
    const matches = [...text.matchAll(sectionPattern)]
    if (matches.length === 0) return [{ label: 'Full Report', content: text }]
    return matches.map((match, i) => {
      const start = match.index!
      const end = matches[i + 1]?.index ?? text.length
      return { label: match[1].trim(), content: text.slice(start, end) }
    })
  }

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('reports')
        .select('*, opportunities(customer_name)')
        .eq('id', id)
        .single()

      if (error || !data) {
        setError('Report not found.')
      } else {
        setReport(data as Report)
      }
      setLoading(false)
    }
    load()
  }, [id])

  function copyReport() {
    if (!report) return
    navigator.clipboard.writeText(report.report_output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const customerName = report?.opportunities?.customer_name ?? 'Unknown Customer'
  const date = report ? new Date(report.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : ''

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

      <div className="max-w-3xl mx-auto px-4 py-8">
        {loading && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">
            Loading report...
          </div>
        )}

        {error && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-red-500 text-sm">
            {error}
          </div>
        )}

        {report && (
          <>
            {/* Header card */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-4 flex items-start justify-between">
              <div>
                <h1 className="text-base font-bold text-gray-800">{customerName}</h1>
                <p className="text-xs text-gray-400 mt-0.5">Generated {date}</p>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">Report ID: {id}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyReport}
                  className="text-sm text-white px-4 py-2 rounded-lg font-medium"
                  style={{ backgroundColor: '#2dbda8' }}
                >
                  {copied ? 'Copied!' : 'Copy for Sheets'}
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                    alert('Link copied!')
                  }}
                  className="text-sm text-gray-600 px-4 py-2 rounded-lg font-medium border border-gray-200"
                >
                  Copy Link
                </button>
              </div>
            </div>

            {/* Report body — per-section copy buttons */}
            {parseSections(report.report_output).map((section, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-6 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-sm font-bold text-gray-700">{section.label}</h2>
                  <button
                    onClick={() => copySection(section.content, section.label)}
                    className="text-xs text-white px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
                    style={{ backgroundColor: copiedSection === section.label ? '#16a34a' : '#2dbda8' }}
                  >
                    {copiedSection === section.label ? 'Copied!' : 'Copy Section'}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed overflow-x-auto">
                  {section.content}
                </pre>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
