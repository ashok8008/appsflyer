'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'

export default function SyncView() {
  const [imports, setImports] = useState([])
  const [syncing, setSyncing] = useState(false)

  const load = () => api('/appsflyer/imports').then(setImports).catch(() => {})
  useEffect(() => { load() }, [])

  const sync = async (days) => {
    setSyncing(true)
    try {
      const data = await api('/appsflyer/sync', { method: 'POST', body: { days } })
      const ok = data.results.filter(r => !r.error)
      const fail = data.results.filter(r => r.error)
      if (fail.length > 0) toast.error(`Sync had ${fail.length} failure(s): ${fail.map(f => f.report + ' - ' + f.error).join('; ')}`)
      else toast.success(`Imported ${ok.reduce((s, r) => s + (r.rows_imported || 0), 0)} rows`)
      load()
    } catch (e) { toast.error(e.message) }
    setSyncing(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">AppsFlyer Sync</h1>
        <p className="text-slate-500">Pull raw installs &amp; in-app events. Click ID matches your tracking clicks.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Manual sync</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <Button onClick={() => sync(1)} disabled={syncing} className="bg-blue-600 hover:bg-blue-700"><RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />Sync Last 24h</Button>
            <Button onClick={() => sync(7)} disabled={syncing} variant="outline"><RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />Sync Last 7 Days</Button>
            <Button onClick={() => sync(30)} disabled={syncing} variant="outline"><RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />Sync Last 30 Days</Button>
          </div>
          <p className="text-xs text-slate-500">Pulls installs_report/v5 and in_app_events_report/v5 from AppsFlyer using your backend API token.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Import history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr><th className="text-left p-3">Report</th><th className="text-left">Range</th><th className="text-left">Status</th><th className="text-right">Rows</th><th className="text-left p-3">Error</th><th className="text-left">When</th></tr>
            </thead>
            <tbody>
              {imports.map(i => (
                <tr key={i.id} className="border-b">
                  <td className="p-3 font-medium">{i.report_type}</td>
                  <td>{i.from_date} → {i.to_date}</td>
                  <td><Badge className={i.status === 'success' ? 'bg-green-100 text-green-700 hover:bg-green-100' : i.status === 'failed' ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>{i.status}</Badge></td>
                  <td className="text-right">{i.rows_imported || 0}</td>
                  <td className="p-3 text-xs text-red-600 max-w-xs truncate">{i.error_message || ''}</td>
                  <td className="text-xs text-slate-500">{new Date(i.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {imports.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No sync history</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
