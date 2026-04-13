'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const MAX_FILES = 10
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

type SfOpportunity = {
  Id: string
  Name: string
  StageName: string
  CloseDate: string
  Amount: number
  'Account.Name': string
  'Owner.Name': string
}

export default function Home() {
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Salesforce search state
  const [sfSearch, setSfSearch] = useState('')
  const [sfSearching, setSfSearching] = useState(false)
  const [sfResults, setSfResults] = useState<SfOpportunity[]>([])
  const [sfSelected, setSfSelected] = useState<SfOpportunity | null>(null)
  const [sfError, setSfError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || [])
    const valid = selected.filter(f => ACCEPTED_TYPES.includes(f.type))
    const combined = [...files, ...valid].slice(0, MAX_FILES)
    setFiles(combined)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    setFiles(files.filter((_, i) => i !== index))
  }

  async function searchSalesforce() {
    if (!sfSearch.trim()) return
    setSfSearching(true)
    setSfError('')
    setSfResults([])
    setSfSelected(null)

    try {
      const response = await fetch('/api/salesforce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityName: sfSearch })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setSfResults(data.opportunities || [])
      if (data.opportunities?.length === 0) setSfError('No opportunities found.')
    } catch (err: unknown) {
      setSfError(err instanceof Error ? err.message : 'Failed to search Salesforce')
    } finally {
      setSfSearching(false)
    }
  }

  function selectOpportunity(opp: SfOpportunity) {
    setSfSelected(opp)
    setSfResults([])
    setCustomerName(opp['Account.Name'] || opp.Name)
    // Add SF data to notes
    setNotes(`--- Salesforce Opportunity Data ---
Opportunity Name: ${opp.Name}
Account: ${opp['Account.Name']}
Stage: ${opp.StageName}
Close Date: ${opp.CloseDate}
Amount: ${opp.Amount ? '$' + opp.Amount.toLocaleString() : 'Not set'}
Owner: ${opp['Owner.Name']}
Opportunity ID: ${opp.Id}
---`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setReport('')

    try {
      const { data: opp, error: oppError } = await supabase
        .from('opportunities')
        .insert({ customer_name: customerName, status: 'In Progress' })
        .select()
        .single()

      if (oppError) throw oppError

      const fileContents: { name: string; type: string; data: string }[] = []
      for (const file of files) {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
        const base64 = btoa(binary)
        fileContents.push({ name: file.name, type: file.type, data: base64 })

        await supabase.storage
          .from('documents')
          .upload(`${opp.id}/${file.name}`, file)
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, notes, files: fileContents })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      await supabase
        .from('reports')
        .insert({ opportunity_id: opp.id, report_output: data.result })

      setReport(data.result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(report)
    alert('Report copied — paste directly into Google Sheets')
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f7f7' }}>

      {/* Header */}
      <div style={{ backgroundColor: '#1a1a2e' }} className="py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white tracking-tight">Opp Prep AI</h1>
          <p style={{ color: '#00b4a2' }} className="mt-2 text-base font-medium">
            Opportunity Preparation Assistant — Sales Ops Core Renewals
          </p>
        </div>
      </div>

      {/* Description bar */}
      <div style={{ backgroundColor: '#00b4a2' }} className="px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-white text-sm leading-relaxed">
            Opp Prep AI helps you generate a complete Opportunity Preparation report. Upload the required documents: Signed Quote, Salesforce Printable View, NetSuite Subscription Page, and NetSuite Customer Dashboard, then run the analysis.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Salesforce Search */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label className="block text-sm font-semibold mb-1" style={{ color: '#1a1a2e' }}>
              Search Salesforce Opportunity
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Search by opportunity name to pull data directly from Salesforce.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={sfSearch}
                onChange={e => setSfSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchSalesforce())}
                placeholder="Type opportunity name..."
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
              />
              <button
                type="button"
                onClick={searchSalesforce}
                disabled={sfSearching}
                className="text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: '#00b4a2' }}
              >
                {sfSearching ? 'Searching...' : 'Search SF'}
              </button>
            </div>

            {/* SF Error */}
            {sfError && (
              <p className="text-red-500 text-xs mt-2">{sfError}</p>
            )}

            {/* SF Results */}
            {sfResults.length > 0 && (
              <ul className="mt-3 border border-gray-100 rounded-lg divide-y divide-gray-100">
                {sfResults.map(opp => (
                  <li
                    key={opp.Id}
                    onClick={() => selectOpportunity(opp)}
                    className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800">{opp.Name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {opp['Account.Name']} · {opp.StageName} · {opp.CloseDate}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {/* SF Selected */}
            {sfSelected && (
              <div className="mt-3 rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#e0f7f5' }}>
                <p className="font-medium" style={{ color: '#1a1a2e' }}>
                  ✓ {sfSelected.Name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  SF data loaded — {sfSelected.StageName} · Close: {sfSelected.CloseDate}
                </p>
                <button
                  type="button"
                  onClick={() => { setSfSelected(null); setSfSearch('') }}
                  className="text-xs mt-1 underline text-gray-400"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Customer name */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label className="block text-sm font-semibold mb-2" style={{ color: '#1a1a2e' }}>
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              required
              placeholder="Enter customer legal name"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          {/* File upload */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label className="block text-sm font-semibold mb-1" style={{ color: '#1a1a2e' }}>
              Upload Documents
            </label>
            <p className="text-xs text-gray-400 mb-4">
              PDF, PNG, JPG — up to {MAX_FILES} files. Recommended: Signed Quote, SF Printable View, NS Subscription Page, NS Customer Dashboard.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
              style={{ borderColor: '#00b4a2', backgroundColor: '#f0fafa' }}
            >
              <div className="text-3xl mb-2">📎</div>
              <p className="text-sm font-medium" style={{ color: '#00b4a2' }}>
                Click to upload files
              </p>
              <p className="text-xs text-gray-400 mt-1">{files.length}/{MAX_FILES} files added</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {files.length > 0 && (
              <ul className="mt-4 space-y-2">
                {files.map((file, i) => (
                  <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2 text-sm">
                    <span className="truncate text-gray-700 max-w-xs">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-gray-400 hover:text-red-500 ml-4 font-bold text-base"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Additional notes */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label className="block text-sm font-semibold mb-1" style={{ color: '#1a1a2e' }}>
              Additional Notes (optional)
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Paste any extra SF fields, NS data, or contract details not visible in the uploaded files.
            </p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={5}
              placeholder="Paste additional data here..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full text-white font-semibold py-3.5 rounded-xl transition-opacity disabled:opacity-50 text-base"
            style={{ backgroundColor: loading ? '#00b4a2' : '#1a1a2e' }}
          >
            {loading ? 'Analyzing — this may take a moment...' : 'Run Opp Prep Analysis'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* Report output */}
        {report && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold" style={{ color: '#1a1a2e' }}>Report</h2>
              <button
                onClick={copyToClipboard}
                className="text-sm text-white px-5 py-2 rounded-lg font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#00b4a2' }}
              >
                Copy for Google Sheets
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed overflow-x-auto">
              {report}
            </pre>
          </div>
        )}

      </div>
    </div>
  )
}
