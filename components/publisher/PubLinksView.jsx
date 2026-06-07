'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Copy, Check, ExternalLink } from 'lucide-react'

export default function PubLinksView() {
  const [list, setList] = useState([])
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => { api('/publisher/links').then(setList).catch(e => toast.error(e.message)) }, [])

  const copy = (url, id) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast.success('Copied')
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Offers &amp; Links</h1>
        <p className="text-slate-500">Copy your assigned tracking URLs and share them.</p>
      </div>
      {list.length === 0 && (
        <Card><CardContent className="pt-6 text-center text-slate-400">No offers assigned yet — your admin will assign offers to you.</CardContent></Card>
      )}
      {list.map(item => (
        <Card key={item.assignment_id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>{item.campaign?.campaign_name}</span>
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{item.payout_type} ${item.payout_amount}</Badge>
                <Badge variant="outline">{item.tracking_mode}</Badge>
              </div>
              <Badge className={item.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-200'}>{item.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {item.direct_polymarket_url && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                <div className="text-xs uppercase tracking-wide text-blue-700 font-semibold mb-1">Your direct tracking link</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-white border rounded px-3 py-2 break-all">{item.direct_polymarket_url}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(item.direct_polymarket_url, item.assignment_id)}>
                    {copiedId === item.assignment_id ? <><Check className="w-3 h-3 mr-1 text-green-600" />Copied</> : <><Copy className="w-3 h-3 mr-1" />Copy</>}
                  </Button>
                  <a href={item.direct_polymarket_url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><ExternalLink className="w-3 h-3" /></Button></a>
                </div>
              </div>
            )}
            {item.clickvibe_links && item.clickvibe_links.length > 0 && item.clickvibe_links.map(cl => (
              <div key={cl.id} className="rounded-lg border p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">Clickvibe tracking link {cl.placement?.name ? `· ${cl.placement.name}` : ''}</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-slate-50 border rounded px-3 py-2 break-all">{cl.short_url}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(cl.short_url, cl.id)}>
                    {copiedId === cl.id ? <><Check className="w-3 h-3 mr-1 text-green-600" />Copied</> : <><Copy className="w-3 h-3 mr-1" />Copy</>}
                  </Button>
                </div>
              </div>
            ))}
            {!item.direct_polymarket_url && (!item.clickvibe_links || item.clickvibe_links.length === 0) && (
              <div className="text-sm text-slate-400 italic">No URL configured yet — ask your admin.</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
