import { getDb } from './db'
import { hashPassword } from './auth'
import { v4 as uuidv4 } from 'uuid'

let seeded = false

export async function ensureSeeded() {
  if (seeded) return
  const db = await getDb()
  const existing = await db.collection('users').findOne({ email: process.env.SEED_SUPER_ADMIN_EMAIL })
  if (!existing) {
    const hash = await hashPassword(process.env.SEED_SUPER_ADMIN_PASSWORD || 'admin123')
    await db.collection('users').insertOne({
      id: uuidv4(),
      name: process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin',
      email: process.env.SEED_SUPER_ADMIN_EMAIL,
      password_hash: hash,
      role: 'super_admin',
      publisher_id: null,
      status: 'active',
      last_login_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    })
  }
  // Default settings
  const settings = await db.collection('settings').findOne({ key: 'app' })
  if (!settings) {
    await db.collection('settings').insertOne({
      key: 'app',
      appsflyer_pid: process.env.DEFAULT_APPSFLYER_PID || 'Clickvibe',
      appsflyer_app_id: process.env.APPSFLYER_APP_ID,
      platform: process.env.APP_PLATFORM || 'ios',
      timezone: process.env.REPORTING_TIMEZONE || 'America/New_York',
      currency: process.env.DEFAULT_CURRENCY || 'USD',
      tracking_base_url: process.env.TRACKING_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL,
      daily_report_recipients: [],
      daily_report_enabled: true,
      updated_at: new Date(),
    })
  }
  seeded = true
}
