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

export default function AdminUsersView({ me }) {
  const [list, setList] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' })

  const load = () => api('/users').then(setList).catch(e => toast.error(e.message))
  useEffect(() => { load() }, [])

  const create = async () => {
    try {
      await api('/users', { method: 'POST', body: form })
      toast.success('User created')
      setOpen(false); setForm({ name: '', email: '', password: '', role: 'admin' })
      load()
    } catch (e) { toast.error(e.message) }
  }

  const isSuper = me.user.role === 'super_admin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Users</h1>
          <p className="text-slate-500">Only Super Admin can invite other admins</p>
        </div>
        {isSuper && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" />New Admin</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Admin User</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Password</Label><Input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
                <div><Label>Role</Label>
                  <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={create} className="bg-blue-600 hover:bg-blue-700">Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr><th className="text-left p-3">Name</th><th className="text-left">Email</th><th className="text-left">Role</th><th className="text-left">Status</th><th className="text-left">Last login</th></tr>
            </thead>
            <tbody>
              {list.map(u => (
                <tr key={u.id} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td>{u.email}</td>
                  <td><Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{u.role}</Badge></td>
                  <td><Badge className={u.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-200'}>{u.status}</Badge></td>
                  <td className="text-xs text-slate-500">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
