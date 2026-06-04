'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { RefreshCw, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'

function fmtDuration(ms) {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}
function fmtWhen(d) { return d ? new Date(d).toLocaleString() : 'never' }

export default function SyncView() {
  const [imports, setImports] = useState([])
  const [scheduler, setScheduler] = useState(null)
  const [syncing, setSyncing] = useState(false)

  const load = () => {
    api('/appsflyer/imports').then(setImports).catch(() => {})
    api('/appsflyer/scheduler').then(setScheduler).catch(() => {})
  }
  useEffect(() => {
    load()
    const i = setInterval(load, 15000)
    return () => clearInterval(i)
  }, [])

  const sync = async (days, endpoint = '/appsflyer/sync') => {
    setSyncing(true)
    try {
      const data = await api(endpoint, { method: 'POST', body: { days } })
      if (data.results) {
        const ok = data.results.filter(r => !r.error)
        const fail = data.results.filter(r => r.error)
        if (fail.length > 0) toast.warning(`Sync done. ${fail.length} failure(s).`)
        else toast.success(`Imported ${ok.reduce((s, r) => s + (r.rows_imported || 0), 0)} rows`)
      } else {
        toast.success('Triggered')
      }
      load()
    } catch (e) { toast.error(e.message) }
    setSyncing(false)
  }

  const runScheduled = async (which) => {
    setSyncing(true)
    try {
      await api(`/appsflyer/scheduler/run-${which}`, { method: 'POST' })
      toast.success(`Triggered ${which} sync — running in background`)
      setTimeout(load, 3000)
    } catch (e) { toast.error(e.message) }
    setSyncing(false)
  }

  const markRead = async () => {
    await api('/notifications/mark-read', { method: 'POST' })
    load()
  }

  const lastInstalls = scheduler?.last_success?.installs_report
  const lastEvents = scheduler?.last_success?.in_app_events_report
  const notifs = scheduler?.notifications || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">AppsFlyer Sync</h1>
        <p className="text-slate-500">Automated hourly + nightly 7-day re-sync. Manual override available.</p>
      </div>

      {notifs.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-red-900">Sync issues ({notifs.length} unread)</div>
                <div className="mt-2 space-y-1">
                  {notifs.map(n => (
                    <div key={n.id} className="text-sm text-red-800"><strong>{n.report_type}</strong> {n.from_date} → {n.to_date}: {n.message}</div>
                  ))}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={markRead}>Mark read</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2"><Clock className="w-4 h-4" /> Scheduler</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-2"><Badge className={scheduler?.state?.started ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-200'}>{scheduler?.state?.started ? 'Running' : 'Stopped'}</Badge></div>
              <div className="text-xs text-slate-500 mt-2">Hourly: minute :07</div>
              <div className="text-xs text-slate-500">Nightly re-sync: 03:15 ET (last 7d)</div>
              <div className="text-xs text-slate-500">Daily emails: 08:00 ET</div>
              <div className="text-xs text-slate-500 mt-3">Last hourly: <span className="text-slate-700">{fmtWhen(scheduler?.state?.lastHourlyRun?.at)}</span></div>
              <div className="text-xs text-slate-500">Last nightly: <span className="text-slate-700">{fmtWhen(scheduler?.state?.lastNightlyRun?.at)}</span></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> Last installs sync</CardTitle></CardHeader>
          <CardContent>
            {lastInstalls ? (
              <div className="text-sm">
                <div className="text-slate-900 font-medium">{fmtWhen(lastInstalls.completed_at)}</div>
                <div className="text-xs text-slate-500 mt-1">Range: {lastInstalls.from_date} → {lastInstalls.to_date}</div>
                <div className="text-xs text-slate-500">Rows: {lastInstalls.rows_imported || 0} · {fmtDuration(lastInstalls.duration_ms)}</div>
                <div className="text-xs text-slate-500">Trigger: {lastInstalls.trigger || 'manual'}</div>
              </div>
            ) : <div className="text-sm text-slate-400">No successful run yet</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> Last events sync</CardTitle></CardHeader>
          <CardContent>
            {lastEvents ? (
              <div className="text-sm">
                <div className="text-slate-900 font-medium">{fmtWhen(lastEvents.completed_at)}</div>
                <div className="text-xs text-slate-500 mt-1">Range: {lastEvents.from_date} → {lastEvents.to_date}</div>
                <div className="text-xs text-slate-500">Rows: {lastEvents.rows_imported || 0} · {fmtDuration(lastEvents.duration_ms)}</div>
                <div className="text-xs text-slate-500">Trigger: {lastEvents.trigger || 'manual'}</div>
              </div>
            ) : <div className="text-sm text-slate-400">No successful run yet</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Manual sync</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => sync(1)} disabled={syncing} className="bg-blue-600 hover:bg-blue-700"><RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />Sync Last 24h</Button>
            <Button onClick={() => sync(7)} disabled={syncing} variant="outline"><RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />Sync Last 7 Days</Button>
            <Button onClick={() => sync(30)} disabled={syncing} variant="outline"><RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />Sync Last 30 Days</Button>
            <Button onClick={() => runScheduled('hourly')} disabled={syncing} variant="outline">Trigger Hourly Job</Button>
            <Button onClick={() => runScheduled('nightly')} disabled={syncing} variant="outline">Trigger Nightly Job</Button>
          </div>
          <p className="text-xs text-slate-500">Pulls installs_report/v5 and in_app_events_report/v5 with retries. Dedupes by click_id + event + time.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Import history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr><th className="text-left p-3">Report</th><th className="text-left">Range</th><th className="text-left">Status</th><th className="text-right">Rows</th><th className="text-right">Duration</th><th className="text-left">Trigger</th><th className="text-left p-3">Error</th><th className="text-left">When</th></tr>
            </thead>
            <tbody>
              {imports.map(i => (
                <tr key={i.id} className="border-b">
                  <td className="p-3 font-medium">{i.report_type}</td>
                  <td>{i.from_date} → {i.to_date}</td>
                  <td><Badge className={i.status === 'success' ? 'bg-green-100 text-green-700 hover:bg-green-100' : i.status === 'failed' ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>{i.status}</Badge></td>
                  <td className="text-right">{i.rows_imported || 0}{i.total_rows ? <span className="text-slate-400 text-xs">/{i.total_rows}</span> : null}</td>
                  <td className="text-right">{fmtDuration(i.duration_ms)}</td>
                  <td><Badge variant="outline" className="text-xs">{i.trigger || 'manual'}</Badge></td>
                  <td className="p-3 text-xs text-red-600 max-w-xs truncate">{i.error_message || ''}</td>
                  <td className="text-xs text-slate-500">{new Date(i.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {imports.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400">No sync history</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
