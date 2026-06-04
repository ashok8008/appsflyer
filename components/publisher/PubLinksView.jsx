'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Copy, Check } from 'lucide-react'

export default function PubLinksView() {
  const [list, setList] = useState([])
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => { api('/publisher/tracking-links').then(setList).catch(e => toast.error(e.message)) }, [])

  const copy = (url, id) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedId(null), 1500)
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Tracking Links</h1>
        <p className="text-slate-500">Copy and use these tracking URLs. Add sub IDs as needed.</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr><th className="text-left p-3">Tracking URL</th><th className="text-left">Campaign</th><th className="text-left">Placement</th><th className="text-left">Status</th><th className="text-right p-3">Copy</th></tr>
            </thead>
            <tbody>
              {list.map(l => (
                <tr key={l.id} className="border-b hover:bg-slate-50">
                  <td className="p-3"><code className="text-xs bg-slate-100 px-2 py-1 rounded break-all">{l.short_url}</code></td>
                  <td>{l.campaign?.campaign_name}</td>
                  <td>{l.placement?.name}</td>
                  <td><Badge className={l.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-200'}>{l.status}</Badge></td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => copy(l.short_url, l.id)}>
                      {copiedId === l.id ? <Check className="w-3 h-3 mr-1 text-green-600" /> : <Copy className="w-3 h-3 mr-1" />}
                      {copiedId === l.id ? 'Copied' : 'Copy'}
                    </Button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No links yet — ask your admin to generate one</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-sm text-slate-600">
          <div className="font-semibold text-slate-900 mb-2">Adding Sub IDs</div>
          <p>Append parameters like <code className="bg-slate-100 px-1">?sub_id_1=source&amp;sub_id_2=creative&amp;sub_id_3=adset&amp;sub_id_4=custom&amp;referral_url=https://yoursite.com</code> to your tracking URL.</p>
        </CardContent>
      </Card>
    </div>
  )
}
