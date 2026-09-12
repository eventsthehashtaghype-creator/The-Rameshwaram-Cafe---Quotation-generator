// Shared event date and temporal status calculation helpers

export interface EventDateRange {
    startDate: Date
    endDate: Date
    today: Date
}

/**
 * Returns normalized dates with time stripped (00:00:00)
 */
export function getNormalizedDate(dateInput?: string | Date | null): Date {
    if (!dateInput) {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        return d
    }
    const d = new Date(dateInput)
    d.setHours(0, 0, 0, 0)
    return d
}

/**
 * Extracts normalized start date, end date, and today's date for an event
 */
export function getEventDateRange(event: any, referenceDate: Date = new Date()): EventDateRange {
    const today = getNormalizedDate(referenceDate)
    const startDate = getNormalizedDate(event?.event_date)
    const endDate = event?.end_date ? getNormalizedDate(event.end_date) : new Date(startDate)
    return { startDate, endDate, today }
}

/**
 * Returns true if the event has concluded (today is past the event end date)
 * Cancelled events are not marked as closed.
 */
export function isEventClosed(event: any, referenceDate: Date = new Date()): boolean {
    if (!event) return false
    const s = (event.status || '').toLowerCase()
    if (s === 'cancelled') return false

    const { endDate, today } = getEventDateRange(event, referenceDate)
    return today.getTime() > endDate.getTime()
}

/**
 * Returns true if today falls on the event date (or any day in the multiday range between start and end)
 */
export function isEventToday(event: any, referenceDate: Date = new Date()): boolean {
    if (!event) return false
    const s = (event.status || '').toLowerCase()
    if (s === 'cancelled') return false

    const { startDate, endDate, today } = getEventDateRange(event, referenceDate)
    return today.getTime() >= startDate.getTime() && today.getTime() <= endDate.getTime()
}

export type ComputedStatusType = 
    | 'cancelled' 
    | 'event_closed' 
    | 'event_today' 
    | 'confirmed' 
    | 'sent' 
    | 'edit_requested' 
    | 'client_submitted' 
    | 'draft'

/**
 * Returns the computed status taking real-time dates into account:
 * - Cancelled: 'cancelled'
 * - Concluded past end_date: 'event_closed'
 * - Active on event date(s) AND confirmed: 'event_today'
 * - Otherwise event.status / quote_status
 */
export function getComputedEventStatus(event: any, referenceDate: Date = new Date()): ComputedStatusType {
    if (!event) return 'draft'
    const rawStatus = (event.status || 'draft').toLowerCase()

    if (rawStatus === 'cancelled') return 'cancelled'

    if (isEventClosed(event, referenceDate)) {
        return 'event_closed'
    }

    if (isEventToday(event, referenceDate) && rawStatus === 'confirmed') {
        return 'event_today'
    }

    if (event.quote_status === 'edit_requested' || rawStatus === 'edit_requested') {
        return 'edit_requested'
    }

    if (event.quote_status === 'client_submitted') {
        return 'client_submitted'
    }

    if (rawStatus === 'confirmed') return 'confirmed'
    if (rawStatus === 'sent') return 'sent'

    return 'draft'
}

/**
 * Human-readable label and UI styling metadata for the computed status
 */
export function getStatusDisplayInfo(event: any, referenceDate: Date = new Date()) {
    const computed = getComputedEventStatus(event, referenceDate)

    switch (computed) {
        case 'cancelled':
            return {
                label: 'REJECTED',
                badgeClass: 'bg-red-50 text-red-600 border-red-100',
                isClosed: false,
                isToday: false,
                isConfirmed: false
            }
        case 'event_closed':
            return {
                label: 'EVENT CLOSED',
                badgeClass: 'bg-slate-100 text-slate-600 border-slate-300 font-black',
                isClosed: true,
                isToday: false,
                isConfirmed: false
            }
        case 'event_today':
            return {
                label: 'EVENT IS TODAY',
                badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse font-black shadow-sm',
                isClosed: false,
                isToday: true,
                isConfirmed: true
            }
        case 'confirmed':
            return {
                label: 'CONFIRMED',
                badgeClass: 'bg-green-50 text-green-600 border-green-100',
                isClosed: false,
                isToday: false,
                isConfirmed: true
            }
        case 'edit_requested':
            return {
                label: 'EDIT REQUESTED',
                badgeClass: 'bg-purple-50 text-purple-600 border-purple-100',
                isClosed: false,
                isToday: false,
                isConfirmed: false
            }
        case 'client_submitted':
            return {
                label: 'CLIENT REQUEST PENDING',
                badgeClass: 'bg-orange-50 text-orange-600 border-orange-100',
                isClosed: false,
                isToday: false,
                isConfirmed: false
            }
        case 'sent':
            return {
                label: 'SENT',
                badgeClass: 'bg-blue-50 text-blue-600 border-blue-100',
                isClosed: false,
                isToday: false,
                isConfirmed: false
            }
        case 'draft':
        default:
            return {
                label: 'DRAFT',
                badgeClass: 'bg-gray-100 text-gray-500 border-gray-200',
                isClosed: false,
                isToday: false,
                isConfirmed: false
            }
    }
}
