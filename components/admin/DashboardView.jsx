'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MousePointer, Download, DollarSign, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">{label}</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
            {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardView() {
  const [data, setData] = useState(null)
  const [topPub, setTopPub] = useState(null)
  const [topCmp, setTopCmp] = useState(null)

  useEffect(() => {
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    api(`/reports/overview?from=${from}&to=${to}`).then(setData).catch(() => {})
    api(`/reports/overview?from=${from}&to=${to}&group_by=publisher`).then(setTopPub).catch(() => {})
    api(`/reports/overview?from=${from}&to=${to}&group_by=campaign`).then(setTopCmp).catch(() => {})
  }, [])

  const t = data?.totals || {}
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Last 7 days overview</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat icon={MousePointer} label="Clicks" value={(t.clicks || 0).toLocaleString()} />
        <Stat icon={Download} label="Installs" value={(t.installs || 0).toLocaleString()} sub={`CVR ${((t.cvr || 0) * 100).toFixed(2)}%`} />
        <Stat icon={TrendingUp} label="Events" value={(t.events || 0).toLocaleString()} />
        <Stat icon={DollarSign} label="Revenue" value={`$${(t.revenue || 0).toLocaleString()}`} sub={`eCPI $${(t.ecpi || 0).toFixed(2)}`} />
      </div>
      <Card>
        <CardHeader><CardTitle>Daily performance</CardTitle></CardHeader>
        <CardContent>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={data?.series || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="clicks" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="installs" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="events" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Top Publishers</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-slate-500 border-b"><tr><th className="text-left py-2">Publisher</th><th className="text-right">Clicks</th><th className="text-right">Installs</th><th className="text-right">Rev</th></tr></thead>
              <tbody>
                {(topPub?.breakdown || []).slice(0, 5).map(r => (
                  <tr key={r.key} className="border-b last:border-0"><td className="py-2">{r.name || r.key}</td><td className="text-right">{r.clicks}</td><td className="text-right">{r.installs}</td><td className="text-right">${r.revenue.toFixed(2)}</td></tr>
                ))}
                {(!topPub?.breakdown || topPub.breakdown.length === 0) && <tr><td colSpan={4} className="py-4 text-center text-slate-400">No data yet</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top Campaigns</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-slate-500 border-b"><tr><th className="text-left py-2">Campaign</th><th className="text-right">Clicks</th><th className="text-right">Installs</th><th className="text-right">Rev</th></tr></thead>
              <tbody>
                {(topCmp?.breakdown || []).slice(0, 5).map(r => (
                  <tr key={r.key} className="border-b last:border-0"><td className="py-2">{r.name || r.key}</td><td className="text-right">{r.clicks}</td><td className="text-right">{r.installs}</td><td className="text-right">${r.revenue.toFixed(2)}</td></tr>
                ))}
                {(!topCmp?.breakdown || topCmp.breakdown.length === 0) && <tr><td colSpan={4} className="py-4 text-center text-slate-400">No data yet</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
