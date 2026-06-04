'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, UserPlus } from 'lucide-react'

export default function PublishersView() {
  const [list, setList] = useState([])
  const [open, setOpen] = useState(false)
  const [userDialog, setUserDialog] = useState(null)
  const [form, setForm] = useState({ name: '', public_code: '', company_name: '', contact_email: '', contact_name: '' })
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '' })

  const load = () => api('/publishers').then(setList).catch(e => toast.error(e.message))
  useEffect(() => { load() }, [])

  const create = async () => {
    try {
      await api('/publishers', { method: 'POST', body: form })
      toast.success('Publisher created')
      setOpen(false); setForm({ name: '', public_code: '', company_name: '', contact_email: '', contact_name: '' })
      load()
    } catch (e) { toast.error(e.message) }
  }
  const createUser = async () => {
    try {
      await api(`/publishers/${userDialog.id}/users`, { method: 'POST', body: userForm })
      toast.success('Publisher user created')
      setUserDialog(null); setUserForm({ name: '', email: '', password: '' })
    } catch (e) { toast.error(e.message) }
  }
  const toggleStatus = async (p) => {
    try {
      await api(`/publishers/${p.id}`, { method: 'PUT', body: { status: p.status === 'active' ? 'inactive' : 'active' } })
      load()
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Publishers</h1>
          <p className="text-slate-500">Onboard publishers under PID=Clickvibe (af_siteid)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" /> New Publisher</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Publisher</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Display name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="POPCULTURE" /></div>
              <div><Label>Site ID code (af_siteid) *</Label><Input value={form.public_code} onChange={e => setForm({ ...form, public_code: e.target.value.toUpperCase() })} placeholder="POPCULTURE" /></div>
              <div><Label>Company name</Label><Input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} /></div>
              <div><Label>Contact name</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div><Label>Contact email</Label><Input value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={create} className="bg-blue-600 hover:bg-blue-700">Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr><th className="text-left p-3">Name</th><th className="text-left">af_siteid</th><th className="text-left">Company</th><th className="text-left">Contact</th><th className="text-left">Status</th><th className="text-right p-3">Actions</th></tr>
            </thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td><code className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">{p.public_code}</code></td>
                  <td>{p.company_name}</td>
                  <td className="text-slate-500">{p.contact_email}</td>
                  <td><Badge variant={p.status === 'active' ? 'default' : 'secondary'} className={p.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>{p.status}</Badge></td>
                  <td className="p-3 text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setUserDialog(p)}><UserPlus className="w-3 h-3 mr-1" />Add User</Button>
                    <Button variant="outline" size="sm" onClick={() => toggleStatus(p)}>{p.status === 'active' ? 'Disable' : 'Enable'}</Button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No publishers yet</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!userDialog} onOpenChange={(o) => !o && setUserDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create publisher login for {userDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} /></div>
            <div><Label>Password</Label><Input type="text" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={createUser} className="bg-blue-600 hover:bg-blue-700">Create User</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
