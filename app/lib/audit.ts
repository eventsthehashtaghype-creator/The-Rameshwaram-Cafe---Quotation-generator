import { supabase } from './supabase'

export interface LogEntry {
  id?: string
  actorName: string // e.g. "Nagaraj", "Client (Idli Vada)", "Kavya", "Accounts"
  clientName: string // e.g. "Idli Vada", "TEST Pvt Ltd"
  action: string // e.g. "Event Accepted", "Changed Menu", "Submitted Quote", "Edited Quotation"
  districtState: string // e.g. "Bengaluru, Karnataka"
  eventStartDate: string // e.g. "2026-08-21"
  eventCode: string // e.g. "KA2108IDLI"
  details?: string
  timestamp?: string
}

const STORAGE_KEY = 'quotation_activity_logs'

export async function logActivity(entry: LogEntry) {
  const timestamp = new Date().toISOString()
  const fullEntry = {
    ...entry,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    timestamp,
  }

  // 1. Save locally in localStorage for fast rendering & resilience
  if (typeof window !== 'undefined') {
    try {
      const existing = localStorage.getItem(STORAGE_KEY)
      const logs = existing ? JSON.parse(existing) : []
      logs.unshift(fullEntry)
      // Keep last 500 logs locally
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, 500)))
    } catch (e) {
      console.error('Error saving activity log locally:', e)
    }
  }

  // 2. Try persisting to Supabase table `activity_logs`
  try {
    await supabase.from('activity_logs').insert([{
      actor_name: entry.actorName,
      client_name: entry.clientName,
      action: entry.action,
      district_state: entry.districtState,
      event_start_date: entry.eventStartDate,
      event_code: entry.eventCode,
      details: entry.details || '',
      created_at: timestamp,
    }])
  } catch (e) {
    // If table doesn't exist yet, local fallback handles display
    console.warn('Supabase activity_logs table insert warning:', e)
  }

  return fullEntry
}

export async function getActivityLogs(): Promise<LogEntry[]> {
  let dbLogs: LogEntry[] = []
  
  // 1. Try fetching from Supabase table
  try {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (data && data.length > 0) {
      dbLogs = data.map((d: any) => ({
        id: d.id,
        actorName: d.actor_name,
        clientName: d.client_name,
        action: d.action,
        districtState: d.district_state,
        eventStartDate: d.event_start_date,
        eventCode: d.event_code,
        details: d.details,
        timestamp: d.created_at,
      }))
    }
  } catch (e) {
    console.warn('Could not fetch activity_logs from Supabase:', e)
  }

  // 2. Combine with LocalStorage logs
  let localLogs: LogEntry[] = []
  if (typeof window !== 'undefined') {
    try {
      const existing = localStorage.getItem(STORAGE_KEY)
      if (existing) {
        localLogs = JSON.parse(existing)
      }
    } catch (e) {
      console.error('Error loading local activity logs:', e)
    }
  }

  // Deduplicate by ID or timestamp+code
  const map = new Map<string, LogEntry>()
  localLogs.forEach(l => { if (l.timestamp) map.set(l.timestamp + l.eventCode, l) })
  dbLogs.forEach(d => { if (d.timestamp) map.set(d.timestamp + d.eventCode, d) })

  const merged = Array.from(map.values()).sort((a, b) => 
    new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
  )

  return merged
}
