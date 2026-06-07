'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function startOfMonth(d) { const x = new Date(d); x.setUTCDate(1); return x.toISOString().slice(0, 10) }
function endOfMonth(d) { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + 1, 0); return x.toISOString().slice(0, 10) }

export const DATE_PRESETS = {
  '7d': () => ({ from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) }),
  '30d': () => ({ from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) }),
  '90d': () => ({ from: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) }),
  all: () => ({ from: '2020-01-01', to: new Date().toISOString().slice(0, 10) }),
  current_month: () => { const now = new Date(); return { from: startOfMonth(now), to: new Date().toISOString().slice(0, 10) } },
  previous_month: () => { const now = new Date(); now.setUTCMonth(now.getUTCMonth() - 1); return { from: startOfMonth(now), to: endOfMonth(now) } },
}

export default function DateRangeBar({ value, onChange }) {
  const presets = [
    ['7d', '7d'], ['30d', '30d'], ['90d', '90d'],
    ['current_month', 'This month'], ['previous_month', 'Last month'], ['all', 'All time'],
  ]
  const setPreset = (key) => {
    const r = DATE_PRESETS[key]()
    onChange({ ...value, ...r, preset: key })
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-wrap gap-1">
        {presets.map(([k, label]) => (
          <Button key={k} size="sm" variant={value.preset === k ? 'default' : 'outline'} className={value.preset === k ? 'bg-blue-600 hover:bg-blue-700' : ''} onClick={() => setPreset(k)}>{label}</Button>
        ))}
      </div>
      <div className="flex items-end gap-2 ml-auto">
        <div><Label className="text-xs">From</Label><Input type="date" className="h-9 w-36" value={value.from} onChange={e => onChange({ ...value, from: e.target.value, preset: 'custom' })} /></div>
        <div><Label className="text-xs">To</Label><Input type="date" className="h-9 w-36" value={value.to} onChange={e => onChange({ ...value, to: e.target.value, preset: 'custom' })} /></div>
      </div>
    </div>
  )
}
