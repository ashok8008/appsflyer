'use client'

import { useState } from 'react'
import { BarChart3, Link2, FileBarChart, LogOut } from 'lucide-react'
import PubDashboardView from './PubDashboardView'
import PubLinksView from './PubLinksView'
import PubReportsView from './PubReportsView'

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'links', label: 'My Tracking Links', icon: Link2 },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
]

export default function PublisherApp({ me, onLogout }) {
  const [view, setView] = useState('dashboard')
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center"><BarChart3 className="w-5 h-5" /></div>
            <div>
              <div className="font-bold text-slate-900">Clickvibe</div>
              <div className="text-xs text-slate-500">Publisher Portal</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(n => {
            const Icon = n.icon
            const active = view === n.id
            return (
              <button key={n.id} onClick={() => setView(n.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Icon className="w-4 h-4" />{n.label}
              </button>
            )
          })}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <div className="mb-2">
            <div className="text-sm font-medium text-slate-900">{me.user.name}</div>
            <div className="text-xs text-slate-500">{me.publisher?.name}</div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"><LogOut className="w-4 h-4" />Sign out</button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {view === 'dashboard' && <PubDashboardView />}
          {view === 'links' && <PubLinksView />}
          {view === 'reports' && <PubReportsView />}
        </div>
      </main>
    </div>
  )
}
