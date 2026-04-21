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

type NsInvoice = {
  invoice_id?: string
  tranid?: string
  date?: string
  due_date?: string
  status?: string
  amount?: number | string
  amount_remaining?: number | string
  [key: string]: unknown
}

type NsData = {
  customer: Record<string, unknown> | null
  invoices: {
    status: string
    total: number
    latest_invoice: NsInvoice | null
    invoices: NsInvoice[]
  } | null
  overdue: Record<string, unknown> | null
  customer_id: string | null
  subscriptions?: unknown
  subscription_status?: string | null
  subscription_plan?: string | null
  subsidiary?: string | null
  start_date?: string | null
  end_date?: string | null
  arr?: string | number | null
  reseller?: string | null
  end_user?: string | null
  auto_renewal?: boolean | string | null
  error?: string
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: 'green' | 'red' }) {
  const color = highlight === 'green' ? 'text-green-700 font-semibold' : highlight === 'red' ? 'text-red-600 font-semibold' : 'text-gray-700'
  return (
    <div className="flex gap-1">
      <span className="text-gray-500 shrink-0">{label}:</span>
      <span className={color}>{value}</span>
    </div>
  )
}

function NsCard({ nsData, nsSearch, onClear }: { nsData: NsData; nsSearch: string; onClear: () => void }) {
  const latestInv = nsData.invoices?.latest_invoice
  const invStatus = latestInv ? String(latestInv.status ?? (latestInv as Record<string, unknown>).paymentstatus ?? '') : null
  const overdueObj = nsData.overdue as Record<string, unknown> | null
  const overdueAmt = overdueObj
    ? parseFloat(String(overdueObj.overdue_balance ?? overdueObj.overdueBalance ?? overdueObj.balance ?? overdueObj.amount ?? '0'))
    : 0
  const hasOverdue = overdueAmt > 0
  const c = nsData.customer as Record<string, string> | null ?? {}
  const custName = String(c.companyName ?? c.entityid ?? c.name ?? nsSearch ?? '')
  const statusVal = nsData.subscription_status || String(c.status ?? c.entityStatus ?? 'Not Found')

  return (
    <div className="mt-2 rounded-lg px-3 py-3 text-xs space-y-1.5" style={{ backgroundColor: '#eef2ff' }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-gray-800">✓ NetSuite data loaded</p>
        <button type="button" onClick={onClear} className="text-xs text-gray-400 underline">Clear</button>
      </div>

      {custName && <Row label="Customer" value={custName} />}
      {nsData.reseller && <Row label="Reseller" value={nsData.reseller} />}
      {nsData.end_user && <Row label="End User" value={nsData.end_user} />}
      {nsData.subscription_plan && <Row label="Subscription Plan" value={nsData.subscription_plan} />}
      {nsData.subsidiary && <Row label="Subsidiary" value={nsData.subsidiary} />}

      <Row
        label="Status"
        value={statusVal}
        highlight={statusVal.toLowerCase() === 'active' ? 'green' : 'red'}
      />

      {nsData.arr != null && <Row label="ARR" value={`$${nsData.arr}`} />}
      {nsData.start_date && <Row label="Start Date" value={nsData.start_date} />}
      {nsData.end_date && <Row label="End Date" value={nsData.end_date} />}
      {nsData.auto_renewal != null && <Row label="Auto Renewal" value={String(nsData.auto_renewal)} />}

      <div className="border-t border-indigo-100 pt-1.5 mt-1">
        <Row
          label="Last Invoice"
          value={invStatus || (nsData.invoices?.total === 0 ? 'No invoices found' : 'Not Found')}
          highlight={invStatus?.toLowerCase().includes('paid') ? 'green' : invStatus ? 'red' : undefined}
        />
        <Row
          label="Collection Flag"
          value={hasOverdue ? `YES — $${overdueAmt.toLocaleString()}` : 'No'}
          highlight={hasOverdue ? 'red' : 'green'}
        />
      </div>

      <p className="text-gray-400 pt-1">NS data added to notes for AI analysis</p>
    </div>
  )
}

export default function Home() {
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState('')
  const [reportId, setReportId] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [sfSearch, setSfSearch] = useState('')
  const [sfSearching, setSfSearching] = useState(false)
  const [sfResults, setSfResults] = useState<SfOpportunity[]>([])
  const [sfSelected, setSfSelected] = useState<SfOpportunity | null>(null)
  const [sfError, setSfError] = useState('')

  const [nsSearch, setNsSearch] = useState('')
  const [nsSearching, setNsSearching] = useState(false)
  const [nsData, setNsData] = useState<NsData | null>(null)
  const [nsError, setNsError] = useState('')

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

  async function searchNetsuite(name?: string) {
    const query = name || nsSearch || customerName
    if (!query.trim()) return
    setNsSearching(true)
    setNsError('')
    setNsData(null)


    try {
      const res = await fetch('/api/netsuite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: query }),
      })
      const data: NsData = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'NetSuite lookup failed')
      setNsData(data)
      if (!data.invoices && !data.customer) {
        setNsError('No matching records found in NetSuite.')
      } else {
        appendNsNotes(data)
      }
    } catch (err) {
      setNsError(err instanceof Error ? err.message : 'NetSuite lookup failed')
    } finally {
      setNsSearching(false)
    }
  }

  function appendNsNotes(data: NsData) {
    const c = data.customer ?? {}
    const inv = data.invoices
    const overdue = data.overdue

    // Extract latest invoice details — try multiple field name patterns
    const latestInv = inv?.latest_invoice
    const invoiceStatus = latestInv
      ? (latestInv.status ?? latestInv.paymentstatus ?? latestInv.payment_status ?? 'Unknown')
      : 'Not Found'
    const invoiceAmount = latestInv ? (latestInv.amount ?? latestInv.total ?? '') : ''
    const invoiceId = latestInv ? (latestInv.tranid ?? latestInv.invoice_id ?? latestInv.id ?? '') : ''
    const invoiceDate = latestInv ? (latestInv.date ?? latestInv.trandate ?? '') : ''

    // Subscription status — try multiple field name patterns
    const subStatus = (c.subscriptionStatus ?? c.subscription_status ?? c.status ?? c.entityStatus ?? c.custrecord_status ?? '') as string

    const nsSubscriptionStatus = data.subscription_status || subStatus || 'Not Found'

    // Parse overdue balance value — check actual number, not just object existence
    const overdueRaw = overdue as Record<string, unknown> | null
    const overdueValue = overdueRaw
      ? parseFloat(String(overdueRaw.overdue_balance ?? overdueRaw.overdueBalance ?? overdueRaw.balance ?? overdueRaw.amount ?? '0'))
      : 0
    const overdueDisplay = overdueValue > 0 ? `$${overdueValue.toLocaleString()}` : '0'

    const nsBlock = `
--- NetSuite Data ---
NS Customer Name: ${((c.companyName ?? c.entityid ?? c.name ?? nsSearch) || 'Not Found') as string}
NS Customer Status: ${(c.status ?? c.entityStatus ?? 'Not Found') as string}
NS Subscription Status: ${nsSubscriptionStatus}
NS Subscription Plan: ${data.subscription_plan ?? 'Not Found'}
NS Subsidiary: ${data.subsidiary ?? 'Not Found'}
NS ARR: ${data.arr != null ? `$${data.arr}` : 'Not Found'}
NS Start Date: ${data.start_date ?? 'Not Found'}
NS End Date: ${data.end_date ?? 'Not Found'}
NS Reseller: ${data.reseller ?? 'None'}
NS End User: ${data.end_user ?? 'Not Found'}
NS Billing Address: ${(c.billingAddress ?? c.defaultaddress ?? c.address ?? 'Not Found') as string}
NS Last Invoice ID: ${invoiceId || 'Not Found'}
NS Last Invoice Date: ${invoiceDate || 'Not Found'}
NS Last Invoice Amount: ${invoiceAmount ? `$${invoiceAmount}` : 'Not Found'}
NS Total Invoices Found: ${inv?.total ?? 0}
NS Overdue Balance: ${overdueDisplay}
---`

    setNotes(prev => {
      const cleaned = prev.replace(/\n?--- NetSuite Data ---[\s\S]*?---\n?/g, '').trim()
      return cleaned ? `${cleaned}\n${nsBlock}` : nsBlock
    })
  }

  function selectOpportunity(opp: SfOpportunity) {
    setSfSelected(opp)
    setSfResults([])
    const accountName = opp['Account.Name'] || opp.Name
    setCustomerName(accountName)
    const parentOppName = (opp as any)['Parent_Opportunity__r.Name'] || (opp as any)['Parent_Opportunity__r']?.Name || ''
    const parentOppId = (opp as any)['Parent_Opportunity__c'] || ''
    const parentOppDisplay = parentOppName || parentOppId
      ? `${parentOppName || ''}${parentOppId ? ' (' + parentOppId + ')' : ''}`.trim()
      : 'None'

    const r = opp as any
    setNotes(`--- Salesforce Opportunity Data ---
Opportunity Name: ${opp.Name}
Account: ${opp['Account.Name']}
Stage: ${opp.StageName}
Renewal Date: ${opp.CloseDate ?? 'Not set'}
Owner: ${opp['Owner.Name']}
Opportunity ID: ${opp.Id}
Current Term: ${r.Current_Term__c ?? 'Not set'}
Current ARR: ${r.ARR__c ?? (opp.Amount ? '$' + opp.Amount.toLocaleString() : 'Not set')}
Current TCV: ${r.TCV__c ?? 'Not set'}
Parent Opportunity: ${parentOppDisplay}
Auto-Renewed Last Term: ${r.Auto_Renewed_Last_Term__c ?? 'Not set'}
Contract on ESW 2019+ Terms?: ${r.Contract_on_ESW_2019_Terms__c ?? 'Not set'}
Has Auto-Renewal Clause: ${r.Has_Auto_Renewal_Clause__c ?? 'Not set'}
Contract has Toxic Clauses?: ${r.Contract_has_Toxic_Clauses__c ?? 'Not set'}
Customer Termination Notice Period: ${r.Customer_Termination_Notice_Period__c ?? 'Not set'}
Customer Termination Deadline: ${r.Customer_Termination_Deadline__c ?? 'Not set'}
NNR Required?: ${r.NNR_Required__c ?? 'Not set'}
---`)
    // Auto-search NetSuite with the account name
    searchNetsuite(accountName)
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

      const currentDate = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      const sfUserName = document.cookie.split('; ').find(r => r.startsWith('opp_prep_user_name='))?.split('=')[1]
        ? decodeURIComponent(document.cookie.split('; ').find(r => r.startsWith('opp_prep_user_name='))!.split('=')[1])
        : 'Sales Ops'

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, notes, files: fileContents, currentDate, sfUserName })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      const { data: savedReport } = await supabase
        .from('reports')
        .insert({ opportunity_id: opp.id, report_output: data.result })
        .select('id')
        .single()

      setReport(data.result)
      if (savedReport?.id) setReportId(savedReport.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  function copyToClipboard() {
    navigator.clipboard.writeText(report)
    alert('Report copied — paste directly into Google Sheets')
  }

  function copySection(sectionText: string, label: string) {
    navigator.clipboard.writeText(sectionText.trim())
    setCopiedSection(label)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  function downloadSectionPDF(sectionText: string, title: string) {
    // Convert tab-separated table rows to HTML table
    const lines = sectionText.trim().split('\n')
    let html = ''
    let inTable = false

    for (const line of lines) {
      if (line.includes('\t')) {
        const cells = line.split('\t')
        const isHeader = cells[0].trim().toLowerCase() === 'ref' || cells[0].trim() === '#'
        if (!inTable) { html += '<table>'; inTable = true }
        const tag = isHeader ? 'th' : 'td'
        html += `<tr>${cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`
      } else {
        if (inTable) { html += '</table>'; inTable = false }
        if (line.trim()) html += `<p>${line.trim()}</p>`
      }
    }
    if (inTable) html += '</table>'

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #222; }
  h1 { font-size: 14px; margin-bottom: 16px; color: #2dbda8; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f0f4f4; font-weight: bold; }
  tr:nth-child(even) td { background: #fafafa; }
  p { margin: 4px 0; }
  @media print { body { margin: 10mm; } }
</style></head><body>
<h1>${title}</h1>
${html}
<script>window.onload = function(){ window.print(); }<\/script>
</body></html>`)
    win.document.close()
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-300"></div>
            <span className="text-white text-xs">Live</span>
          </div>
          <a href="/reports" className="text-white/80 text-xs underline">Recent Reports</a>
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
                      onClick={() => { setSfSelected(null); setSfSearch(''); setCustomerName(''); setNotes(''); setNsData(null); setNsError(''); setNsSearch('') }}
                      className="text-xs text-gray-400 underline ml-3"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* NetSuite Panel */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-0.5">NetSuite Lookup</p>
                <p className="text-xs text-gray-400 mb-2">NS customer name may differ from Salesforce — enter the exact NS name below.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nsSearch}
                    onChange={e => setNsSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchNetsuite())}
                    placeholder="Type NetSuite customer name..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => searchNetsuite()}
                    disabled={nsSearching || (!nsSearch.trim() && !customerName.trim())}
                    className="text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                    style={{ backgroundColor: '#6366f1' }}
                  >
                    {nsSearching ? '...' : 'Search NS'}
                  </button>
                </div>
                <div>

                {nsError && <p className="text-red-500 text-xs mt-1">{nsError}</p>}
                </div>

                {/* NS summary card */}
                {nsData && !!(nsData.customer || nsData.invoices || nsData.subscription_status || nsData.subscriptions) && (
                  <NsCard nsData={nsData} nsSearch={nsSearch} onClear={() => { setNsData(null); setNsError(''); setNsSearch('') }} />
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
          <div className="mt-6 space-y-3">

            {/* Link bar */}
            <div className="bg-white rounded-2xl shadow-sm px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">Shareable report link</p>
                <p className="text-xs font-mono text-gray-700 truncate">
                  {typeof window !== 'undefined' ? `${window.location.origin}/report/${reportId}` : `/report/${reportId}`}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/report/${reportId}`
                    navigator.clipboard.writeText(url)
                    alert('Link copied!')
                  }}
                  className="text-sm text-gray-600 px-3 py-1.5 rounded-lg font-medium border border-gray-200 whitespace-nowrap"
                >
                  Copy Link
                </button>
                <a
                  href={`/report/${reportId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-white px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
                  style={{ backgroundColor: '#2dbda8' }}
                >
                  Open
                </a>
              </div>
            </div>

            {/* Report body — Section 1 gets PDF, Sections 2 & 3 get Copy to Sheet */}
            {parseSections(report).map((section, i) => {
              const isSection1 = section.label.startsWith('SECTION 1')
              return (
                <div key={i} className="bg-white rounded-2xl shadow-sm p-6">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-sm font-bold text-gray-700">{section.label}</h2>
                    {isSection1 ? (
                      <button
                        onClick={() => downloadSectionPDF(section.content, `${customerName} — Contract Summary`)}
                        className="text-xs text-white px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
                        style={{ backgroundColor: '#6366f1' }}
                      >
                        Download PDF
                      </button>
                    ) : (
                      <button
                        onClick={() => copySection(section.content, section.label)}
                        className="text-xs text-white px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
                        style={{ backgroundColor: copiedSection === section.label ? '#16a34a' : '#2dbda8' }}
                      >
                        {copiedSection === section.label ? 'Copied!' : 'Copy to Sheet'}
                      </button>
                    )}
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed overflow-x-auto">
                    {section.content}
                  </pre>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
