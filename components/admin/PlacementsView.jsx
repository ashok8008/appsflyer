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
import { Plus } from 'lucide-react'

export default function PlacementsView() {
  const [list, setList] = useState([])
  const [publishers, setPublishers] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ publisher_id: '', campaign_id: '', name: '', public_code: '', source_type: 'web' })

  const load = () => {
    api('/placements').then(setList).catch(() => {})
    api('/publishers').then(setPublishers).catch(() => {})
    api('/campaigns').then(setCampaigns).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    try {
      await api('/placements', { method: 'POST', body: form })
      toast.success('Placement created')
      setOpen(false); setForm({ publisher_id: '', campaign_id: '', name: '', public_code: '', source_type: 'web' })
      load()
    } catch (e) { toast.error(e.message) }
  }

  const pMap = Object.fromEntries(publishers.map(p => [p.id, p]))
  const cMap = Object.fromEntries(campaigns.map(c => [c.id, c]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Placements / Sources</h1>
          <p className="text-slate-500">Identified by af_sub_siteid in AppsFlyer</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" />New Placement</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Placement</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Publisher</Label>
                <Select value={form.publisher_id} onValueChange={v => setForm({ ...form, publisher_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{publishers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Campaign (optional)</Label>
                <Select value={form.campaign_id} onValueChange={v => setForm({ ...form, campaign_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>{campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.campaign_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="main" /></div>
              <div><Label>Code (af_sub_siteid) *</Label><Input value={form.public_code} onChange={e => setForm({ ...form, public_code: e.target.value.toLowerCase() })} placeholder="popculture_main" /></div>
              <div><Label>Source type</Label>
                <Select value={form.source_type} onValueChange={v => setForm({ ...form, source_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web">Web</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="push">Push</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={create} className="bg-blue-600 hover:bg-blue-700">Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr><th className="text-left p-3">Name</th><th className="text-left">af_sub_siteid</th><th className="text-left">Publisher</th><th className="text-left">Campaign</th><th className="text-left">Type</th><th className="text-left">Status</th></tr>
            </thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td><code className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">{p.public_code}</code></td>
                  <td>{pMap[p.publisher_id]?.name || '-'}</td>
                  <td>{cMap[p.campaign_id]?.campaign_name || '-'}</td>
                  <td>{p.source_type}</td>
                  <td><Badge className={p.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-200'}>{p.status}</Badge></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No placements yet</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
