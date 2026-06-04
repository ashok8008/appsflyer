import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb, strip } from '@/lib/db'
import { signToken, hashPassword, verifyPassword, getUserFromRequest, requireRole } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { importRawReport, fetchAggregatedJSON } from '@/lib/appsflyer'
import { cors, json, err, shortCode, parseDateRange } from '@/lib/api-utils'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }))
}

// ---------- helpers ----------

async function getSettings(db) {
  return await db.collection('settings').findOne({ key: 'app' })
}

function buildAppsFlyerRedirect({ appId, pid, campaign, campaignId, publisherId, placementId, sub1, sub2, sub3, sub4, sub5, clickId }) {
  const params = new URLSearchParams()
  params.set('pid', pid)
  if (campaign) params.set('c', campaign)
  if (campaignId) params.set('af_c_id', campaignId)
  if (publisherId) params.set('af_siteid', publisherId)
  if (placementId) params.set('af_sub_siteid', placementId)
  if (sub1) params.set('af_sub1', sub1)
  if (sub2) params.set('af_sub2', sub2)
  if (sub3) params.set('af_sub3', sub3)
  if (sub4) params.set('af_sub4', sub4)
  if (sub5) params.set('af_sub5', sub5)
  if (clickId) params.set('clickid', clickId)
  return `https://app.appsflyer.com/${appId}?${params.toString()}`
}

async function audit(db, user, action, target_type, target_id, meta = {}) {
  try {
    await db.collection('audit_logs').insertOne({
      id: uuidv4(),
      user_id: user?.id || null,
      user_email: user?.email || null,
      action,
      target_type,
      target_id,
      meta,
      created_at: new Date(),
    })
  } catch {}
}

// CSV helpers
function toCsv(rows, headers) {
  const escape = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const head = headers.join(',')
  const body = rows.map(r => headers.map(h => escape(r[h])).join(',')).join('\n')
  return head + '\n' + body
}

// ---------- aggregated reports ----------

async function aggregateReports(db, { from, to, publisher_id, campaign_id, placement_id, country, group_by }) {
  const startDt = new Date(from + 'T00:00:00Z')
  const endDt = new Date(to + 'T23:59:59Z')

  // clicks aggregate
  const clickMatch = { created_at: { $gte: startDt, $lte: endDt } }
  if (publisher_id) clickMatch.publisher_id = publisher_id
  if (campaign_id) clickMatch.campaign_id = campaign_id
  if (placement_id) clickMatch.placement_id = placement_id
  if (country) clickMatch.country = country

  // events aggregate
  const evtMatch = { event_time: { $exists: true, $ne: null } }
  if (publisher_id) evtMatch.publisher_id = publisher_id
  if (campaign_id) evtMatch.internal_campaign_id = campaign_id
  if (placement_id) evtMatch.placement_id = placement_id
  if (country) evtMatch.country_code = country
  // For events we use event_time strings as ISO from AppsFlyer; we'll filter post-load by date
  const events = await db.collection('appsflyer_events').find(evtMatch).toArray()
  const filteredEvents = events.filter(e => {
    if (!e.event_time) return false
    const t = new Date(e.event_time).getTime()
    return t >= startDt.getTime() && t <= endDt.getTime()
  })

  const totalClicks = await db.collection('clicks').countDocuments(clickMatch)
  const installs = filteredEvents.filter(e => e.report_type === 'installs_report' || (e.event_name || '').toLowerCase() === 'install').length
  const eventCount = filteredEvents.filter(e => !(e.report_type === 'installs_report')).length
  const revenue = filteredEvents.reduce((s, e) => s + (parseFloat(e.event_revenue_usd) || 0), 0)

  // breakdowns
  async function buildBreakdown(keyClicks, keyEvents) {
    const m = new Map()
    const clickAgg = await db.collection('clicks').aggregate([
      { $match: clickMatch },
      { $group: { _id: '$' + keyClicks, clicks: { $sum: 1 } } },
    ]).toArray()
    for (const c of clickAgg) {
      const key = c._id || 'unknown'
      m.set(key, { key, clicks: c.clicks, installs: 0, events: 0, revenue: 0 })
    }
    for (const e of filteredEvents) {
      const key = e[keyEvents] || 'unknown'
      if (!m.has(key)) m.set(key, { key, clicks: 0, installs: 0, events: 0, revenue: 0 })
      const row = m.get(key)
      if (e.report_type === 'installs_report' || (e.event_name || '').toLowerCase() === 'install') row.installs += 1
      else row.events += 1
      row.revenue += parseFloat(e.event_revenue_usd) || 0
    }
    return Array.from(m.values()).map(r => ({
      ...r,
      cvr: r.clicks > 0 ? (r.installs / r.clicks) : 0,
      ecpi: r.installs > 0 ? (r.revenue / r.installs) : 0,
    })).sort((a, b) => b.clicks - a.clicks)
  }

  let breakdown = null
  if (group_by === 'publisher') breakdown = await buildBreakdown('publisher_id', 'publisher_id')
  else if (group_by === 'campaign') breakdown = await buildBreakdown('campaign_id', 'internal_campaign_id')
  else if (group_by === 'placement') breakdown = await buildBreakdown('placement_id', 'placement_id')
  else if (group_by === 'country') breakdown = await buildBreakdown('country', 'country_code')
  else if (group_by === 'sub_id_1') breakdown = await buildBreakdown('sub_id_1', 'sub_param_1')
  else if (group_by === 'sub_id_2') breakdown = await buildBreakdown('sub_id_2', 'sub_param_2')

  // daily series
  const seriesMap = new Map()
  const clickByDay = await db.collection('clicks').aggregate([
    { $match: clickMatch },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, clicks: { $sum: 1 } } },
  ]).toArray()
  for (const c of clickByDay) seriesMap.set(c._id, { date: c._id, clicks: c.clicks, installs: 0, events: 0, revenue: 0 })
  for (const e of filteredEvents) {
    const d = new Date(e.event_time).toISOString().slice(0, 10)
    if (!seriesMap.has(d)) seriesMap.set(d, { date: d, clicks: 0, installs: 0, events: 0, revenue: 0 })
    const r = seriesMap.get(d)
    if (e.report_type === 'installs_report' || (e.event_name || '').toLowerCase() === 'install') r.installs += 1
    else r.events += 1
    r.revenue += parseFloat(e.event_revenue_usd) || 0
  }
  const series = Array.from(seriesMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  return {
    totals: {
      clicks: totalClicks,
      installs,
      events: eventCount,
      revenue: Math.round(revenue * 100) / 100,
      cvr: totalClicks > 0 ? installs / totalClicks : 0,
      ecpi: installs > 0 ? revenue / installs : 0,
    },
    series,
    breakdown,
  }
}

// ---------- main router ----------

async function handle(request, { params }) {
  const path = '/' + ((params.path || []).join('/'))
  const method = request.method
  const url = new URL(request.url)

  try {
    const db = await getDb()
    await ensureSeeded()

    // ===== PUBLIC: click redirect =====
    if (path.startsWith('/click/') && method === 'GET') {
      const trackingCode = path.split('/')[2]
      const tl = await db.collection('tracking_links').findOne({ public_code: trackingCode })
      if (!tl || tl.status !== 'active') {
        return new NextResponse('Tracking link not found or inactive', { status: 404 })
      }
      const publisher = await db.collection('publishers').findOne({ id: tl.publisher_id })
      const campaign = await db.collection('campaigns').findOne({ id: tl.campaign_id })
      const placement = await db.collection('placements').findOne({ id: tl.placement_id })
      if (!publisher || publisher.status !== 'active') return new NextResponse('Publisher inactive', { status: 403 })
      if (!campaign || campaign.status !== 'active') return new NextResponse('Campaign inactive', { status: 403 })
      if (!placement || placement.status !== 'active') return new NextResponse('Placement inactive', { status: 403 })

      const settings = await getSettings(db)
      const clickId = 'cv_' + uuidv4().replace(/-/g, '').slice(0, 20)
      const sp = url.searchParams
      const sub1 = sp.get('sub_id_1') || sp.get('af_sub1')
      const sub2 = sp.get('sub_id_2') || sp.get('af_sub2')
      const sub3 = sp.get('sub_id_3') || sp.get('af_sub3')
      const sub4 = sp.get('sub_id_4') || sp.get('af_sub4')
      const sub5 = sp.get('referral_url') || sp.get('sub_id_5') || sp.get('af_sub5') || request.headers.get('referer') || null
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || null
      const ua = request.headers.get('user-agent') || null
      const cf_country = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country') || null

      const redirect = buildAppsFlyerRedirect({
        appId: campaign.appsflyer_app_id || settings.appsflyer_app_id,
        pid: campaign.appsflyer_pid || settings.appsflyer_pid,
        campaign: campaign.campaign_name,
        campaignId: campaign.public_code,
        publisherId: publisher.public_code,
        placementId: placement.public_code,
        sub1, sub2, sub3, sub4, sub5,
        clickId,
      })

      await db.collection('clicks').insertOne({
        id: uuidv4(),
        click_id: clickId,
        tracking_id: tl.id,
        tracking_code: tl.public_code,
        publisher_id: publisher.id,
        publisher_code: publisher.public_code,
        campaign_id: campaign.id,
        campaign_code: campaign.public_code,
        placement_id: placement.id,
        placement_code: placement.public_code,
        sub_id_1: sub1, sub_id_2: sub2, sub_id_3: sub3, sub_id_4: sub4, sub_id_5: sub5,
        referral_url: sub5,
        ip_address: ip,
        user_agent: ua,
        country: cf_country,
        device_type: /iPad|iPhone|iPod/.test(ua || '') ? 'ios' : /Android/.test(ua || '') ? 'android' : 'other',
        os: /iPhone|iPad|iPod/.test(ua || '') ? 'iOS' : /Android/.test(ua || '') ? 'Android' : 'Other',
        referrer: request.headers.get('referer'),
        redirected_url: redirect,
        created_at: new Date(),
      })

      return NextResponse.redirect(redirect, 302)
    }

    // ===== AUTH =====
    if (path === '/auth/login' && method === 'POST') {
      const { email, password } = await request.json()
      const user = await db.collection('users').findOne({ email: (email || '').toLowerCase().trim() })
      if (!user || user.status !== 'active') return err('Invalid credentials', 401)
      const ok = await verifyPassword(password, user.password_hash)
      if (!ok) return err('Invalid credentials', 401)
      await db.collection('users').updateOne({ id: user.id }, { $set: { last_login_at: new Date() } })
      const token = signToken({ id: user.id, email: user.email, role: user.role, publisher_id: user.publisher_id, name: user.name })
      return json({ token, user: strip(user) })
    }

    if (path === '/auth/me' && method === 'GET') {
      const u = getUserFromRequest(request)
      if (!u) return err('Unauthorized', 401)
      const user = await db.collection('users').findOne({ id: u.id })
      if (!user) return err('Unauthorized', 401)
      let publisher = null
      if (user.publisher_id) publisher = await db.collection('publishers').findOne({ id: user.publisher_id })
      return json({ user: strip(user), publisher: strip(publisher) })
    }

    // From here, auth required
    const user = getUserFromRequest(request)
    if (!user) return err('Unauthorized', 401)
    const isAdmin = ['admin', 'super_admin'].includes(user.role)
    const isPublisher = user.role === 'publisher'

    // ===== ADMIN: Publishers =====
    if (path === '/publishers' && method === 'GET' && isAdmin) {
      const list = await db.collection('publishers').find({}).sort({ created_at: -1 }).toArray()
      return json(strip(list))
    }
    if (path === '/publishers' && method === 'POST' && isAdmin) {
      const body = await request.json()
      const code = (body.public_code || body.name || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 32) || shortCode('PUB').toUpperCase()
      const doc = {
        id: uuidv4(),
        public_code: code,
        name: body.name,
        company_name: body.company_name || body.name,
        contact_name: body.contact_name || null,
        contact_email: body.contact_email || null,
        status: body.status || 'active',
        timezone: body.timezone || process.env.REPORTING_TIMEZONE,
        payment_terms: body.payment_terms || 'NET30',
        created_at: new Date(),
        updated_at: new Date(),
      }
      try {
        await db.collection('publishers').insertOne(doc)
      } catch (e) { return err('Publisher code already exists', 400) }
      await audit(db, user, 'create_publisher', 'publisher', doc.id, { name: doc.name })
      return json(strip(doc))
    }
    if (path.startsWith('/publishers/') && method === 'GET' && isAdmin) {
      const id = path.split('/')[2]
      const p = await db.collection('publishers').findOne({ id })
      if (!p) return err('Not found', 404)
      const users = await db.collection('users').find({ publisher_id: id }).toArray()
      const assigned = await db.collection('publisher_campaigns').find({ publisher_id: id }).toArray()
      return json({ publisher: strip(p), users: strip(users), assigned_campaigns: strip(assigned) })
    }
    if (path.startsWith('/publishers/') && method === 'PUT' && isAdmin) {
      const id = path.split('/')[2]
      const body = await request.json()
      delete body.id
      delete body.public_code
      body.updated_at = new Date()
      await db.collection('publishers').updateOne({ id }, { $set: body })
      const p = await db.collection('publishers').findOne({ id })
      await audit(db, user, 'update_publisher', 'publisher', id, body)
      return json(strip(p))
    }
    if (path.match(/^\/publishers\/[^/]+\/users$/) && method === 'POST' && isAdmin) {
      const publisher_id = path.split('/')[2]
      const body = await request.json()
      const hash = await hashPassword(body.password)
      const doc = {
        id: uuidv4(),
        name: body.name,
        email: body.email.toLowerCase().trim(),
        password_hash: hash,
        role: 'publisher',
        publisher_id,
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }
      try { await db.collection('users').insertOne(doc) } catch { return err('Email already exists', 400) }
      await audit(db, user, 'create_publisher_user', 'user', doc.id, { email: doc.email })
      return json(strip(doc))
    }

    // ===== ADMIN: Campaigns =====
    if (path === '/campaigns' && method === 'GET' && isAdmin) {
      const list = await db.collection('campaigns').find({}).sort({ created_at: -1 }).toArray()
      return json(strip(list))
    }
    if (path === '/campaigns' && method === 'POST' && isAdmin) {
      const body = await request.json()
      const settings = await getSettings(db)
      const code = (body.public_code || body.campaign_name || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 32) || shortCode('CMP').toUpperCase()
      const doc = {
        id: uuidv4(),
        public_code: code,
        campaign_name: body.campaign_name,
        app_name: body.app_name || body.campaign_name,
        appsflyer_app_id: body.appsflyer_app_id || settings.appsflyer_app_id,
        appsflyer_pid: body.appsflyer_pid || settings.appsflyer_pid,
        platform: body.platform || settings.platform || 'ios',
        payout_type: body.payout_type || 'CPI',
        payout_amount: parseFloat(body.payout_amount) || 0,
        currency: body.currency || settings.currency || 'USD',
        allowed_geos: body.allowed_geos || [],
        status: body.status || 'active',
        created_at: new Date(),
        updated_at: new Date(),
      }
      try { await db.collection('campaigns').insertOne(doc) } catch { return err('Campaign code already exists', 400) }
      await audit(db, user, 'create_campaign', 'campaign', doc.id, { name: doc.campaign_name })
      return json(strip(doc))
    }
    if (path.match(/^\/campaigns\/[^/]+$/) && method === 'PUT' && isAdmin) {
      const id = path.split('/')[2]
      const body = await request.json()
      delete body.id
      delete body.public_code
      body.updated_at = new Date()
      await db.collection('campaigns').updateOne({ id }, { $set: body })
      const c = await db.collection('campaigns').findOne({ id })
      return json(strip(c))
    }
    if (path.match(/^\/campaigns\/[^/]+\/assign$/) && method === 'POST' && isAdmin) {
      const campaign_id = path.split('/')[2]
      const body = await request.json()
      const existing = await db.collection('publisher_campaigns').findOne({ publisher_id: body.publisher_id, campaign_id })
      if (existing) return err('Already assigned', 400)
      const doc = {
        id: uuidv4(),
        publisher_id: body.publisher_id,
        campaign_id,
        status: 'active',
        custom_payout_type: body.custom_payout_type || null,
        custom_payout_amount: body.custom_payout_amount ? parseFloat(body.custom_payout_amount) : null,
        created_at: new Date(),
        updated_at: new Date(),
      }
      await db.collection('publisher_campaigns').insertOne(doc)
      return json(strip(doc))
    }
    if (path.match(/^\/publisher-campaigns\/[^/]+$/) && method === 'DELETE' && isAdmin) {
      const id = path.split('/')[2]
      await db.collection('publisher_campaigns').deleteOne({ id })
      return json({ ok: true })
    }

    // ===== ADMIN: Placements =====
    if (path === '/placements' && method === 'GET' && isAdmin) {
      const publisher_id = url.searchParams.get('publisher_id')
      const filter = {}
      if (publisher_id) filter.publisher_id = publisher_id
      const list = await db.collection('placements').find(filter).sort({ created_at: -1 }).toArray()
      return json(strip(list))
    }
    if (path === '/placements' && method === 'POST' && isAdmin) {
      const body = await request.json()
      const publisher = await db.collection('publishers').findOne({ id: body.publisher_id })
      if (!publisher) return err('Publisher not found', 400)
      const code = (body.public_code || `${publisher.public_code}_${body.name || ''}`).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 48) || shortCode('plc')
      const doc = {
        id: uuidv4(),
        public_code: code,
        publisher_id: body.publisher_id,
        campaign_id: body.campaign_id || null,
        name: body.name,
        source_type: body.source_type || 'web',
        status: body.status || 'active',
        created_at: new Date(),
        updated_at: new Date(),
      }
      try { await db.collection('placements').insertOne(doc) } catch { return err('Placement code already exists', 400) }
      return json(strip(doc))
    }
    if (path.match(/^\/placements\/[^/]+$/) && method === 'PUT' && isAdmin) {
      const id = path.split('/')[2]
      const body = await request.json()
      delete body.id; delete body.public_code
      body.updated_at = new Date()
      await db.collection('placements').updateOne({ id }, { $set: body })
      const p = await db.collection('placements').findOne({ id })
      return json(strip(p))
    }

    // ===== ADMIN: Tracking Links =====
    if (path === '/tracking-links' && method === 'GET' && isAdmin) {
      const list = await db.collection('tracking_links').find({}).sort({ created_at: -1 }).toArray()
      const settings = await getSettings(db)
      const base = settings.tracking_base_url
      return json(strip(list).map(l => ({ ...l, short_url: `${base}/api/click/${l.public_code}` })))
    }
    if (path === '/tracking-links' && method === 'POST' && isAdmin) {
      const body = await request.json()
      const code = shortCode()
      const settings = await getSettings(db)
      const doc = {
        id: uuidv4(),
        public_code: code,
        publisher_id: body.publisher_id,
        campaign_id: body.campaign_id,
        placement_id: body.placement_id,
        destination_appsflyer_url_template: null,
        short_url: `${settings.tracking_base_url}/api/click/${code}`,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      }
      await db.collection('tracking_links').insertOne(doc)
      return json(strip(doc))
    }
    if (path.match(/^\/tracking-links\/[^/]+$/) && method === 'PUT' && isAdmin) {
      const id = path.split('/')[2]
      const body = await request.json()
      delete body.id; delete body.public_code
      body.updated_at = new Date()
      await db.collection('tracking_links').updateOne({ id }, { $set: body })
      const t = await db.collection('tracking_links').findOne({ id })
      return json(strip(t))
    }

    // ===== ADMIN: Users =====
    if (path === '/users' && method === 'GET' && isAdmin) {
      const list = await db.collection('users').find({ role: { $in: ['admin', 'super_admin'] } }).toArray()
      return json(strip(list))
    }
    if (path === '/users' && method === 'POST' && requireRole(user, ['super_admin'])) {
      const body = await request.json()
      const hash = await hashPassword(body.password)
      const doc = {
        id: uuidv4(),
        name: body.name,
        email: body.email.toLowerCase().trim(),
        password_hash: hash,
        role: body.role || 'admin',
        publisher_id: null,
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }
      try { await db.collection('users').insertOne(doc) } catch { return err('Email already exists', 400) }
      return json(strip(doc))
    }

    // ===== ADMIN: Settings =====
    if (path === '/settings' && method === 'GET' && isAdmin) {
      const s = await getSettings(db)
      return json(strip(s))
    }
    if (path === '/settings' && method === 'PUT' && isAdmin) {
      const body = await request.json()
      delete body.key
      body.updated_at = new Date()
      await db.collection('settings').updateOne({ key: 'app' }, { $set: body })
      const s = await getSettings(db)
      return json(strip(s))
    }

    // ===== ADMIN: AppsFlyer Sync =====
    if (path === '/appsflyer/sync' && method === 'POST' && isAdmin) {
      const body = await request.json().catch(() => ({}))
      const days = parseInt(body.days || '7')
      const to = new Date().toISOString().slice(0, 10)
      const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
      const reports = body.reports || ['installs_report', 'in_app_events_report']
      const results = []
      for (const rt of reports) {
        try {
          const res = await importRawReport(db, rt, from, to)
          results.push({ report: rt, ...res })
        } catch (e) {
          results.push({ report: rt, error: String(e.message || e) })
        }
      }
      await audit(db, user, 'appsflyer_sync', 'system', null, { from, to, reports })
      return json({ from, to, results })
    }
    if (path === '/appsflyer/imports' && method === 'GET' && isAdmin) {
      const list = await db.collection('appsflyer_raw_imports').find({}).sort({ created_at: -1 }).limit(50).toArray()
      return json(strip(list))
    }
    if (path === '/appsflyer/aggregated' && method === 'GET' && isAdmin) {
      const from = url.searchParams.get('from') || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
      const to = url.searchParams.get('to') || new Date().toISOString().slice(0, 10)
      const groupings = (url.searchParams.get('groupings') || 'pid,c,af_siteid').split(',')
      const kpis = (url.searchParams.get('kpis') || 'clicks,installs,loyal_users,revenue').split(',')
      try {
        const data = await fetchAggregatedJSON({ from, to, groupings, kpis })
        return json(data)
      } catch (e) {
        return err(String(e.message || e), 500)
      }
    }

    // ===== ADMIN: Reports =====
    if (path === '/reports/overview' && method === 'GET' && isAdmin) {
      const { from, to } = parseDateRange(url.searchParams)
      const filters = {
        from, to,
        publisher_id: url.searchParams.get('publisher_id') || undefined,
        campaign_id: url.searchParams.get('campaign_id') || undefined,
        placement_id: url.searchParams.get('placement_id') || undefined,
        country: url.searchParams.get('country') || undefined,
        group_by: url.searchParams.get('group_by') || undefined,
      }
      const data = await aggregateReports(db, filters)
      // Add lookup info for breakdown
      if (data.breakdown && filters.group_by === 'publisher') {
        const pubs = await db.collection('publishers').find({}).toArray()
        const map = Object.fromEntries(pubs.map(p => [p.id, p]))
        data.breakdown = data.breakdown.map(b => ({ ...b, name: map[b.key]?.name || b.key, code: map[b.key]?.public_code }))
      }
      if (data.breakdown && filters.group_by === 'campaign') {
        const cs = await db.collection('campaigns').find({}).toArray()
        const map = Object.fromEntries(cs.map(p => [p.id, p]))
        data.breakdown = data.breakdown.map(b => ({ ...b, name: map[b.key]?.campaign_name || b.key, code: map[b.key]?.public_code }))
      }
      if (data.breakdown && filters.group_by === 'placement') {
        const ps = await db.collection('placements').find({}).toArray()
        const map = Object.fromEntries(ps.map(p => [p.id, p]))
        data.breakdown = data.breakdown.map(b => ({ ...b, name: map[b.key]?.name || b.key, code: map[b.key]?.public_code }))
      }
      return json(data)
    }

    if (path === '/reports/export.csv' && method === 'GET' && isAdmin) {
      const { from, to } = parseDateRange(url.searchParams)
      const groupBy = url.searchParams.get('group_by') || 'publisher'
      const data = await aggregateReports(db, { from, to, group_by: groupBy })
      const headers = ['key', 'name', 'code', 'clicks', 'installs', 'events', 'revenue', 'cvr', 'ecpi']
      const rows = (data.breakdown || []).map(r => ({ ...r, cvr: (r.cvr * 100).toFixed(2) + '%', ecpi: r.ecpi.toFixed(2) }))
      const csv = toCsv(rows, headers)
      const res = new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="report_${groupBy}_${from}_${to}.csv"` } })
      return cors(res)
    }

    // ===== PUBLISHER scope =====
    if (path === '/publisher/me' && method === 'GET' && isPublisher) {
      const p = await db.collection('publishers').findOne({ id: user.publisher_id })
      return json(strip(p))
    }
    if (path === '/publisher/campaigns' && method === 'GET' && isPublisher) {
      const assigns = await db.collection('publisher_campaigns').find({ publisher_id: user.publisher_id, status: 'active' }).toArray()
      const campaignIds = assigns.map(a => a.campaign_id)
      const campaigns = await db.collection('campaigns').find({ id: { $in: campaignIds }, status: 'active' }).toArray()
      const cMap = Object.fromEntries(campaigns.map(c => [c.id, c]))
      const out = assigns.map(a => ({ ...strip(a), campaign: strip(cMap[a.campaign_id]) })).filter(x => x.campaign)
      return json(out)
    }
    if (path === '/publisher/tracking-links' && method === 'GET' && isPublisher) {
      const list = await db.collection('tracking_links').find({ publisher_id: user.publisher_id }).sort({ created_at: -1 }).toArray()
      const settings = await getSettings(db)
      const campaigns = await db.collection('campaigns').find({}).toArray()
      const placements = await db.collection('placements').find({}).toArray()
      const cMap = Object.fromEntries(campaigns.map(c => [c.id, c]))
      const pMap = Object.fromEntries(placements.map(p => [p.id, p]))
      return json(strip(list).map(l => ({
        ...l,
        short_url: `${settings.tracking_base_url}/api/click/${l.public_code}`,
        campaign: strip(cMap[l.campaign_id]),
        placement: strip(pMap[l.placement_id]),
      })))
    }
    if (path === '/publisher/reports/overview' && method === 'GET' && isPublisher) {
      const { from, to } = parseDateRange(url.searchParams)
      const filters = {
        from, to,
        publisher_id: user.publisher_id,
        campaign_id: url.searchParams.get('campaign_id') || undefined,
        placement_id: url.searchParams.get('placement_id') || undefined,
        country: url.searchParams.get('country') || undefined,
        group_by: url.searchParams.get('group_by') || undefined,
      }
      const data = await aggregateReports(db, filters)
      if (data.breakdown && filters.group_by === 'campaign') {
        const cs = await db.collection('campaigns').find({}).toArray()
        const map = Object.fromEntries(cs.map(p => [p.id, p]))
        data.breakdown = data.breakdown.map(b => ({ ...b, name: map[b.key]?.campaign_name || b.key }))
      }
      if (data.breakdown && filters.group_by === 'placement') {
        const ps = await db.collection('placements').find({}).toArray()
        const map = Object.fromEntries(ps.map(p => [p.id, p]))
        data.breakdown = data.breakdown.map(b => ({ ...b, name: map[b.key]?.name || b.key }))
      }
      return json(data)
    }
    if (path === '/publisher/reports/export.csv' && method === 'GET' && isPublisher) {
      const { from, to } = parseDateRange(url.searchParams)
      const groupBy = url.searchParams.get('group_by') || 'campaign'
      const data = await aggregateReports(db, { from, to, publisher_id: user.publisher_id, group_by: groupBy })
      const headers = ['key', 'name', 'clicks', 'installs', 'events', 'revenue', 'cvr', 'ecpi']
      const rows = (data.breakdown || []).map(r => ({ ...r, cvr: (r.cvr * 100).toFixed(2) + '%', ecpi: r.ecpi.toFixed(2) }))
      const csv = toCsv(rows, headers)
      const res = new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="my_report_${groupBy}_${from}_${to}.csv"` } })
      return cors(res)
    }

    // ===== root =====
    if (path === '/' && method === 'GET') return json({ message: 'Clickvibe Dashboard API', ok: true })

    return err(`Route ${path} not found`, 404)
  } catch (e) {
    console.error('API Error:', e)
    return err('Internal server error: ' + (e.message || ''), 500)
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
export const PATCH = handle
