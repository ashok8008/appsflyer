import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// ===== Header detection =====
// Canonical field names mapped to common header variants (case/space/punctuation insensitive)
const FIELD_ALIASES = {
  publisher_code: ['promo code', 'promo', 'code', 'publisher code', 'publisher', 'site', 'site id', 'partner', 'source', 'utm source'],
  date: ['date', 'report date', 'day', 'event date'],
  clicks: ['clicks', 'click'],
  installs: ['installs', 'install'],
  signups: ['signups', 'signup', 'registrations', 'registration', 'sign ups', 'sign-ups', 'sign up'],
  depositors: ['depositors', 'deposits', 'deposit', 'ftd', 'first time depositors', 'first-time depositors', 'first deposit'],
  traders: ['traders', 'trading users', 'trader'],
  qualified_paid: ['qualified', 'qualified paid', 'qualified users', 'qualifier'],
  cpa: ['cpa', 'cost per action'],
  cost: ['cost', 'payout', 'spend', 'commission'],
  revenue: ['revenue', 'rev', 'gross revenue'],
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[_\-/]/g, ' ').replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, ' ')
}

export function detectMapping(headers) {
  const mapping = {}
  const ambiguous = []
  const headerNorms = headers.map(h => ({ raw: h, norm: normalize(h) }))
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const matches = headerNorms.filter(h => aliases.some(a => h.norm === normalize(a)))
    if (matches.length === 1) {
      mapping[field] = matches[0].raw
    } else if (matches.length > 1) {
      ambiguous.push({ field, candidates: matches.map(m => m.raw) })
      mapping[field] = matches[0].raw // first match as default
    }
  }
  return { mapping, ambiguous }
}

// ===== File parsing =====

export function parseCsvBuffer(buf) {
  const text = buf.toString('utf-8')
  const out = Papa.parse(text, { header: true, skipEmptyLines: true })
  return { sheets: [{ name: 'csv', rows: out.data, headers: out.meta.fields || Object.keys(out.data[0] || {}) }] }
}

export function parseXlsxBuffer(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheets = []
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false })
    const headers = rows.length > 0 ? Object.keys(rows[0]) : []
    sheets.push({ name, rows, headers })
  }
  return { sheets }
}

export function parseUploadBuffer(buffer, fileName) {
  const lower = (fileName || '').toLowerCase()
  if (lower.endsWith('.csv')) return { ...parseCsvBuffer(buffer), file_type: 'csv' }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return { ...parseXlsxBuffer(buffer), file_type: 'xlsx' }
  // Try CSV by default
  try { return { ...parseCsvBuffer(buffer), file_type: 'csv' } } catch {}
  throw new Error('Unsupported file type. Use .csv, .xlsx or .xls')
}

// ===== Publisher matching =====

function publisherKeyFromUrl(url) {
  if (!url) return null
  const s = String(url).trim()
  // Match /S8ac/CODE or last URL segment
  const m = s.match(/\/([A-Za-z0-9_]+)\/?(?:\?|#|$)/)
  return m ? m[1] : null
}

export async function findPublisherByAlias(db, raw) {
  if (!raw) return null
  const value = String(raw).trim()
  if (!value) return null
  // 1. Exact public_code (case-insensitive)
  const upper = value.toUpperCase()
  let pub = await db.collection('publishers').findOne({ public_code: upper })
  if (pub) return pub
  // 2. Case-insensitive public_code
  pub = await db.collection('publishers').findOne({ public_code: { $regex: `^${escapeRegex(value)}$`, $options: 'i' } })
  if (pub) return pub
  // 3. Match by name (case-insensitive, ignoring spaces)
  const noSpace = value.replace(/\s+/g, '').toLowerCase()
  const pubs = await db.collection('publishers').find({}).toArray()
  pub = pubs.find(p => (p.name || '').replace(/\s+/g, '').toLowerCase() === noSpace || (p.public_code || '').toLowerCase() === noSpace)
  if (pub) return pub
  // 4. URL suffix
  const fromUrl = publisherKeyFromUrl(value)
  if (fromUrl) {
    pub = pubs.find(p => (p.public_code || '').toUpperCase() === fromUrl.toUpperCase() || (p.name || '').replace(/\s+/g, '').toLowerCase() === fromUrl.toLowerCase())
    if (pub) return pub
  }
  // 5. Code mapping aliases
  const alias = await db.collection('publisher_code_mappings').findOne({
    $or: [
      { alias_code: { $regex: `^${escapeRegex(value)}$`, $options: 'i' } },
      { alias_code: { $regex: `^${escapeRegex(noSpace)}$`, $options: 'i' } },
    ],
  })
  if (alias) {
    pub = await db.collection('publishers').findOne({ id: alias.publisher_id })
    if (pub) return pub
  }
  return null
}

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// ===== Row normalization =====

function num(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''))
  return isNaN(n) ? 0 : n
}

export function buildPerformanceRow({ row, mapping, defaultDate, defaultPublisherCode }) {
  const get = (field) => {
    const col = mapping[field]
    return col ? row[col] : null
  }
  return {
    publisher_code: get('publisher_code') || defaultPublisherCode || null,
    date: (get('date') ? String(get('date')).slice(0, 10) : null) || defaultDate || null,
    clicks: Math.round(num(get('clicks'))),
    installs: Math.round(num(get('installs'))),
    signups: Math.round(num(get('signups'))),
    depositors: Math.round(num(get('depositors'))),
    traders: Math.round(num(get('traders'))),
    qualified_paid: Math.round(num(get('qualified_paid'))),
    cpa: num(get('cpa')),
    cost: num(get('cost')),
    revenue: num(get('revenue')),
  }
}

// ===== Aggregate "TOTAL" sheet detection =====
export function isTotalSheetName(name) {
  return /^(total|totals|summary|grand total|all)$/i.test(String(name || '').trim())
}
