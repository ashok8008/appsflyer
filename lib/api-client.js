'use client'

const TOKEN_KEY = 'cv_token'

export function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t) {
  if (typeof window === 'undefined') return
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

export async function api(path, { method = 'GET', body, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (raw) return res
  let data = null
  const txt = await res.text()
  try { data = txt ? JSON.parse(txt) : null } catch { data = txt }
  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

export function downloadCsv(path) {
  const token = getToken()
  // Use fetch to grab CSV with auth, then trigger download.
  fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then(async r => {
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = path.split('/').pop().split('?')[0]
      a.click()
      URL.revokeObjectURL(url)
    })
}
