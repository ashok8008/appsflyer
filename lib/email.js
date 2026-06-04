import { Resend } from 'resend'

let client
function getClient() {
  if (!client) client = new Resend(process.env.RESEND_API_KEY)
  return client
}

export async function sendEmail({ to, subject, html, attachments }) {
  const from = process.env.RESEND_FROM_EMAIL || 'reports@clickvibe.ai'
  return getClient().emails.send({ from, to, subject, html, attachments })
}
