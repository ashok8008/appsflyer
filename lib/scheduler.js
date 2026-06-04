import { getDb } from './db'
import { importRawReport } from './appsflyer'
import { sendDailyEmails } from './emails/daily-report'

let started = false
let runtimeState = {
  lastHourlyRun: null,
  lastNightlyRun: null,
  lastEmailRun: null,
  currentlyRunning: null,
}

async function runHourlySync() {
  if (runtimeState.currentlyRunning) {
    console.log('[scheduler] sync already running, skipping')
    return
  }
  runtimeState.currentlyRunning = 'hourly'
  const startedAt = new Date()
  try {
    const db = await getDb()
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10)
    const reports = ['installs_report', 'in_app_events_report']
    for (const rt of reports) {
      try { await importRawReport(db, rt, from, to, { trigger: 'hourly_cron' }) }
      catch (e) { console.error(`[scheduler] hourly ${rt} failed:`, e.message) }
    }
    runtimeState.lastHourlyRun = { at: startedAt, completed: new Date() }
    console.log('[scheduler] hourly sync done')
  } finally {
    runtimeState.currentlyRunning = null
  }
}

async function runNightlyResync() {
  if (runtimeState.currentlyRunning) return
  runtimeState.currentlyRunning = 'nightly'
  const startedAt = new Date()
  try {
    const db = await getDb()
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const reports = ['installs_report', 'in_app_events_report']
    for (const rt of reports) {
      try { await importRawReport(db, rt, from, to, { trigger: 'nightly_cron' }) }
      catch (e) { console.error(`[scheduler] nightly ${rt} failed:`, e.message) }
    }
    runtimeState.lastNightlyRun = { at: startedAt, completed: new Date() }
    console.log('[scheduler] nightly resync done')
  } finally {
    runtimeState.currentlyRunning = null
  }
}

async function runDailyEmails() {
  const startedAt = new Date()
  try {
    const result = await sendDailyEmails()
    runtimeState.lastEmailRun = { at: startedAt, completed: new Date(), ...result }
    console.log('[scheduler] daily emails sent', result)
  } catch (e) {
    console.error('[scheduler] daily emails failed:', e.message)
  }
}

export async function startScheduler() {
  if (started) return
  started = true
  // Dynamically import node-cron (CJS)
  const cron = (await import('node-cron')).default
  // Hourly sync — at minute 7 every hour
  cron.schedule('7 * * * *', () => { runHourlySync().catch(e => console.error(e)) })
  // Nightly re-sync last 7 days — at 03:15 ET
  cron.schedule('15 3 * * *', () => { runNightlyResync().catch(e => console.error(e)) }, { timezone: process.env.REPORTING_TIMEZONE || 'America/New_York' })
  // Daily emails — at 08:00 ET
  cron.schedule('0 8 * * *', () => { runDailyEmails().catch(e => console.error(e)) }, { timezone: process.env.REPORTING_TIMEZONE || 'America/New_York' })
  console.log('[scheduler] started: hourly :07, nightly 03:15 ET, emails 08:00 ET')
}

export function getSchedulerState() {
  return { started, ...runtimeState }
}

export { runHourlySync, runNightlyResync, runDailyEmails }
