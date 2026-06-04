'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

export default function SettingsView() {
  const [s, setS] = useState(null)
  const [recipients, setRecipients] = useState('')

  useEffect(() => {
    api('/settings').then(d => { setS(d); setRecipients((d.daily_report_recipients || []).join(', ')) }).catch(() => {})
  }, [])

  const save = async () => {
    try {
      const body = { ...s, daily_report_recipients: recipients.split(',').map(x => x.trim()).filter(Boolean) }
      delete body.updated_at
      const out = await api('/settings', { method: 'PUT', body })
      setS(out)
      toast.success('Saved')
    } catch (e) { toast.error(e.message) }
  }

  if (!s) return <div>Loading…</div>
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">AppsFlyer + reporting configuration</p>
      </div>
      <Card>
        <CardHeader><CardTitle>AppsFlyer</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>AppsFlyer PID (Media Source)</Label><Input value={s.appsflyer_pid || ''} onChange={e => setS({ ...s, appsflyer_pid: e.target.value })} /></div>
          <div><Label>AppsFlyer App ID</Label><Input value={s.appsflyer_app_id || ''} onChange={e => setS({ ...s, appsflyer_app_id: e.target.value })} /></div>
          <div><Label>Platform</Label><Input value={s.platform || ''} onChange={e => setS({ ...s, platform: e.target.value })} /></div>
          <div><Label>Currency</Label><Input value={s.currency || ''} onChange={e => setS({ ...s, currency: e.target.value })} /></div>
          <div><Label>Reporting Timezone</Label><Input value={s.timezone || ''} onChange={e => setS({ ...s, timezone: e.target.value })} /></div>
          <div><Label>Tracking Base URL</Label><Input value={s.tracking_base_url || ''} onChange={e => setS({ ...s, tracking_base_url: e.target.value })} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Daily Email Reports</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3"><Switch checked={!!s.daily_report_enabled} onCheckedChange={v => setS({ ...s, daily_report_enabled: v })} /><Label>Enable daily reports</Label></div>
          <div><Label>Admin recipients (comma-separated)</Label><Input value={recipients} onChange={e => setRecipients(e.target.value)} placeholder="reports@clickvibe.ai" /></div>
          <p className="text-xs text-slate-500">Publishers automatically receive their own daily reports at their contact email.</p>
        </CardContent>
      </Card>
      <div><Button onClick={save} className="bg-blue-600 hover:bg-blue-700">Save Settings</Button></div>
    </div>
  )
}
