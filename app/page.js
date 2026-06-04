'use client'

import { useEffect, useState } from 'react'
import { api, getToken, setToken } from '@/lib/api-client'
import Login from '@/components/Login'
import AdminApp from '@/components/admin/AdminApp'
import PublisherApp from '@/components/publisher/PublisherApp'

const App = () => {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    if (!getToken()) { setMe(null); setLoading(false); return }
    try {
      const data = await api('/auth/me')
      setMe(data)
    } catch {
      setToken(null)
      setMe(null)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const logout = () => { setToken(null); setMe(null) }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-slate-500">Loading…</div></div>
  }
  if (!me) return <Login onLogin={load} />
  if (me.user.role === 'publisher') return <PublisherApp me={me} onLogout={logout} />
  return <AdminApp me={me} onLogout={logout} />
}

export default App
