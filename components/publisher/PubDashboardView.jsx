'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

function Stat({ label, value, sub, color = 'text-slate-900' }) {
  return (
    <Card><CardContent className="pt-5 pb-5">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </CardContent></Card>
  )
}

export default function PubDashboardView() {
  const [data, setData] = useState(null)
  useEffect(() => {
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    api(`/publisher/reports/overview?from=${from}&to=${to}`).then(setData).catch(() => {})
  }, [])
  const t = data?.totals || {}
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Your last 30 days performance</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label="Clicks" value={(t.clicks || 0).toLocaleString()} />
        <Stat label="Installs" value={(t.installs || 0).toLocaleString()} sub={`CVR ${((t.cvr || 0) * 100).toFixed(2)}%`} />
        <Stat label="Signups" value={(t.signups || 0).toLocaleString()} />
        <Stat label="Depositors" value={(t.depositors || 0).toLocaleString()} sub={`${((t.deposit_rate || 0) * 100).toFixed(1)}% rate`} color="text-blue-600" />
        <Stat label="Traders" value={(t.traders || 0).toLocaleString()} />
        <Stat label="Qualified" value={(t.qualified_paid || 0).toLocaleString()} sub={`${((t.qual_rate || 0) * 100).toFixed(1)}% rate`} color="text-green-600" />
        <Stat label="Payout" value={`$${(t.cost || 0).toLocaleString()}`} />
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
                <Line type="monotone" dataKey="signups" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="depositors" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="qualified_paid" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
