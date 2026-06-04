'use client'

import { useState } from 'react'
import { BarChart3, Users, Briefcase, Link2, FileBarChart, RefreshCw, Settings, UserCog, LogOut, MapPin, Mail } from 'lucide-react'
import DashboardView from './DashboardView'
import PublishersView from './PublishersView'
import CampaignsView from './CampaignsView'
import PlacementsView from './PlacementsView'
import TrackingLinksView from './TrackingLinksView'
import ReportsView from './ReportsView'
import SyncView from './SyncView'
import EmailsView from './EmailsView'
import AdminUsersView from './AdminUsersView'
import SettingsView from './SettingsView'

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'publishers', label: 'Publishers', icon: Users },
  { id: 'campaigns', label: 'Campaigns', icon: Briefcase },
  { id: 'placements', label: 'Placements', icon: MapPin },
  { id: 'links', label: 'Tracking Links', icon: Link2 },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'sync', label: 'AppsFlyer Sync', icon: RefreshCw },
  { id: 'emails', label: 'Daily Emails', icon: Mail },
  { id: 'users', label: 'Admin Users', icon: UserCog },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function AdminApp({ me, onLogout }) {
  const [view, setView] = useState('dashboard')

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900">Clickvibe</div>
              <div className="text-xs text-slate-500">Admin Console</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(n => {
            const Icon = n.icon
            const active = view === n.id
            return (
              <button key={n.id} onClick={() => setView(n.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Icon className="w-4 h-4" />
                {n.label}
              </button>
            )
          })}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <div className="mb-2">
            <div className="text-sm font-medium text-slate-900">{me.user.name}</div>
            <div className="text-xs text-slate-500">{me.user.email}</div>
            <div className="text-xs text-blue-600 font-semibold uppercase tracking-wide mt-1">{me.user.role.replace('_',' ')}</div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {view === 'dashboard' && <DashboardView />}
          {view === 'publishers' && <PublishersView />}
          {view === 'campaigns' && <CampaignsView />}
          {view === 'placements' && <PlacementsView />}
          {view === 'links' && <TrackingLinksView />}
          {view === 'reports' && <ReportsView />}
          {view === 'sync' && <SyncView />}
          {view === 'emails' && <EmailsView />}
          {view === 'users' && <AdminUsersView me={me} />}
          {view === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  )
}
