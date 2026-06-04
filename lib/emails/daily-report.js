import { getDb } from '../db'
import { sendEmail } from '../email'

function yesterdayRange(timezone) {
  // Compute "yesterday" in the given IANA timezone. Returns ISO Y-M-D and the JS Date bounds in UTC.
  const tz = timezone || process.env.REPORTING_TIMEZONE || 'America/New_York'
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
  const todayLocal = fmt.format(now) // YYYY-MM-DD in TZ
  const [ty, tm, td] = todayLocal.split('-').map(Number)
  // yesterday local
  const ydt = new Date(Date.UTC(ty, tm - 1, td))
  ydt.setUTCDate(ydt.getUTCDate() - 1)
  const yLocal = ydt.toISOString().slice(0, 10)
  // bounds: yLocal 00:00 local to 23:59:59.999 local. Approx via UTC offsets is complex; use string compare on event_time.
  return { date: yLocal }
}

async function aggregateForPublisher(db, publisher_id, yDate) {
  const dayStart = new Date(yDate + 'T00:00:00Z')
  const dayEnd = new Date(yDate + 'T23:59:59Z')
  const clickMatch = { publisher_id, created_at: { $gte: dayStart, $lte: dayEnd } }
  const totalClicks = await db.collection('clicks').countDocuments(clickMatch)
  const events = await db.collection('appsflyer_events').find({ publisher_id }).toArray()
  const f = events.filter(e => {
    if (!e.event_time) return false
    const t = new Date(e.event_time).getTime()
    return t >= dayStart.getTime() && t <= dayEnd.getTime()
  })
  const installs = f.filter(e => e.report_type === 'installs_report' || (e.event_name || '').toLowerCase() === 'install').length
  const evtCount = f.filter(e => !(e.report_type === 'installs_report')).length
  const revenue = f.reduce((s, e) => s + (parseFloat(e.event_revenue_usd) || 0), 0)
  // By campaign
  const campaigns = await db.collection('campaigns').find({}).toArray()
  const cMap = Object.fromEntries(campaigns.map(c => [c.id, c]))
  const placements = await db.collection('placements').find({ publisher_id }).toArray()
  const plMap = Object.fromEntries(placements.map(p => [p.id, p]))
  const byCampaign = new Map()
  const byPlacement = new Map()
  const clickByCampaign = await db.collection('clicks').aggregate([
    { $match: clickMatch },
    { $group: { _id: { c: '$campaign_id', p: '$placement_id' }, n: { $sum: 1 } } }
  ]).toArray()
  for (const r of clickByCampaign) {
    if (!byCampaign.has(r._id.c)) byCampaign.set(r._id.c, { name: cMap[r._id.c]?.campaign_name || r._id.c, clicks: 0, installs: 0, events: 0, revenue: 0 })
    byCampaign.get(r._id.c).clicks += r.n
    if (!byPlacement.has(r._id.p)) byPlacement.set(r._id.p, { name: plMap[r._id.p]?.name || r._id.p, clicks: 0, installs: 0, events: 0, revenue: 0 })
    byPlacement.get(r._id.p).clicks += r.n
  }
  for (const e of f) {
    const cid = e.internal_campaign_id
    const pid = e.placement_id
    if (!byCampaign.has(cid)) byCampaign.set(cid, { name: cMap[cid]?.campaign_name || (e.campaign || cid), clicks: 0, installs: 0, events: 0, revenue: 0 })
    if (!byPlacement.has(pid)) byPlacement.set(pid, { name: plMap[pid]?.name || pid, clicks: 0, installs: 0, events: 0, revenue: 0 })
    const isInstall = e.report_type === 'installs_report' || (e.event_name || '').toLowerCase() === 'install'
    const target1 = byCampaign.get(cid)
    const target2 = byPlacement.get(pid)
    if (isInstall) { target1.installs += 1; target2.installs += 1 } else { target1.events += 1; target2.events += 1 }
    target1.revenue += parseFloat(e.event_revenue_usd) || 0
    target2.revenue += parseFloat(e.event_revenue_usd) || 0
  }
  return {
    totals: { clicks: totalClicks, installs, events: evtCount, revenue: Math.round(revenue * 100) / 100, cvr: totalClicks ? installs / totalClicks : 0 },
    byCampaign: Array.from(byCampaign.values()).sort((a, b) => b.clicks - a.clicks),
    byPlacement: Array.from(byPlacement.values()).sort((a, b) => b.clicks - a.clicks),
  }
}

function csvFromBreakdowns({ byCampaign, byPlacement }) {
  const rows = []
  rows.push('Section,Name,Clicks,Installs,Events,Revenue,CVR')
  for (const r of byCampaign) {
    const cvr = r.clicks > 0 ? ((r.installs / r.clicks) * 100).toFixed(2) + '%' : '0%'
    rows.push(`Campaign,"${r.name}",${r.clicks},${r.installs},${r.events},${r.revenue.toFixed(2)},${cvr}`)
  }
  for (const r of byPlacement) {
    const cvr = r.clicks > 0 ? ((r.installs / r.clicks) * 100).toFixed(2) + '%' : '0%'
    rows.push(`Placement,"${r.name}",${r.clicks},${r.installs},${r.events},${r.revenue.toFixed(2)},${cvr}`)
  }
  return rows.join('\n')
}

function publisherHtml({ publisher, date, totals, byCampaign, byPlacement }) {
  const t = totals
  const row = (r) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${r.name}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${r.clicks}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${r.installs}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${r.events}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">$${r.revenue.toFixed(2)}</td></tr>`
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial;background:#f8fafc;padding:24px;color:#0f172a">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#2563eb;color:#fff;padding:20px 24px"><div style="font-size:20px;font-weight:700">Clickvibe — Daily Report</div><div style="opacity:.9;margin-top:4px">${publisher.name} · ${date}</div></div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="background:#f1f5f9;padding:12px;border-radius:8px;width:25%"><div style="font-size:12px;color:#64748b">Clicks</div><div style="font-size:22px;font-weight:700">${t.clicks.toLocaleString()}</div></td>
        <td style="padding:0 6px"></td>
        <td style="background:#f1f5f9;padding:12px;border-radius:8px;width:25%"><div style="font-size:12px;color:#64748b">Installs</div><div style="font-size:22px;font-weight:700">${t.installs.toLocaleString()}</div></td>
        <td style="padding:0 6px"></td>
        <td style="background:#f1f5f9;padding:12px;border-radius:8px;width:25%"><div style="font-size:12px;color:#64748b">Events</div><div style="font-size:22px;font-weight:700">${t.events.toLocaleString()}</div></td></tr>
        <tr><td colspan="5" style="padding-top:8px"></td></tr>
        <tr><td style="background:#dbeafe;padding:12px;border-radius:8px;width:25%"><div style="font-size:12px;color:#1d4ed8">CVR</div><div style="font-size:22px;font-weight:700">${(t.cvr * 100).toFixed(2)}%</div></td>
        <td style="padding:0 6px"></td>
        <td colspan="3" style="background:#dcfce7;padding:12px;border-radius:8px"><div style="font-size:12px;color:#15803d">Payout / Revenue</div><div style="font-size:22px;font-weight:700">$${t.revenue.toFixed(2)}</div></td></tr>
      </table>
      <div style="font-weight:600;margin-bottom:8px">Top Campaigns</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px">
        <thead><tr style="background:#f8fafc"><th style="text-align:left;padding:8px 10px;font-size:12px;color:#64748b">Campaign</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Clicks</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Installs</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Events</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Payout</th></tr></thead>
        <tbody>${byCampaign.slice(0, 10).map(row).join('') || '<tr><td colspan=5 style="padding:12px;text-align:center;color:#94a3b8">No campaign data</td></tr>'}</tbody>
      </table>
      <div style="font-weight:600;margin-bottom:8px">Top Placements</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead><tr style="background:#f8fafc"><th style="text-align:left;padding:8px 10px;font-size:12px;color:#64748b">Placement</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Clicks</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Installs</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Events</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Payout</th></tr></thead>
        <tbody>${byPlacement.slice(0, 10).map(row).join('') || '<tr><td colspan=5 style="padding:12px;text-align:center;color:#94a3b8">No placement data</td></tr>'}</tbody>
      </table>
      <p style="font-size:12px;color:#64748b;margin-top:24px">Full breakdown attached as CSV. Log in to your dashboard for live data.</p>
    </div>
  </div></body></html>`
}

function adminHtml({ date, totals, topPubs, topCmps, failedImports }) {
  const t = totals
  const pubRow = (r) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${r.name}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${r.clicks}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${r.installs}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">$${r.revenue.toFixed(2)}</td></tr>`
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial;background:#f8fafc;padding:24px;color:#0f172a">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#1e3a8a;color:#fff;padding:20px 24px"><div style="font-size:20px;font-weight:700">Clickvibe Admin — Daily Summary</div><div style="opacity:.9;margin-top:4px">${date}</div></div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr><td style="background:#f1f5f9;padding:12px;border-radius:8px"><div style="font-size:12px;color:#64748b">Total Clicks</div><div style="font-size:22px;font-weight:700">${t.clicks.toLocaleString()}</div></td>
        <td style="padding:0 6px"></td>
        <td style="background:#f1f5f9;padding:12px;border-radius:8px"><div style="font-size:12px;color:#64748b">Installs</div><div style="font-size:22px;font-weight:700">${t.installs.toLocaleString()}</div></td>
        <td style="padding:0 6px"></td>
        <td style="background:#f1f5f9;padding:12px;border-radius:8px"><div style="font-size:12px;color:#64748b">Events</div><div style="font-size:22px;font-weight:700">${t.events.toLocaleString()}</div></td>
        <td style="padding:0 6px"></td>
        <td style="background:#dcfce7;padding:12px;border-radius:8px"><div style="font-size:12px;color:#15803d">Revenue</div><div style="font-size:22px;font-weight:700">$${t.revenue.toFixed(2)}</div></td></tr>
      </table>
      <div style="font-weight:600;margin-bottom:8px">Top Publishers</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px">
        <thead><tr style="background:#f8fafc"><th style="text-align:left;padding:8px 10px;font-size:12px;color:#64748b">Publisher</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Clicks</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Installs</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Revenue</th></tr></thead>
        <tbody>${topPubs.slice(0, 10).map(pubRow).join('') || '<tr><td colspan=4 style="padding:12px;text-align:center;color:#94a3b8">No data</td></tr>'}</tbody>
      </table>
      <div style="font-weight:600;margin-bottom:8px">Top Campaigns</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px">
        <thead><tr style="background:#f8fafc"><th style="text-align:left;padding:8px 10px;font-size:12px;color:#64748b">Campaign</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Clicks</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Installs</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#64748b">Revenue</th></tr></thead>
        <tbody>${topCmps.slice(0, 10).map(pubRow).join('') || '<tr><td colspan=4 style="padding:12px;text-align:center;color:#94a3b8">No data</td></tr>'}</tbody>
      </table>
      ${failedImports.length > 0 ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;color:#991b1b"><div style="font-weight:600;margin-bottom:6px">⚠️ Failed AppsFlyer imports (last 24h)</div>${failedImports.map(f => `<div style="font-size:12px;margin-bottom:4px"><strong>${f.report_type}</strong> ${f.from_date} → ${f.to_date}: ${f.error_message}</div>`).join('')}</div>` : ''}
      <p style="font-size:12px;color:#64748b;margin-top:20px">Full breakdown attached as CSV.</p>
    </div>
  </div></body></html>`
}

export async function sendDailyEmails({ forDate } = {}) {
  const db = await getDb()
  const settings = await db.collection('settings').findOne({ key: 'app' })
  if (settings && settings.daily_report_enabled === false) {
    return { skipped: true, reason: 'daily_report_enabled is false' }
  }
  const tz = settings?.timezone || process.env.REPORTING_TIMEZONE
  const date = forDate || yesterdayRange(tz).date

  const publishers = await db.collection('publishers').find({ status: 'active' }).toArray()
  const sentToPublishers = []
  for (const p of publishers) {
    try {
      if (!p.contact_email) continue
      const agg = await aggregateForPublisher(db, p.id, date)
      const html = publisherHtml({ publisher: p, date, ...agg })
      const csv = csvFromBreakdowns(agg)
      const csvB64 = Buffer.from(csv, 'utf-8').toString('base64')
      const r = await sendEmail({
        to: p.contact_email,
        subject: `Clickvibe Daily Report — ${p.name} — ${date}`,
        html,
        attachments: [{ filename: `report_${p.public_code}_${date}.csv`, content: csvB64 }],
      })
      await db.collection('daily_report_emails').insertOne({
        id: crypto.randomUUID(),
        recipient_email: p.contact_email,
        publisher_id: p.id,
        report_date: date,
        status: r.error ? 'failed' : 'sent',
        sent_at: new Date(),
        error_message: r.error ? String(r.error.message || r.error) : null,
      })
      sentToPublishers.push({ publisher: p.public_code, email: p.contact_email, ok: !r.error })
    } catch (e) {
      await db.collection('daily_report_emails').insertOne({
        id: crypto.randomUUID(),
        recipient_email: p.contact_email,
        publisher_id: p.id,
        report_date: date,
        status: 'failed',
        sent_at: new Date(),
        error_message: String(e.message || e),
      })
      sentToPublishers.push({ publisher: p.public_code, error: String(e.message || e) })
    }
  }

  // Admin summary
  const adminRecipients = settings?.daily_report_recipients || []
  let adminResult = null
  if (adminRecipients.length > 0) {
    const dayStart = new Date(date + 'T00:00:00Z')
    const dayEnd = new Date(date + 'T23:59:59Z')
    const clickMatch = { created_at: { $gte: dayStart, $lte: dayEnd } }
    const totalClicks = await db.collection('clicks').countDocuments(clickMatch)
    const events = await db.collection('appsflyer_events').find({}).toArray()
    const f = events.filter(e => e.event_time && new Date(e.event_time).getTime() >= dayStart.getTime() && new Date(e.event_time).getTime() <= dayEnd.getTime())
    const installs = f.filter(e => e.report_type === 'installs_report').length
    const eventCount = f.filter(e => e.report_type !== 'installs_report').length
    const revenue = f.reduce((s, e) => s + (parseFloat(e.event_revenue_usd) || 0), 0)
    // Top pubs
    const pubMap = new Map()
    const clickByPub = await db.collection('clicks').aggregate([
      { $match: clickMatch },
      { $group: { _id: '$publisher_id', n: { $sum: 1 } } }
    ]).toArray()
    const pubs = await db.collection('publishers').find({}).toArray()
    const pMap = Object.fromEntries(pubs.map(p => [p.id, p]))
    for (const r of clickByPub) pubMap.set(r._id, { name: pMap[r._id]?.name || r._id, clicks: r.n, installs: 0, events: 0, revenue: 0 })
    for (const e of f) {
      if (!e.publisher_id) continue
      if (!pubMap.has(e.publisher_id)) pubMap.set(e.publisher_id, { name: pMap[e.publisher_id]?.name || e.publisher_id, clicks: 0, installs: 0, events: 0, revenue: 0 })
      const row = pubMap.get(e.publisher_id)
      if (e.report_type === 'installs_report') row.installs += 1; else row.events += 1
      row.revenue += parseFloat(e.event_revenue_usd) || 0
    }
    // Top campaigns
    const cMap2 = new Map()
    const clickByCmp = await db.collection('clicks').aggregate([
      { $match: clickMatch },
      { $group: { _id: '$campaign_id', n: { $sum: 1 } } }
    ]).toArray()
    const cmps = await db.collection('campaigns').find({}).toArray()
    const cnMap = Object.fromEntries(cmps.map(c => [c.id, c]))
    for (const r of clickByCmp) cMap2.set(r._id, { name: cnMap[r._id]?.campaign_name || r._id, clicks: r.n, installs: 0, events: 0, revenue: 0 })
    for (const e of f) {
      const cid = e.internal_campaign_id
      if (!cid) continue
      if (!cMap2.has(cid)) cMap2.set(cid, { name: cnMap[cid]?.campaign_name || cid, clicks: 0, installs: 0, events: 0, revenue: 0 })
      const row = cMap2.get(cid)
      if (e.report_type === 'installs_report') row.installs += 1; else row.events += 1
      row.revenue += parseFloat(e.event_revenue_usd) || 0
    }
    const topPubs = Array.from(pubMap.values()).sort((a, b) => b.clicks - a.clicks)
    const topCmps = Array.from(cMap2.values()).sort((a, b) => b.clicks - a.clicks)
    const since = new Date(Date.now() - 24 * 3600 * 1000)
    const failedImports = await db.collection('appsflyer_raw_imports').find({ status: 'failed', created_at: { $gte: since } }).limit(20).toArray()
    const html = adminHtml({ date, totals: { clicks: totalClicks, installs, events: eventCount, revenue: Math.round(revenue * 100) / 100 }, topPubs, topCmps, failedImports })
    const csv = csvFromBreakdowns({ byCampaign: topCmps, byPlacement: topPubs.map(p => ({ ...p, name: 'pub:' + p.name })) })
    const csvB64 = Buffer.from(csv, 'utf-8').toString('base64')
    try {
      const r = await sendEmail({
        to: adminRecipients,
        subject: `Clickvibe Admin Daily Summary — ${date}`,
        html,
        attachments: [{ filename: `admin_summary_${date}.csv`, content: csvB64 }],
      })
      adminResult = { ok: !r.error, error: r.error ? String(r.error.message || r.error) : null }
    } catch (e) {
      adminResult = { ok: false, error: String(e.message || e) }
    }
  }

  return { date, publisher_count: sentToPublishers.length, admin: adminResult, results: sentToPublishers }
}
