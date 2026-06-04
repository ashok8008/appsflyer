import { MongoClient } from 'mongodb'

let client
let db

export async function getDb() {
  if (!db) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
    await ensureIndexes(db)
  }
  return db
}

async function ensureIndexes(db) {
  try {
    await db.collection('users').createIndex({ email: 1 }, { unique: true })
    await db.collection('publishers').createIndex({ public_code: 1 }, { unique: true })
    await db.collection('campaigns').createIndex({ public_code: 1 }, { unique: true })
    await db.collection('placements').createIndex({ public_code: 1 }, { unique: true })
    await db.collection('tracking_links').createIndex({ public_code: 1 }, { unique: true })
    await db.collection('clicks').createIndex({ click_id: 1 }, { unique: true })
    await db.collection('clicks').createIndex({ tracking_id: 1, created_at: -1 })
    await db.collection('clicks').createIndex({ publisher_id: 1, created_at: -1 })
    await db.collection('appsflyer_events').createIndex({ click_id: 1 })
    await db.collection('appsflyer_events').createIndex({ event_time: -1 })
    await db.collection('appsflyer_events').createIndex({ publisher_id: 1, event_time: -1 })
  } catch (e) {
    // ignore index race conditions
  }
}

export function strip(doc) {
  if (!doc) return doc
  if (Array.isArray(doc)) return doc.map(strip)
  const { _id, password_hash, ...rest } = doc
  return rest
}
