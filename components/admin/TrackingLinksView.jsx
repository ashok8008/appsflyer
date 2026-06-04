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
import { Plus, Copy, Check } from 'lucide-react'

export default function TrackingLinksView() {
  const [list, setList] = useState([])
  const [publishers, setPublishers] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [placements, setPlacements] = useState([])
  const [open, setOpen] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [form, setForm] = useState({ publisher_id: '', campaign_id: '', placement_id: '' })

  const load = () => {
    api('/tracking-links').then(setList).catch(() => {})
    api('/publishers').then(setPublishers).catch(() => {})
    api('/campaigns').then(setCampaigns).catch(() => {})
    api('/placements').then(setPlacements).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const filteredPlacements = placements.filter(p => !form.publisher_id || p.publisher_id === form.publisher_id)

  const create = async () => {
    try {
      await api('/tracking-links', { method: 'POST', body: form })
      toast.success('Tracking link generated')
      setOpen(false); setForm({ publisher_id: '', campaign_id: '', placement_id: '' })
      load()
    } catch (e) { toast.error(e.message) }
  }
  const toggle = async (l) => {
    await api(`/tracking-links/${l.id}`, { method: 'PUT', body: { status: l.status === 'active' ? 'inactive' : 'active' } })
    load()
  }
  const copy = (url, id) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast.success('Copied')
    setTimeout(() => setCopiedId(null), 1500)
  }

  const pMap = Object.fromEntries(publishers.map(p => [p.id, p]))
  const cMap = Object.fromEntries(campaigns.map(c => [c.id, c]))
  const plMap = Object.fromEntries(placements.map(p => [p.id, p]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tracking Links</h1>
          <p className="text-slate-500">Internal redirect URLs (AppsFlyer details hidden from publishers)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" />New Link</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate Tracking Link</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Publisher</Label>
                <Select value={form.publisher_id} onValueChange={v => setForm({ ...form, publisher_id: v, placement_id: '' })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{publishers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Campaign</Label>
                <Select value={form.campaign_id} onValueChange={v => setForm({ ...form, campaign_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.campaign_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Placement</Label>
                <Select value={form.placement_id} onValueChange={v => setForm({ ...form, placement_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{filteredPlacements.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.public_code})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={create} className="bg-blue-600 hover:bg-blue-700">Generate</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr><th className="text-left p-3">Tracking URL</th><th className="text-left">Publisher</th><th className="text-left">Campaign</th><th className="text-left">Placement</th><th className="text-left">Status</th><th className="text-right p-3">Actions</th></tr>
            </thead>
            <tbody>
              {list.map(l => (
                <tr key={l.id} className="border-b hover:bg-slate-50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded max-w-md truncate">{l.short_url}</code>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy(l.short_url, l.id)}>
                        {copiedId === l.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </td>
                  <td>{pMap[l.publisher_id]?.name}</td>
                  <td>{cMap[l.campaign_id]?.campaign_name}</td>
                  <td>{plMap[l.placement_id]?.name}</td>
                  <td><Badge className={l.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-200'}>{l.status}</Badge></td>
                  <td className="p-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => toggle(l)}>{l.status === 'active' ? 'Disable' : 'Enable'}</Button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No links yet</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
