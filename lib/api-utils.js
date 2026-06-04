import { NextResponse } from 'next/server'

export function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

export function json(data, init) {
  return cors(NextResponse.json(data, init))
}

export function err(message, status = 400) {
  return json({ error: message }, { status })
}

export function shortCode(prefix = '') {
  const s = Math.random().toString(36).slice(2, 10)
  return prefix ? `${prefix}_${s}` : s
}

export function parseDateRange(searchParams) {
  const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)
  const from = searchParams.get('from') || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  return { from, to }
}
