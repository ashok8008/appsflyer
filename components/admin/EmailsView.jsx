'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Send, Mail } from 'lucide-react'

export default function EmailsView() {
  const [logs, setLogs] = useState([])
  const [date, setDate] = useState(new Date(Date.now() - 86400000).toISOString().slice(0, 10))
  const [sending, setSending] = useState(false)

  const load = () => api('/emails/logs').then(setLogs).catch(() => {})
  useEffect(() => { load() }, [])

  const sendNow = async () => {
    setSending(true)
    try {
      const r = await api('/emails/send-daily', { method: 'POST', body: { date } })
      if (r.skipped) toast.warning('Skipped: ' + r.reason)
      else toast.success(`Sent to ${r.publisher_count} publisher(s)${r.admin ? ' + admin summary' : ''}`)
      load()
    } catch (e) { toast.error(e.message) }
    setSending(false)
  }

  const success = logs.filter(l => l.status === 'sent').length
  const failed = logs.filter(l => l.status === 'failed').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Daily Emails</h1>
        <p className="text-slate-500">Auto-sent at 08:00 ET. Manual send below.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Send className="w-4 h-4" /> Send daily reports</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <Label>Report date (data window)</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <Button onClick={sendNow} disabled={sending} className="bg-blue-600 hover:bg-blue-700">
              <Mail className={`w-4 h-4 mr-2 ${sending ? 'animate-pulse' : ''}`} />
              {sending ? 'Sending…' : 'Send now'}
            </Button>
          </div>
          <p className="text-xs text-slate-500">Each active publisher with a contact email receives their report. Admin recipients (set in Settings) receive the summary.</p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="text-xs text-slate-500">Sent</div><div className="text-2xl font-bold text-green-600">{success}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-slate-500">Failed</div><div className="text-2xl font-bold text-red-600">{failed}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-slate-500">Total tracked</div><div className="text-2xl font-bold text-slate-900">{logs.length}</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Send history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr><th className="text-left p-3">Recipient</th><th className="text-left">Report date</th><th className="text-left">Status</th><th className="text-left">Sent at</th><th className="text-left p-3">Error</th></tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b">
                  <td className="p-3">{l.recipient_email}</td>
                  <td>{l.report_date}</td>
                  <td><Badge className={l.status === 'sent' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>{l.status}</Badge></td>
                  <td className="text-xs text-slate-500">{new Date(l.sent_at).toLocaleString()}</td>
                  <td className="p-3 text-xs text-red-600 max-w-xs truncate">{l.error_message || ''}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No emails sent yet</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
