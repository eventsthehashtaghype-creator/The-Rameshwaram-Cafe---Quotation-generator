import { supabase } from './supabase'

export interface LogEntry {
  id?: string
  eventId?: string // Link to specific event / quotation
  actorName: string // e.g. "Anand (anand@therameshwaramcafe.org)"
  actorEmail?: string
  clientName: string // e.g. "Idli Vada", "TEST Pvt Ltd"
  action: string // e.g. "Event Accepted", "Changed Menu", "Submitted Quote", "Edited Quotation", "Saved Quote v2", "Restored Quote v1"
  districtState: string // e.g. "Bengaluru, Karnataka"
  eventStartDate: string // e.g. "2026-08-21"
  eventCode: string // e.g. "KA2108IDLI"
  details?: string // Reason or specifics
  timestamp?: string
}

const STORAGE_KEY = 'quotation_activity_logs'

export interface ActorInfo {
  name: string
  email: string
  formatted: string // e.g. "Anand (anand@therameshwaramcafe.org)"
}

/**
 * Resolve the current actor's name and email based on active user session
 */
export async function getCurrentActor(): Promise<ActorInfo> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin_login_name')
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const email = user.email || ''
      const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single()
      
      let name = profile?.full_name?.trim()
      if (!name) {
        name = user.user_metadata?.full_name || (email ? email.split('@')[0] : 'Admin')
      }
      
      const userEmail = profile?.email || email
      const formatted = userEmail ? `${name} (${userEmail})` : name

      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_user_name', name)
        localStorage.setItem('auth_user_email', userEmail)
      }

      return { name, email: userEmail, formatted }
    }
  } catch (e) {
    // Ignore auth lookup errors
  }

  if (typeof window !== 'undefined') {
    const name = localStorage.getItem('auth_user_name') || 'Admin'
    const email = localStorage.getItem('auth_user_email') || ''
    const formatted = email ? `${name} (${email})` : name
    return { name, email, formatted }
  }

  return { name: 'Admin', email: '', formatted: 'Admin' }
}

export async function getCurrentActorName(): Promise<string> {
  const actor = await getCurrentActor()
  return actor.formatted
}

export async function logActivity(entry: LogEntry) {
  const timestamp = new Date().toISOString()
  
  // Ensure actorName has both person's name AND email ID
  let actorDisplay = entry.actorName?.trim() || ''
  const current = await getCurrentActor()

  if (!actorDisplay || actorDisplay === 'Admin' || actorDisplay === 'Initial Admin') {
    actorDisplay = current.formatted
  } else if (!actorDisplay.includes('@')) {
    const emailToUse = entry.actorEmail || current.email
    if (emailToUse) {
      actorDisplay = `${actorDisplay} (${emailToUse})`
    }
  }

  const fullEntry: LogEntry = {
    ...entry,
    actorName: actorDisplay,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    timestamp,
  }

  // 1. Save locally in localStorage for fast rendering & resilience
  if (typeof window !== 'undefined') {
    try {
      const existing = localStorage.getItem(STORAGE_KEY)
      const logs: LogEntry[] = existing ? JSON.parse(existing) : []
      logs.unshift(fullEntry)
      // Keep last 500 logs locally
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, 500)))

      // Dispatch real-time event for in-page updates
      window.dispatchEvent(new CustomEvent('activity_logged', { detail: fullEntry }))
    } catch (e) {
      console.error('Error saving activity log locally:', e)
    }
  }

  // 2. Try persisting to Supabase table `activity_logs`
  try {
    await supabase.from('activity_logs').insert([{
      id: fullEntry.id,
      actor_name: fullEntry.actorName,
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

export async function getActivityLogs(limit = 200): Promise<LogEntry[]> {
  let dbLogs: LogEntry[] = []
  
  // 1. Try fetching from Supabase table
  try {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (data && data.length > 0) {
      dbLogs = data.map((d: any) => ({
        id: d.id,
        eventId: d.event_id,
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
  localLogs.forEach(l => { if (l.timestamp) map.set((l.id || '') + (l.timestamp || '') + (l.eventCode || ''), l) })
  dbLogs.forEach(d => { if (d.timestamp) map.set((d.id || '') + (d.timestamp || '') + (d.eventCode || ''), d) })

  const merged = Array.from(map.values()).sort((a, b) => 
    new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
  )

  return merged.slice(0, limit)
}

