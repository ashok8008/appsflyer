import Papa from 'papaparse'

const RAW_BASE = process.env.APPSFLYER_BASE_URL
const AGG_BASE = process.env.APPSFLYER_AGG_BASE_URL
const MASTER_BASE = process.env.APPSFLYER_MASTER_BASE_URL
const APP_ID = process.env.APPSFLYER_APP_ID
const TOKEN = process.env.APPSFLYER_API_TOKEN

function authHeaders(accept = 'text/csv') {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: accept,
  }
}

function fmtDate(d) {
  if (typeof d === 'string') return d.slice(0, 10)
  return new Date(d).toISOString().slice(0, 10)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function withRetry(fn, { retries = 3, baseDelayMs = 1500, retryOn = (e) => true } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(attempt) } catch (e) {
      lastErr = e
      const isLast = attempt === retries
      const should = retryOn(e)
      if (isLast || !should) throw e
      const delay = baseDelayMs * Math.pow(2, attempt)
      await sleep(delay)
    }
  }
  throw lastErr
}

export async function fetchRawReport(reportType, fromDate, toDate, extra = {}) {
  const params = new URLSearchParams({
    from: fmtDate(fromDate),
    to: fmtDate(toDate),
    maximum_rows: '1000000',
    ...extra,
  })
  const url = `${RAW_BASE}/${APP_ID}/${reportType}/v5?${params.toString()}`
  return withRetry(async () => {
    const res = await fetch(url, { headers: authHeaders('text/csv') })
    if (!res.ok) {
      const text = await res.text()
      const e = new Error(`AppsFlyer raw ${reportType} failed (${res.status}): ${text.slice(0, 500)}`)
      e.status = res.status
      e.body = text
      throw e
    }
    const csv = await res.text()
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true })
    return parsed.data
  }, {
    retries: 2,
    baseDelayMs: 2000,
    // Don't retry 4xx except 429
    retryOn: (e) => !(e.status >= 400 && e.status < 500 && e.status !== 429),
  })
}

export async function fetchAggregatedJSON({ from, to, groupings, kpis }) {
  const params = new URLSearchParams({
    from: fmtDate(from),
    to: fmtDate(to),
    groupings: groupings.join(','),
    kpis: kpis.join(','),
    format: 'json',
  })
  const url = `${MASTER_BASE}/${APP_ID}?${params.toString()}`
  const res = await fetch(url, { headers: authHeaders('application/json') })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AppsFlyer master agg failed (${res.status}): ${text.slice(0, 500)}`)
  }
  const txt = await res.text()
  try { return JSON.parse(txt) } catch { return { raw: txt } }
}

function normalizeRow(row, reportType) {
  const get = (...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== '') return row[k]
    }
    return null
  }
  const revenue = parseFloat(get('Event Revenue', 'event_revenue')) || 0
  const revenueUsd = parseFloat(get('Event Revenue USD', 'event_revenue_usd')) || 0
  return {
    report_type: reportType,
    app_id: get('App ID', 'app_id'),
    media_source: get('Media Source', 'media_source', 'Partner', 'partner'),
    campaign: get('Campaign', 'campaign'),
    campaign_id: get('Campaign ID', 'campaign_id', 'af_c_id'),
    site_id: get('Site ID', 'site_id', 'af_siteid'),
    sub_site_id: get('Sub Site ID', 'sub_site_id', 'af_sub_siteid'),
    sub_param_1: get('Sub Param 1', 'af_sub1', 'sub_param_1'),
    sub_param_2: get('Sub Param 2', 'af_sub2', 'sub_param_2'),
    sub_param_3: get('Sub Param 3', 'af_sub3', 'sub_param_3'),
    sub_param_4: get('Sub Param 4', 'af_sub4', 'sub_param_4'),
    sub_param_5: get('Sub Param 5', 'af_sub5', 'sub_param_5'),
    click_id: get('Click ID', 'clickid', 'click_id'),
    event_name: get('Event Name', 'event_name') || (reportType.includes('install') ? 'install' : null),
    event_time: get('Event Time', 'event_time') || get('Install Time', 'install_time'),
    install_time: get('Install Time', 'install_time'),
    event_revenue: revenue,
    event_revenue_usd: revenueUsd,
    country_code: get('Country Code', 'country_code', 'Geo', 'geo'),
    appsflyer_id: get('AppsFlyer ID', 'appsflyer_id'),
    customer_user_id: get('Customer User ID', 'customer_user_id'),
    platform: get('Platform', 'platform'),
    original_url: get('Original URL', 'original_url'),
  }
}

// Stable dedupe key: prefer (report_type + click_id + event_name + event_time);
// fallback to (report_type + appsflyer_id + event_name + event_time)
function dedupeKey(norm) {
  if (norm.click_id) {
    return {
      report_type: norm.report_type,
      click_id: norm.click_id,
      event_name: norm.event_name,
      event_time: norm.event_time,
    }
  }
  return {
    report_type: norm.report_type,
    appsflyer_id: norm.appsflyer_id,
    event_name: norm.event_name,
    event_time: norm.event_time,
  }
}

export async function importRawReport(db, reportType, fromDate, toDate, { trigger = 'manual' } = {}) {
  const importId = crypto.randomUUID()
  const startedAt = new Date()
  const importDoc = {
    id: importId,
    report_type: reportType,
    from_date: fmtDate(fromDate),
    to_date: fmtDate(toDate),
    status: 'running',
    rows_imported: 0,
    total_rows: 0,
    error_message: null,
    trigger,
    duration_ms: null,
    created_at: startedAt,
    completed_at: null,
  }
  await db.collection('appsflyer_raw_imports').insertOne(importDoc)
  try {
    const rows = await fetchRawReport(reportType, fromDate, toDate)
    let inserted = 0
    for (const raw of rows) {
      const norm = normalizeRow(raw, reportType)
      if (!norm.event_time && !norm.install_time) continue
      const key = dedupeKey(norm)
      const existing = await db.collection('appsflyer_events').findOne(key)
      if (existing) continue
      const publisher = norm.site_id ? await db.collection('publishers').findOne({ public_code: norm.site_id }) : null
      const placement = norm.sub_site_id ? await db.collection('placements').findOne({ public_code: norm.sub_site_id }) : null
      const campaign = norm.campaign_id ? await db.collection('campaigns').findOne({ public_code: norm.campaign_id }) : null
      await db.collection('appsflyer_events').insertOne({
        id: crypto.randomUUID(),
        raw_row_id: null,
        ...norm,
        publisher_id: publisher?.id || null,
        placement_id: placement?.id || null,
        internal_campaign_id: campaign?.id || null,
        created_at: new Date(),
      })
      inserted++
    }
    const endedAt = new Date()
    await db.collection('appsflyer_raw_imports').updateOne(
      { id: importId },
      { $set: { status: 'success', rows_imported: inserted, total_rows: rows.length, completed_at: endedAt, duration_ms: endedAt - startedAt } }
    )
    return { importId, rows_imported: inserted, total_rows: rows.length, duration_ms: endedAt - startedAt }
  } catch (e) {
    const endedAt = new Date()
    await db.collection('appsflyer_raw_imports').updateOne(
      { id: importId },
      { $set: { status: 'failed', error_message: String(e.message || e), completed_at: endedAt, duration_ms: endedAt - startedAt } }
    )
    // Log failure notification
    await db.collection('notifications').insertOne({
      id: crypto.randomUUID(),
      type: 'sync_failed',
      severity: 'error',
      report_type: reportType,
      from_date: fmtDate(fromDate),
      to_date: fmtDate(toDate),
      message: String(e.message || e),
      created_at: new Date(),
      read: false,
    })
    throw e
  }
}
