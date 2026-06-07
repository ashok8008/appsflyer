'use client'

import { useEffect, useState } from 'react'
import { api, downloadCsv } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Download, Copy } from 'lucide-react'
import DateRangeBar, { DATE_PRESETS } from '@/components/DateRangeBar'

function Stat({ label, value, sub, color = 'text-slate-900' }) {
  return (
    <Card><CardContent className="pt-5 pb-5">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </CardContent></Card>
  )
}

function copyForSheets(rows, headers, labels) {
  const tsv = [labels.join('\t'), ...rows.map(r => headers.map(h => r[h] ?? '').join('\t'))].join('\n')
  navigator.clipboard.writeText(tsv)
  toast.success('Copied to clipboard (paste into Google Sheets)')
}

export default function ReportsView() {
  const init = DATE_PRESETS['30d']()
  const [dr, setDr] = useState({ ...init, preset: '30d' })
  const [groupBy, setGroupBy] = useState('publisher')
  const [data, setData] = useState(null)

  const load = () => {
    const qs = new URLSearchParams({ from: dr.from, to: dr.to, group_by: groupBy }).toString()
    api(`/reports/overview?${qs}`).then(setData).catch(() => {})
  }
  useEffect(() => { load() }, [dr.from, dr.to, groupBy])

  const t = data?.totals || {}
  const headers = ['key', 'name', 'code', 'clicks', 'installs', 'signups', 'depositors', 'traders', 'qualified_paid', 'cost', 'cvr', 'deposit_rate', 'qual_rate']
  const labels = ['Key', 'Name', 'Code', 'Clicks', 'Installs', 'Signups', 'Depositors', 'Traders', 'Qualified', 'Cost', 'CVR', 'Dep Rate', 'Qual Rate']
  const tableRows = (data?.breakdown || []).map(r => ({
    ...r,
    cvr: (r.cvr * 100).toFixed(2) + '%',
    deposit_rate: (r.deposit_rate * 100).toFixed(2) + '%',
    qual_rate: (r.qual_rate * 100).toFixed(2) + '%',
    cost: r.cost.toFixed(2),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500">Combined view: AppsFlyer clicks/installs + uploaded conversions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => copyForSheets(tableRows, headers, labels)}><Copy className="w-4 h-4 mr-1" />Copy for Sheets</Button>
          <Button variant="outline" onClick={() => downloadCsv(`/reports/export.csv?from=${dr.from}&to=${dr.to}&group_by=${groupBy}`)}><Download className="w-4 h-4 mr-1" />Export CSV</Button>
        </div>
      </div>
      <Card>
        <CardContent className="pt-5 pb-5 space-y-3">
          <DateRangeBar value={dr} onChange={setDr} />
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Group by:</span>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label="Clicks" value={(t.clicks || 0).toLocaleString()} />
        <Stat label="Installs" value={(t.installs || 0).toLocaleString()} sub={`CVR ${((t.cvr || 0) * 100).toFixed(2)}%`} />
        <Stat label="Signups" value={(t.signups || 0).toLocaleString()} />
        <Stat label="Depositors" value={(t.depositors || 0).toLocaleString()} sub={`${((t.deposit_rate || 0) * 100).toFixed(1)}% rate`} color="text-blue-600" />
        <Stat label="Traders" value={(t.traders || 0).toLocaleString()} />
        <Stat label="Qualified" value={(t.qualified_paid || 0).toLocaleString()} sub={`${((t.qual_rate || 0) * 100).toFixed(1)}% rate`} color="text-green-600" />
        <Stat label="Cost / Payout" value={`$${(t.cost || 0).toLocaleString()}`} />
      </div>
      <Card>
        <CardHeader><CardTitle>Breakdown by {groupBy}</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr><th className="text-left p-3">{groupBy}</th><th className="text-right">Clicks</th><th className="text-right">Installs</th><th className="text-right">Signups</th><th className="text-right">Depositors</th><th className="text-right">Traders</th><th className="text-right">Qualified</th><th className="text-right">Cost</th><th className="text-right">CVR</th><th className="text-right">Dep Rate</th><th className="text-right p-3">Qual Rate</th></tr>
            </thead>
            <tbody>
              {(data?.breakdown || []).map(r => (
                <tr key={r.key} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-medium">{r.name || r.key}{r.code && <span className="text-xs text-slate-400 ml-2">({r.code})</span>}</td>
                  <td className="text-right">{r.clicks.toLocaleString()}</td>
                  <td className="text-right">{r.installs.toLocaleString()}</td>
                  <td className="text-right">{(r.signups || 0).toLocaleString()}</td>
                  <td className="text-right text-blue-700 font-medium">{(r.depositors || 0).toLocaleString()}</td>
                  <td className="text-right">{(r.traders || 0).toLocaleString()}</td>
                  <td className="text-right text-green-700 font-medium">{(r.qualified_paid || 0).toLocaleString()}</td>
                  <td className="text-right">${(r.cost || 0).toFixed(2)}</td>
                  <td className="text-right">{(r.cvr * 100).toFixed(2)}%</td>
                  <td className="text-right">{(r.deposit_rate * 100).toFixed(2)}%</td>
                  <td className="p-3 text-right">{(r.qual_rate * 100).toFixed(2)}%</td>
                </tr>
              ))}
              {(!data?.breakdown || data.breakdown.length === 0) && <tr><td colSpan={11} className="p-8 text-center text-slate-400">No data for this range</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
