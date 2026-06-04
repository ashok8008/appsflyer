'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { api, setToken } from '@/lib/api-client'
import { toast } from 'sonner'
import { BarChart3 } from 'lucide-react'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@clickvibe.com')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await api('/auth/login', { method: 'POST', body: { email, password } })
      setToken(data.token)
      toast.success('Welcome back!')
      onLogin()
    } catch (e) {
      toast.error(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2 text-blue-600">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <BarChart3 className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-slate-900">Clickvibe</span>
          </div>
        </div>
        <Card className="shadow-xl border-blue-100">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>Publisher reporting and tracking dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
              <p className="text-xs text-slate-500 text-center">Default super admin: admin@clickvibe.com / admin123</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
