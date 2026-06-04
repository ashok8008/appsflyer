'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Link2 } from 'lucide-react'

export default function CampaignsView() {
  const [list, setList] = useState([])
  const [publishers, setPublishers] = useState([])
  const [open, setOpen] = useState(false)
  const [assignDialog, setAssignDialog] = useState(null)
  const [form, setForm] = useState({ campaign_name: 'Polymarket', public_code: 'POLYMARKET', app_name: 'Polymarket', payout_type: 'CPI', payout_amount: '2.00', currency: 'USD', allowed_geos: '' })
  const [assignForm, setAssignForm] = useState({ publisher_id: '', custom_payout_amount: '' })

  const load = () => {
    api('/campaigns').then(setList).catch(e => toast.error(e.message))
    api('/publishers').then(setPublishers).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    try {
      const body = { ...form, allowed_geos: form.allowed_geos.split(',').map(s => s.trim()).filter(Boolean) }
      await api('/campaigns', { method: 'POST', body })
      toast.success('Campaign created')
      setOpen(false)
      load()
    } catch (e) { toast.error(e.message) }
  }
  const assign = async () => {
    try {
      await api(`/campaigns/${assignDialog.id}/assign`, { method: 'POST', body: assignForm })
      toast.success('Campaign assigned')
      setAssignDialog(null); setAssignForm({ publisher_id: '', custom_payout_amount: '' })
    } catch (e) { toast.error(e.message) }
  }
  const toggle = async (c) => {
    await api(`/campaigns/${c.id}`, { method: 'PUT', body: { status: c.status === 'active' ? 'inactive' : 'active' } })
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-slate-500">Create and assign campaigns/offers to publishers</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" />New Campaign</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input value={form.campaign_name} onChange={e => setForm({ ...form, campaign_name: e.target.value })} /></div>
                <div><Label>Code (af_c_id) *</Label><Input value={form.public_code} onChange={e => setForm({ ...form, public_code: e.target.value.toUpperCase() })} /></div>
              </div>
              <div><Label>App Name</Label><Input value={form.app_name} onChange={e => setForm({ ...form, app_name: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Payout type</Label>
                  <Select value={form.payout_type} onValueChange={v => setForm({ ...form, payout_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CPI">CPI</SelectItem>
                      <SelectItem value="CPA">CPA</SelectItem>
                      <SelectItem value="RevenueShare">RevenueShare</SelectItem>
                      <SelectItem value="Fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Payout</Label><Input type="number" step="0.01" value={form.payout_amount} onChange={e => setForm({ ...form, payout_amount: e.target.value })} /></div>
                <div><Label>Currency</Label><Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} /></div>
              </div>
              <div><Label>Allowed GEOs (comma)</Label><Input value={form.allowed_geos} onChange={e => setForm({ ...form, allowed_geos: e.target.value })} placeholder="US, CA, UK" /></div>
            </div>
            <DialogFooter><Button onClick={create} className="bg-blue-600 hover:bg-blue-700">Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr><th className="text-left p-3">Name</th><th className="text-left">Code</th><th className="text-left">Payout</th><th className="text-left">Platform</th><th className="text-left">Status</th><th className="text-right p-3">Actions</th></tr>
            </thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-medium">{c.campaign_name}</td>
                  <td><code className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">{c.public_code}</code></td>
                  <td>{c.payout_type} ${c.payout_amount} {c.currency}</td>
                  <td>{c.platform}</td>
                  <td><Badge className={c.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-200'}>{c.status}</Badge></td>
                  <td className="p-3 text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setAssignDialog(c)}><Link2 className="w-3 h-3 mr-1" />Assign</Button>
                    <Button variant="outline" size="sm" onClick={() => toggle(c)}>{c.status === 'active' ? 'Disable' : 'Enable'}</Button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No campaigns yet</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!assignDialog} onOpenChange={(o) => !o && setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign {assignDialog?.campaign_name} to publisher</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Publisher</Label>
              <Select value={assignForm.publisher_id} onValueChange={v => setAssignForm({ ...assignForm, publisher_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select publisher" /></SelectTrigger>
                <SelectContent>
                  {publishers.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.public_code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Custom payout amount (optional)</Label><Input type="number" step="0.01" value={assignForm.custom_payout_amount} onChange={e => setAssignForm({ ...assignForm, custom_payout_amount: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={assign} className="bg-blue-600 hover:bg-blue-700">Assign</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
