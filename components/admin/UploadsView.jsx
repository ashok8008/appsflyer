'use client'

import { useEffect, useState } from 'react'
import { api, getToken } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react'

export default function UploadsView() {
  const [history, setHistory] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [file, setFile] = useState(null)
  const [uploadType, setUploadType] = useState('promo_csv')
  const [campaignId, setCampaignId] = useState('')
  const [defaultDate, setDefaultDate] = useState(new Date().toISOString().slice(0, 10))
  const [reviewBeforeImport, setReviewBeforeImport] = useState(false)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    api('/uploads').then(setHistory).catch(() => {})
    api('/campaigns').then(setCampaigns).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const doPreview = async () => {
    if (!file) return toast.error('Pick a file first')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = getToken()
      const res = await fetch('/api/uploads/preview', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setPreview(data)
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  const doImport = async () => {
    if (!file) return toast.error('Pick a file first')
    if (!campaignId) return toast.error('Pick an offer/campaign')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('upload_type', uploadType)
      fd.append('campaign_id', campaignId)
      fd.append('default_date', defaultDate)
      const token = getToken()
      const res = await fetch('/api/uploads/import', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      if (data.rows_failed > 0) toast.warning(`Imported ${data.rows_imported} rows, ${data.rows_failed} unmatched. Review history.`)
      else toast.success(`Imported ${data.rows_imported} rows successfully`)
      setPreview(null); setFile(null)
      load()
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  const handleSubmit = async () => {
    if (reviewBeforeImport) await doPreview()
    else {
      await doPreview() // detect ambiguity first
    }
  }

  // Check if any sheet has ambiguous/missing required field
  const needsReview = preview ? preview.sheets.some(s => {
    if (s.is_total_sheet) return false
    if (s.ambiguous && s.ambiguous.length > 0) return true
    // Need publisher_code if not multi-sheet xlsx
    if (preview.file_type !== 'xlsx' && !s.detected_mapping.publisher_code) return true
    return false
  }) : false

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Uploads</h1>
        <p className="text-slate-500">Import Polymarket promo CSV or daily revenue XLSX. Maps publishers automatically.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="w-4 h-4" /> New upload</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Upload type</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="promo_csv">Polymarket Promo CSV</SelectItem>
                  <SelectItem value="daily_revenue_xlsx">Daily Revenue XLSX</SelectItem>
                  <SelectItem value="combined_upload">Combined report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Offer / Campaign</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.campaign_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default report date</Label>
              <Input type="date" value={defaultDate} onChange={e => setDefaultDate(e.target.value)} />
            </div>
            <div>
              <Label>File (.csv / .xlsx)</Label>
              <Input type="file" accept=".csv,.xlsx,.xls" onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null) }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input id="rbi" type="checkbox" checked={reviewBeforeImport} onChange={e => setReviewBeforeImport(e.target.checked)} className="rounded" />
            <Label htmlFor="rbi" className="text-sm text-slate-600 cursor-pointer">Review mapping before import</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={doPreview} disabled={busy || !file} variant="outline">Preview</Button>
            <Button onClick={doImport} disabled={busy || !file || !campaignId || (preview && needsReview)} className="bg-blue-600 hover:bg-blue-700">{busy ? 'Working…' : 'Import'}</Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-4 h-4" /> Preview — {preview.file_name}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {preview.sheets.map(s => (
              <div key={s.name} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{s.name} <span className="text-xs text-slate-500">({s.row_count} rows)</span></div>
                  {s.is_total_sheet && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">TOTAL sheet — will be skipped</Badge>}
                  {!s.is_total_sheet && s.ambiguous?.length > 0 && <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><AlertCircle className="w-3 h-3 mr-1" />Ambiguous mapping</Badge>}
                  {!s.is_total_sheet && (!s.ambiguous || s.ambiguous.length === 0) && <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1" />Auto-detected</Badge>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                  {Object.entries(s.detected_mapping).map(([k, v]) => (
                    <div key={k} className="bg-slate-50 rounded px-2 py-1"><span className="text-slate-500">{k}:</span> <span className="font-mono">{v}</span></div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead className="text-slate-500"><tr>{s.headers.map(h => <th key={h} className="text-left p-1 border-b">{h}</th>)}</tr></thead>
                    <tbody>
                      {s.sample.map((row, i) => (<tr key={i}>{s.headers.map(h => <td key={h} className="p-1 border-b">{row[h] ?? ''}</td>)}</tr>))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {needsReview && <div className="text-sm text-amber-700 bg-amber-50 rounded p-2">⚠️ Some fields need manual mapping. Manual override UI coming in next iteration; for now, rename headers in your file or contact admin.</div>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Upload history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr><th className="text-left p-3">File</th><th className="text-left">Type</th><th className="text-left">Status</th><th className="text-right">Imported</th><th className="text-right">Failed</th><th className="text-left">Uploaded by</th><th className="text-left p-3">When</th></tr>
            </thead>
            <tbody>
              {history.map(u => (
                <tr key={u.id} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-medium">{u.file_name}</td>
                  <td>{u.upload_type}</td>
                  <td><Badge className={u.status === 'completed' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>{u.status}</Badge></td>
                  <td className="text-right text-green-600 font-medium">{u.rows_imported}</td>
                  <td className="text-right text-red-600">{u.rows_failed}</td>
                  <td className="text-xs text-slate-500">{u.uploaded_by_email}</td>
                  <td className="p-3 text-xs text-slate-500">{new Date(u.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">No uploads yet</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
