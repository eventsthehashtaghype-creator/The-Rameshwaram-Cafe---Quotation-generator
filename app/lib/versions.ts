import { supabase } from './supabase'
import { logActivity } from './audit'

export interface QuotationSnapshot {
  event: {
    startDate: string
    endDate: string
    eventType: 'B2B' | 'B2C' | string
    eventSize: 'Small' | 'Large' | string
    venueName: string
    fullAddress: string
    city: string
    state: string
    venueZipcode?: string
    googleMapsLink: string
    pocName: string
    pocMobile: string
    pocEmail: string
  }
  client: {
    clientName: string
    clientGst: string
    clientContact: string
    clientMobile: string
    clientEmail: string
    clientAddress?: string
    clientCity?: string
    clientState?: string
  }
  selections: Array<{
    id?: string
    category_title: string
    pax: number
    price_per_plate: number
    selected_items: string[]
    order_index?: number
  }>
  terms: Array<{
    id: string
    text: string
    selected: boolean
  }>
  financials: {
    grandTotal: number
    gst: number
    finalAmount: number
  }
}

export interface QuotationVersion {
  id: string
  eventId: string
  versionNumber: number
  actorName: string
  reason: string
  changesSummary?: string
  snapshot: QuotationSnapshot
  createdAt: string
}

const STORAGE_PREFIX = 'quotation_versions_'

/**
 * Generate a short human-readable summary of differences between two snapshots
 */
export function generateDiffSummary(oldSnap?: QuotationSnapshot | null, newSnap?: QuotationSnapshot | null): string {
  if (!oldSnap) return 'Initial quotation created'
  if (!newSnap) return 'Snapshot updated'

  const changes: string[] = []

  // Compare financials & pax
  const oldPax = oldSnap.selections.reduce((sum, s) => sum + (s.pax || 0), 0)
  const newPax = newSnap.selections.reduce((sum, s) => sum + (s.pax || 0), 0)
  if (oldPax !== newPax) {
    changes.push(`PAX: ${oldPax} → ${newPax}`)
  }

  if (oldSnap.financials.finalAmount !== newSnap.financials.finalAmount) {
    changes.push(`Total: ₹${Math.round(oldSnap.financials.finalAmount).toLocaleString('en-IN')} → ₹${Math.round(newSnap.financials.finalAmount).toLocaleString('en-IN')}`)
  }

  // Compare dates
  if (oldSnap.event.startDate !== newSnap.event.startDate || oldSnap.event.endDate !== newSnap.event.endDate) {
    changes.push(`Dates: ${oldSnap.event.startDate || 'N/A'} → ${newSnap.event.startDate || 'N/A'}`)
  }

  // Compare venue
  if (oldSnap.event.venueName !== newSnap.event.venueName || oldSnap.event.city !== newSnap.event.city) {
    changes.push(`Venue: ${newSnap.event.venueName || newSnap.event.city || 'Updated'}`)
  }

  // Compare selections count / meal types
  const oldMeals = oldSnap.selections.map(s => s.category_title).join(', ')
  const newMeals = newSnap.selections.map(s => s.category_title).join(', ')
  if (oldMeals !== newMeals) {
    changes.push(`Meals: ${newMeals}`)
  }

  return changes.length > 0 ? changes.join(' | ') : 'General updates & saved changes'
}

/**
 * Save a new Quotation Version snapshot
 */
export async function saveQuotationVersion(params: {
  eventId: string
  actorName: string
  reason: string
  snapshot: QuotationSnapshot
  changesSummary?: string
  eventCode?: string
  clientName?: string
  districtState?: string
}): Promise<QuotationVersion> {
  const { eventId, actorName, reason, snapshot, eventCode, clientName, districtState } = params
  const existing = await getQuotationVersions(eventId)
  const nextVersionNumber = existing.length > 0 ? Math.max(...existing.map(v => v.versionNumber)) + 1 : 1

  const summary = params.changesSummary || (existing.length > 0 ? generateDiffSummary(existing[0].snapshot, snapshot) : 'Initial quotation version')
  const timestamp = new Date().toISOString()
  const versionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `v_${Date.now()}`

  const newVersion: QuotationVersion = {
    id: versionId,
    eventId,
    versionNumber: nextVersionNumber,
    actorName: actorName || 'Admin',
    reason: reason.trim() || `Saved revision v${nextVersionNumber}`,
    changesSummary: summary,
    snapshot,
    createdAt: timestamp,
  }

  // 1. Save to LocalStorage for instant resilience
  if (typeof window !== 'undefined') {
    try {
      const currentList = existing.filter(v => v.id !== versionId)
      currentList.unshift(newVersion)
      localStorage.setItem(`${STORAGE_PREFIX}${eventId}`, JSON.stringify(currentList))
      window.dispatchEvent(new CustomEvent('quotation_version_saved', { detail: newVersion }))
    } catch (e) {
      console.error('Failed to save quotation version to local storage:', e)
    }
  }

  // 2. Persist to Supabase if table exists
  try {
    await supabase.from('quotation_versions').insert([{
      id: versionId,
      event_id: eventId,
      version_number: nextVersionNumber,
      actor_name: newVersion.actorName,
      reason: newVersion.reason,
      changes_summary: newVersion.changesSummary,
      snapshot: snapshot,
      created_at: timestamp,
    }])
  } catch (e) {
    console.warn('Supabase quotation_versions insert notice:', e)
  }

  // 3. Log to Activity Logs
  try {
    await logActivity({
      actorName: newVersion.actorName,
      clientName: clientName || snapshot.client.clientName || 'Client',
      action: `Saved Quote v${nextVersionNumber}`,
      districtState: districtState || [snapshot.event.city, snapshot.event.state].filter(Boolean).join(', ') || 'Karnataka',
      eventStartDate: snapshot.event.startDate,
      eventCode: eventCode || 'EVENT',
      details: `v${nextVersionNumber} created. Reason: ${newVersion.reason}${newVersion.changesSummary ? ` (${newVersion.changesSummary})` : ''}`,
    })
  } catch (e) {
    console.warn('Failed to log activity for quotation version:', e)
  }

  return newVersion
}

/**
 * Fetch all versions for a quotation
 */
export async function getQuotationVersions(eventId: string): Promise<QuotationVersion[]> {
  let dbVersions: QuotationVersion[] = []

  // Try DB
  try {
    const { data, error } = await supabase
      .from('quotation_versions')
      .select('*')
      .eq('event_id', eventId)
      .order('version_number', { ascending: false })

    if (!error && data && data.length > 0) {
      dbVersions = data.map((d: any) => ({
        id: d.id,
        eventId: d.event_id,
        versionNumber: d.version_number,
        actorName: d.actor_name,
        reason: d.reason,
        changesSummary: d.changes_summary,
        snapshot: typeof d.snapshot === 'string' ? JSON.parse(d.snapshot) : d.snapshot,
        createdAt: d.created_at,
      }))
    }
  } catch (e) {
    console.warn('Could not query quotation_versions from Supabase:', e)
  }

  // Local storage fallback / merge
  let localVersions: QuotationVersion[] = []
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${eventId}`)
      if (raw) {
        localVersions = JSON.parse(raw)
      }
    } catch (e) {
      console.error('Error parsing local quotation versions:', e)
    }
  }

  // Deduplicate by versionNumber or ID
  const map = new Map<number, QuotationVersion>()
  localVersions.forEach(v => map.set(v.versionNumber, v))
  dbVersions.forEach(v => map.set(v.versionNumber, v))

  const merged = Array.from(map.values()).sort((a, b) => b.versionNumber - a.versionNumber)
  return merged
}

/**
 * Restore an older Quotation Version
 */
export async function restoreQuotationVersion(params: {
  eventId: string
  targetVersion: QuotationVersion
  actorName: string
  reason: string
  eventCode?: string
  districtState?: string
}): Promise<QuotationVersion> {
  const { eventId, targetVersion, actorName, reason, eventCode, districtState } = params
  const snap = targetVersion.snapshot

  // 1. Update event row in Supabase
  try {
    await supabase.from('events').update({
      event_date: snap.event.startDate,
      end_date: snap.event.endDate,
      event_type: snap.event.eventType,
      event_size: snap.event.eventSize,
      venue_name: snap.event.venueName,
      venue_address: snap.event.fullAddress,
      city: snap.event.city,
      state: snap.event.state,
      venue_zipcode: snap.event.venueZipcode,
      google_maps_link: snap.event.googleMapsLink,
      poc_name: snap.event.pocName,
      poc_mobile: snap.event.pocMobile,
      poc_email: snap.event.pocEmail,
      terms_and_conditions: snap.terms,
    }).eq('id', eventId)
  } catch (e) {
    console.error('Error restoring event row in Supabase:', e)
  }

  // 2. Update client details in Supabase if available
  try {
    const { data: eventData } = await supabase.from('events').select('client_id').eq('id', eventId).single()
    if (eventData?.client_id && snap.client) {
      await supabase.from('clients').update({
        entity_name: snap.client.clientName,
        gst_number: snap.client.clientGst,
        contact_person: snap.client.clientContact,
        mobile: snap.client.clientMobile,
        email: snap.client.clientEmail,
        address: snap.client.clientAddress,
        city: snap.client.clientCity,
        state: snap.client.clientState,
      }).eq('id', eventData.client_id)
    }
  } catch (e) {
    console.warn('Error restoring client details in Supabase:', e)
  }

  // 3. Restore menu_selections in Supabase
  try {
    // Delete existing selections for this event
    await supabase.from('menu_selections').delete().eq('event_id', eventId)

    // Insert restored selections
    if (snap.selections && snap.selections.length > 0) {
      const selectionsToInsert = snap.selections.map((s, idx) => ({
        event_id: eventId,
        category_title: s.category_title,
        pax: s.pax,
        price_per_plate: s.price_per_plate,
        selected_items: JSON.stringify(s.selected_items || []),
        order_index: s.order_index || idx + 1,
      }))
      await supabase.from('menu_selections').insert(selectionsToInsert)
    }
  } catch (e) {
    console.error('Error restoring menu_selections in Supabase:', e)
  }

  // 4. Save a new version representing this rollback
  const rollbackSummary = `Rollback: Restored to v${targetVersion.versionNumber} (originally from ${new Date(targetVersion.createdAt).toLocaleDateString('en-GB')})`
  const rollbackVersion = await saveQuotationVersion({
    eventId,
    actorName,
    reason: `[Rollback to v${targetVersion.versionNumber}] ${reason.trim() || 'Restored previous version'}`,
    snapshot: snap,
    changesSummary: rollbackSummary,
    eventCode,
    clientName: snap.client.clientName,
    districtState,
  })

  // 5. Activity log
  await logActivity({
    actorName: actorName || 'Admin',
    clientName: snap.client.clientName || 'Client',
    action: `Reverted Quote to v${targetVersion.versionNumber}`,
    districtState: districtState || [snap.event.city, snap.event.state].filter(Boolean).join(', ') || 'Karnataka',
    eventStartDate: snap.event.startDate,
    eventCode: eventCode || 'EVENT',
    details: `Restored back to Version ${targetVersion.versionNumber}. Reason: ${reason.trim() || 'Previous version restored by user'}`,
  })

  return rollbackVersion
}
