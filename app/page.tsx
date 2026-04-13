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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
    const valid = dropped.filter(f => ACCEPTED_TYPES.includes(f.type))
    const combined = [...files, ...valid].slice(0, MAX_FILES)
    setFiles(combined)
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
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f4' }}>

      {/* Top nav bar */}
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
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-300"></div>
          <span className="text-white text-xs">Live</span>
        </div>
      </div>

      {/* Main card */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

            {/* Avatar + title */}
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl mb-3 relative"
                style={{ backgroundColor: '#2dbda8' }}
              >
                OA
                <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></span>
              </div>
              <h1 className="text-xl font-bold text-gray-800">Opp Prep AI</h1>
              <p className="text-sm text-gray-500 mt-1 text-center max-w-sm">
                Hello! I&apos;m your Opp Prep Assistant, here to help you analyze renewal opportunities.
              </p>
            </div>

            <div className="px-6 pb-6 space-y-4">

              {/* Salesforce Search */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-0.5">Search Salesforce Opportunity</p>
                <p className="text-xs text-gray-400 mb-2">Search by opportunity name to pull data directly from Salesforce.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sfSearch}
                    onChange={e => setSfSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchSalesforce())}
                    placeholder="Type opportunity name..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                  <button
                    type="button"
                    onClick={searchSalesforce}
                    disabled={sfSearching}
                    className="text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: '#2dbda8' }}
                  >
                    {sfSearching ? '...' : 'Search SF'}
                  </button>
                </div>

                {sfError && <p className="text-red-500 text-xs mt-1">{sfError}</p>}

                {sfResults.length > 0 && (
                  <ul className="mt-2 border border-gray-100 rounded-lg divide-y divide-gray-100 shadow-sm">
                    {sfResults.map(opp => (
                      <li
                        key={opp.Id}
                        onClick={() => selectOpportunity(opp)}
                        className="px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-800">{opp.Name}</p>
                        <p className="text-xs text-gray-400">{opp['Account.Name']} · {opp.StageName} · {opp.CloseDate}</p>
                      </li>
                    ))}
                  </ul>
                )}

                {sfSelected && (
                  <div className="mt-2 rounded-lg px-3 py-2 text-sm flex items-center justify-between" style={{ backgroundColor: '#e6f7f5' }}>
                    <div>
                      <p className="font-medium text-gray-800">✓ {sfSelected.Name}</p>
                      <p className="text-xs text-gray-500">{sfSelected.StageName} · Close: {sfSelected.CloseDate}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSfSelected(null); setSfSearch(''); setCustomerName(''); setNotes('') }}
                      className="text-xs text-gray-400 underline ml-3"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>


              {/* File upload */}
              <div>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:bg-gray-50"
                  style={{ borderColor: '#d1d5db' }}
                >
                  <div className="flex justify-center mb-2">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">
                    Click to upload or drag & drop
                  </p>
                  <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG — up to {MAX_FILES} files ({files.length} added)</p>
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
                  <ul className="mt-2 space-y-1">
                    {files.map((file, i) => (
                      <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-sm">
                        <span className="truncate text-gray-600 max-w-xs">{file.name}</span>
                        <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 ml-3 font-bold">×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Notes */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Additional Notes <span className="font-normal text-gray-400">(optional)</span></p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Paste any extra SF fields, NS data, or contract details here..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-semibold py-3 rounded-xl transition-opacity disabled:opacity-50 text-sm"
                style={{ backgroundColor: '#2dbda8' }}
              >
                {loading ? 'Analyzing — this may take a moment...' : 'Run Opp Prep Analysis'}
              </button>

            </div>
          </div>
        </form>

        {/* Report output */}
        {report && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-gray-800">Report</h2>
              <button
                onClick={copyToClipboard}
                className="text-sm text-white px-4 py-1.5 rounded-lg font-medium"
                style={{ backgroundColor: '#2dbda8' }}
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
