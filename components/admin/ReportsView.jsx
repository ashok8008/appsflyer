'use client'

import { useEffect, useState } from 'react'
import { api, downloadCsv } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download } from 'lucide-react'

export default function ReportsView() {
  const today = new Date().toISOString().slice(0, 10)
  const ago7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const [from, setFrom] = useState(ago7)
  const [to, setTo] = useState(today)
  const [groupBy, setGroupBy] = useState('publisher')
  const [data, setData] = useState(null)

  const load = () => {
    const qs = new URLSearchParams({ from, to, group_by: groupBy }).toString()
    api(`/reports/overview?${qs}`).then(setData).catch(() => {})
  }
  useEffect(() => { load() }, [from, to, groupBy])

  const t = data?.totals || {}
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500">Filtered performance across publishers and campaigns</p>
        </div>
        <Button variant="outline" onClick={() => downloadCsv(`/reports/export.csv?from=${from}&to=${to}&group_by=${groupBy}`)}>
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><Label>Group by</Label>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="publisher">Publisher</SelectItem>
                <SelectItem value="campaign">Campaign</SelectItem>
                <SelectItem value="placement">Placement</SelectItem>
                <SelectItem value="country">Country</SelectItem>
                <SelectItem value="sub_id_1">Sub ID 1</SelectItem>
                <SelectItem value="sub_id_2">Sub ID 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          ['Clicks', (t.clicks || 0).toLocaleString()],
          ['Installs', (t.installs || 0).toLocaleString()],
          ['Events', (t.events || 0).toLocaleString()],
          ['CVR', ((t.cvr || 0) * 100).toFixed(2) + '%'],
          ['Revenue', '$' + (t.revenue || 0).toLocaleString()],
        ].map(([l, v]) => (
          <Card key={l}><CardContent className="pt-6"><div className="text-xs text-slate-500">{l}</div><div className="text-xl font-bold mt-1">{v}</div></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Breakdown by {groupBy}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr><th className="text-left p-3">Key</th><th className="text-right">Clicks</th><th className="text-right">Installs</th><th className="text-right">Events</th><th className="text-right">CVR</th><th className="text-right">Revenue</th><th className="text-right p-3">eCPI</th></tr>
            </thead>
            <tbody>
              {(data?.breakdown || []).map(r => (
                <tr key={r.key} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-medium">{r.name || r.key}{r.code && <span className="text-xs text-slate-400 ml-2">({r.code})</span>}</td>
                  <td className="text-right">{r.clicks}</td>
                  <td className="text-right">{r.installs}</td>
                  <td className="text-right">{r.events}</td>
                  <td className="text-right">{(r.cvr * 100).toFixed(2)}%</td>
                  <td className="text-right">${r.revenue.toFixed(2)}</td>
                  <td className="p-3 text-right">${r.ecpi.toFixed(2)}</td>
                </tr>
              ))}
              {(!data?.breakdown || data.breakdown.length === 0) && <tr><td colSpan={7} className="p-8 text-center text-slate-400">No data for this range</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
