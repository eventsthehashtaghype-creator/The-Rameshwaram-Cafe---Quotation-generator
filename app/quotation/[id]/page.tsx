'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { logActivity, getActivityLogs, getCurrentActorName, LogEntry } from '@/app/lib/audit'
import {
    saveQuotationVersion,
    getQuotationVersions,
    restoreQuotationVersion,
    QuotationVersion,
    QuotationSnapshot
} from '@/app/lib/versions'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, ImageRun, TableLayoutType } from 'docx'

// Load map dynamically
const EventMap = dynamic(() => import('../../components/EventMap'), {
    ssr: false,
    loading: () => <div className="h-64 bg-gray-200 animate-pulse rounded flex items-center justify-center text-black font-bold">Loading Map...</div>
})

export default function QuotationPage() {
    const { id } = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [event, setEvent] = useState<any>(null)
    const [selections, setSelections] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'quote')
    const [appSettings, setAppSettings] = useState<any>(null)
    const isClientPreview = searchParams.get('client_preview') === 'true'

    // --- LOCK & EDIT WORKFLOW STATE ---
    const [isQuoteLocked, setIsQuoteLocked] = useState(false)
    const [isMenuLocked, setIsMenuLocked] = useState(false)
    const [showEditReasonModal, setShowEditReasonModal] = useState(false)
    const [editReason, setEditReason] = useState('')

    // --- VERSIONS & REVISION WORKFLOW STATE ---
    const [versions, setVersions] = useState<QuotationVersion[]>([])
    const [eventAuditLogs, setEventAuditLogs] = useState<LogEntry[]>([])
    const [showSaveRevisionModal, setShowSaveRevisionModal] = useState(false)
    const [revisionActorName, setRevisionActorName] = useState('')
    const [revisionReason, setRevisionReason] = useState('')
    const [selectedVersionForView, setSelectedVersionForView] = useState<QuotationVersion | null>(null)
    const [selectedVersionForRestore, setSelectedVersionForRestore] = useState<QuotationVersion | null>(null)
    const [rollbackReason, setRollbackReason] = useState('')
    const [isRestoring, setIsRestoring] = useState(false)

    // --- EDITING STATE ---
    const [saving, setSaving] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    // Schedule
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [days, setDays] = useState(0)

    // Details
    const [eventType, setEventType] = useState<'B2B' | 'B2C'>('B2C')
    const [eventSize, setEventSize] = useState<'Small' | 'Large'>('Small')

    // Venue
    const [venueName, setVenueName] = useState('')
    const [fullAddress, setFullAddress] = useState('')
    const [city, setCity] = useState('')
    const [state, setState] = useState('')
    const [googleMapsLink, setGoogleMapsLink] = useState('')

    // POC
    const [pocName, setPocName] = useState('')
    const [pocMobile, setPocMobile] = useState('')
    const [pocEmail, setPocEmail] = useState('')

    // Client
    const [clientId, setClientId] = useState('')
    const [clientName, setClientName] = useState('')
    const [clientGst, setClientGst] = useState('')
    const [clientContact, setClientContact] = useState('')
    const [clientMobile, setClientMobile] = useState('')
    const [clientEmail, setClientEmail] = useState('')

    // Helper for Currency
    const fmt = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

    // Map for Item -> Station Name
    const [itemStationMap, setItemStationMap] = useState<Record<string, string>>({})

    // --- TERMS AND CONDITIONS STATE ---
    const defaultTerms = [
        { id: 't1', text: "Extra 18% GST is Applicable", selected: true },
        { id: 't2', text: "50% Advance Payment on Order Confirmation.", selected: true },
        { id: 't3', text: "Transportation charges extra as per actual", selected: true },
        { id: 't4', text: "Staff Travel & Accommodation for staff should be provided by client if booked by us need to be reimbursed.", selected: true },
        { id: 't5', text: "Tables & Chafing dish should be arranged by client", selected: true },
        { id: 't6', text: "Extra Pax will be charged as per above pricing", selected: true },
        { id: 't7', text: "Service Time 3:30 Hrs Extra Hour Services is Applicable", selected: true }
    ]
    const [terms, setTerms] = useState<{ id: string, text: string, selected: boolean }[]>([])

    useEffect(() => {
        if (!id) {
            console.error("ID is missing from useParams!")
            return
        }
        console.log("Fetching data for ID:", id)
        fetchData()
    }, [id])

    // Date Calc
    useEffect(() => {
        if (startDate && endDate) {
            const s = new Date(startDate); const e = new Date(endDate)
            const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1
            setDays(diff > 0 ? diff : 0)
        }
    }, [startDate, endDate])

    // --- UNSAVED CHANGES GUARD ---
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault()
                e.returnValue = '' // Required for Chrome to show prompt
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [hasUnsavedChanges])

    async function fetchData() {
        console.log("fetchData started...")
        try {
            // Auth & Security Check
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: clientUser } = await supabase.from('clients').select('id').eq('auth_user_id', session.user.id).single()

            // 1. Fetch Event & Global Settings
            const { data: eventData, error: eventError } = await supabase.from('events').select(`*, clients(*)`).eq('id', id).single()
            const { data: settingsData } = await supabase.from('app_settings').select('*').single()

            if (settingsData) {
                setAppSettings(settingsData)
            }

            if (eventError) {
                console.error("Error fetching event:", eventError)
                alert("Error loading event: " + eventError.message)
                setLoading(false)
                return
            }

            // Security: If client, verify ownership and force preview mode
            if (clientUser) {
                if (eventData.client_id !== clientUser.id) {
                    router.replace('/portal/dashboard')
                    return
                }
                if (!isClientPreview) {
                    router.replace(`/quotation/${id}?client_preview=true`)
                    return
                }
            }

            if (eventData) {
                console.log("Event Data loaded:", eventData)
                setEvent(eventData)

                // Populate State
                setStartDate(eventData.event_date || '')
                setEndDate(eventData.end_date || eventData.event_date || '')
                setEventType(eventData.event_type || 'B2C')
                setEventSize(eventData.event_size || 'Small')

                setVenueName(eventData.venue_name || '')
                setFullAddress(eventData.venue_address || '')
                setCity(eventData.city || '')
                setState(eventData.state || '')
                setGoogleMapsLink(eventData.google_maps_link || '')

                setPocName(eventData.poc_name || '')
                setPocMobile(eventData.poc_mobile || '')
                setPocEmail(eventData.poc_email || '')

                // Lock States
                const isLocked = eventData.status === 'sent' || eventData.quote_status === 'submitted' || eventData.quote_status === 'sent' || eventData.quote_submitted === true
                setIsQuoteLocked(isLocked)
                setIsMenuLocked(eventData.menu_locked === true)

                // Init terms state gracefully from DB or Defaults
                if (eventData.terms_and_conditions && Array.isArray(eventData.terms_and_conditions)) {
                    setTerms(eventData.terms_and_conditions)
                } else {
                    setTerms(defaultTerms)
                }

                // Populate Client State
                if (eventData.clients) {
                    setClientId(eventData.clients.id)
                    setClientName(eventData.clients.entity_name || '')
                    setClientGst(eventData.clients.gst_number || '')
                    setClientContact(eventData.clients.contact_person || '')
                    setClientMobile(eventData.clients.mobile || '')
                    setClientEmail(eventData.clients.email || '')
                }
            }

            // 2. Fetch Menu Selections (Ordered by Title/Day)
            const { data: menuData } = await supabase.from('menu_selections').select('*').eq('event_id', id).order('category_title', { ascending: true })
            if (menuData) {
                // Parse the JSON items back to array
                const parsed = menuData.map((m: any) => ({
                    ...m,
                    selected_items: typeof m.selected_items === 'string' ? JSON.parse(m.selected_items) : m.selected_items
                }))

                // Custom Sort: By Day, then chronological meal time, then alphabetical
                const mealOrder = ['breakfast', 'brunch', 'lunch', 'high-tea', 'high tea', 'snacks', 'dinner', 'supper', 'midnight']
                const getMealIndex = (title: string) => {
                    const lower = title.toLowerCase()
                    const index = mealOrder.findIndex(meal => lower.includes(meal))
                    return index === -1 ? 999 : index
                }

                parsed.sort((a: any, b: any) => {
                    // 1. Manual User Order Index (if set)
                    if (a.order_index || b.order_index) {
                        return (a.order_index || 0) - (b.order_index || 0)
                    }

                    // 2. Default Chronological Order
                    const dayMatchA = a.category_title.match(/Day (\d+)/i)
                    const dayMatchB = b.category_title.match(/Day (\d+)/i)
                    if (dayMatchA && dayMatchB) {
                        const dayA = parseInt(dayMatchA[1])
                        const dayB = parseInt(dayMatchB[1])
                        if (dayA !== dayB) return dayA - dayB
                    }
                    const indexA = getMealIndex(a.category_title)
                    const indexB = getMealIndex(b.category_title)
                    if (indexA !== indexB) return indexA - indexB
                    return a.category_title.localeCompare(b.category_title)
                })

                setSelections(parsed)
            }

            // 3. Fetch Stations and Items for Grouping
            const { data: stationsData } = await supabase.from('menu_stations').select('id, name')
            const { data: itemsData } = await supabase.from('menu_items').select('name, station_id')
            if (stationsData && itemsData) {
                const map: Record<string, string> = {}
                itemsData.forEach((item: any) => {
                    const st = stationsData.find((s: any) => s.id === item.station_id)
                    map[item.name] = st ? st.name : 'OTHER'
                })
                setItemStationMap(map)
            }

            // 4. Fetch Versions & seed initial version if empty
            const vers = await getQuotationVersions(id as string)
            if (vers.length === 0 && eventData) {
                const initialGrandTotal = (menuData || []).reduce((sum: number, item: any) => sum + ((item.pax || 0) * (item.price_per_plate || 0)), 0)
                const initialSnap: QuotationSnapshot = {
                    event: {
                        startDate: eventData.event_date || '',
                        endDate: eventData.end_date || eventData.event_date || '',
                        eventType: eventData.event_type || 'B2C',
                        eventSize: eventData.event_size || 'Small',
                        venueName: eventData.venue_name || '',
                        fullAddress: eventData.venue_address || '',
                        city: eventData.city || '',
                        state: eventData.state || '',
                        googleMapsLink: eventData.google_maps_link || '',
                        pocName: eventData.poc_name || '',
                        pocMobile: eventData.poc_mobile || '',
                        pocEmail: eventData.poc_email || '',
                    },
                    client: {
                        clientName: eventData.clients?.entity_name || '',
                        clientGst: eventData.clients?.gst_number || '',
                        clientContact: eventData.clients?.contact_person || '',
                        clientMobile: eventData.clients?.mobile || '',
                        clientEmail: eventData.clients?.email || '',
                    },
                    selections: (menuData || []).map((s: any, idx: number) => ({
                        id: s.id,
                        category_title: s.category_title,
                        pax: s.pax || 0,
                        price_per_plate: s.price_per_plate || 0,
                        selected_items: typeof s.selected_items === 'string' ? JSON.parse(s.selected_items) : (s.selected_items || []),
                        order_index: s.order_index || idx + 1,
                    })),
                    terms: (eventData.terms_and_conditions && Array.isArray(eventData.terms_and_conditions))
                        ? eventData.terms_and_conditions
                        : defaultTerms,
                    financials: {
                        grandTotal: initialGrandTotal,
                        gst: initialGrandTotal * 0.18,
                        finalAmount: initialGrandTotal * 1.18,
                    }
                }
                saveQuotationVersion({
                    eventId: id as string,
                    actorName: 'System',
                    reason: 'Initial quotation created',
                    snapshot: initialSnap,
                    eventCode: eventData.event_code,
                    clientName: eventData.clients?.entity_name,
                    districtState: [eventData.city, eventData.state].filter(Boolean).join(', '),
                }).then(seeded => {
                    setVersions([seeded])
                }).catch(err => console.warn('Could not auto-seed initial version:', err))
            } else {
                setVersions(vers)
            }

            // 5. Fetch Event-specific Audit Logs
            const allLogs = await getActivityLogs(200)
            const matchedLogs = allLogs.filter(l => l.eventCode === eventData.event_code || l.eventId === id)
            setEventAuditLogs(matchedLogs)

            setLoading(false)
        } catch (error) {
            console.error("Critical error in fetchData:", error)
            alert("Unexpected error loading quotation.")
            setLoading(false)
        }
    }

    // Helper: Build snapshot of current state
    const getCurrentSnapshot = (): QuotationSnapshot => {
        const subtotal = selections.reduce((sum, item) => sum + (item.pax * item.price_per_plate), 0)
        const gstVal = subtotal * 0.18
        return {
            event: {
                startDate,
                endDate,
                eventType,
                eventSize,
                venueName,
                fullAddress,
                city,
                state,
                googleMapsLink,
                pocName,
                pocMobile,
                pocEmail,
            },
            client: {
                clientName,
                clientGst,
                clientContact,
                clientMobile,
                clientEmail,
            },
            selections: selections.map((s, idx) => ({
                id: s.id,
                category_title: s.category_title,
                pax: s.pax,
                price_per_plate: s.price_per_plate,
                selected_items: s.selected_items || [],
                order_index: s.order_index || idx + 1,
            })),
            terms: terms,
            financials: {
                grandTotal: subtotal,
                gst: gstVal,
                finalAmount: subtotal + gstVal,
            }
        }
    }

    // Open Save Revision Modal
    const openSaveRevisionModal = async (defaultReason = '') => {
        const actor = await getCurrentActorName()
        setRevisionActorName(actor)
        setRevisionReason(defaultReason)
        setShowSaveRevisionModal(true)
    }

    // Commit a new Quotation Version
    const handleCommitRevision = async () => {
        if (!revisionReason.trim()) {
            alert("Please enter a reason for this change/revision.")
            return
        }

        setSaving(true)
        setShowSaveRevisionModal(false)

        try {
            // 1. Update Event details in Supabase
            const { error: eventError } = await supabase.from('events').update({
                event_date: startDate,
                end_date: endDate,
                event_type: eventType,
                event_size: eventSize,
                venue_name: venueName,
                venue_address: fullAddress,
                city,
                state,
                google_maps_link: googleMapsLink,
                poc_name: pocName,
                poc_mobile: pocMobile,
                poc_email: pocEmail,
                terms_and_conditions: terms
            }).eq('id', id)

            if (eventError) {
                alert("Error saving event: " + eventError.message)
                setSaving(false)
                return
            }

            // 2. Update Client in Supabase if needed
            if (clientId) {
                await supabase.from('clients').update({
                    entity_name: clientName,
                    gst_number: clientGst,
                    contact_person: clientContact,
                    mobile: clientMobile,
                    email: clientEmail
                }).eq('id', clientId)
            }

            // 3. Save current selections to Supabase
            for (const s of selections) {
                await supabase.from('menu_selections').update({
                    pax: s.pax,
                    price_per_plate: s.price_per_plate,
                    selected_items: JSON.stringify(s.selected_items || []),
                    order_index: s.order_index
                }).eq('id', s.id)
            }

            // 4. Save Version Snapshot
            const currentSnap = getCurrentSnapshot()
            const districtState = [city, state].filter(Boolean).join(', ') || 'Karnataka'
            const newVer = await saveQuotationVersion({
                eventId: id as string,
                actorName: revisionActorName || 'Admin',
                reason: revisionReason,
                snapshot: currentSnap,
                eventCode: event?.event_code,
                clientName: clientName || event?.clients?.entity_name,
                districtState,
            })

            setHasUnsavedChanges(false)
            setSaving(false)
            setRevisionReason('')
            alert(`✅ Quotation Revision v${newVer.versionNumber} saved successfully!`)
            await fetchData()
        } catch (err: any) {
            console.error("Error committing revision:", err)
            alert("Error saving revision: " + err.message)
            setSaving(false)
        }
    }

    // Rollback / Restore to a previous version
    const handleRestoreVersion = async () => {
        if (!selectedVersionForRestore) return
        if (!rollbackReason.trim()) {
            alert("Please enter a reason for rolling back to this version.")
            return
        }

        setIsRestoring(true)
        try {
            const actor = await getCurrentActorName()
            const districtState = [city, state].filter(Boolean).join(', ') || 'Karnataka'
            await restoreQuotationVersion({
                eventId: id as string,
                targetVersion: selectedVersionForRestore,
                actorName: actor,
                reason: rollbackReason,
                eventCode: event?.event_code,
                districtState,
            })

            setIsRestoring(false)
            setSelectedVersionForRestore(null)
            setRollbackReason('')
            alert(`✅ Successfully restored to Version ${selectedVersionForRestore.versionNumber}! A new rollback revision has been recorded.`)
            await fetchData()
            setActiveTab('quote')
        } catch (e: any) {
            console.error("Error restoring version:", e)
            alert("Failed to restore version: " + e.message)
            setIsRestoring(false)
        }
    }

    // MANUAL CATEGORY ALIGNMENT (Move Up or Down)
    const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return
        if (direction === 'down' && index === selections.length - 1) return

        const newSelections = [...selections]
        const targetIndex = direction === 'up' ? index - 1 : index + 1

        // Swap array items
        const temp = newSelections[index]
        newSelections[index] = newSelections[targetIndex]
        newSelections[targetIndex] = temp

        // Re-assign exact array 1-based order_index for all items to guarantee persistence
        const sequencedSelections = newSelections.map((item, idx) => ({
            ...item,
            order_index: idx + 1
        }))

        setSelections(sequencedSelections)
        setHasUnsavedChanges(true)

        // Sync to Supabase in background
        try {
            for (const item of sequencedSelections) {
                await supabase.from('menu_selections')
                    .update({ order_index: item.order_index })
                    .eq('id', item.id)
            }
        } catch (e) {
            console.error("Failed to sync category order to database:", e)
        }
    }

    // UPDATE PAX OR PRICE
    const handleUpdateLineItem = async (selectionId: string, field: 'pax' | 'price_per_plate', value: string) => {
        let num = parseFloat(value) || 0
        if (num < 0) num = 0 // Enforce non-negative values
        setSelections(prev => prev.map(s => s.id === selectionId ? { ...s, [field]: num } : s))
        setHasUnsavedChanges(true)
        await supabase.from('menu_selections').update({ [field]: num }).eq('id', selectionId)
    }

    // REMOVE AN ITEM FROM THE MENU LIST
    const handleRemoveItem = async (selectionId: string, itemToRemove: string) => {
        const selection = selections.find(s => s.id === selectionId)
        if (!selection) return
        const newItems = selection.selected_items.filter((i: string) => i !== itemToRemove)
        setSelections(prev => prev.map(s => s.id === selectionId ? { ...s, selected_items: newItems } : s))
        setHasUnsavedChanges(true)
        await supabase.from('menu_selections').update({ selected_items: JSON.stringify(newItems) }).eq('id', selectionId)
    }

    // SAVE EVENT SETTINGS
    const handleSaveSettings = async () => {
        openSaveRevisionModal("Updated event settings and client details")
    }

    // MAP HANDLER
    const handleMapSelect = (loc: any) => {
        setFullAddress(loc.display_name)
        setCity(loc.address.city || loc.address.town || loc.address.village || loc.address.county || '')
        setState(loc.address.state || loc.address.region || '')
        if (loc.address.amenity || loc.address.building) {
            setVenueName(loc.address.amenity || loc.address.building)
        }
        setGoogleMapsLink(`https://www.google.com/maps?q=${loc.lat},${loc.lon}`)
        setHasUnsavedChanges(true)
    }

    // CALCULATE TOTALS
    const grandTotal = selections.reduce((sum, item) => sum + (item.pax * item.price_per_plate), 0)
    const gst = grandTotal * 0.18
    const finalAmount = grandTotal + gst

    // PRINT PDF (Replaced with native jsPDF implementation)
    const handleDownloadPDF = async () => {
        const doc = new jsPDF()
        let yPos = 20

        // 1. Logo Fetching
        try {
            const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
            const response = await fetch(`${currentOrigin}/logo.png`)
            if (response.ok) {
                const blob = await response.blob()
                const base64Logo = await new Promise<string>((resolve, reject) => {
                    const img = new Image()
                    img.onload = () => {
                        const canvas = document.createElement('canvas')
                        const MAX_WIDTH = 400
                        let width = img.width
                        let height = img.height

                        if (width > MAX_WIDTH) {
                            height = Math.round((height * MAX_WIDTH) / width)
                            width = MAX_WIDTH
                        }

                        canvas.width = width
                        canvas.height = height
                        const ctx = canvas.getContext('2d')
                        if (ctx) {
                            ctx.fillStyle = '#FFFFFF'
                            ctx.fillRect(0, 0, width, height)
                            ctx.drawImage(img, 0, 0, width, height)
                            resolve(canvas.toDataURL('image/jpeg', 0.8)) // Compress to JPEG for smaller PDF size
                        } else {
                            resolve('')
                        }
                    }
                    img.onerror = reject
                    img.src = URL.createObjectURL(blob)
                })

                if (base64Logo) {
                    // Add Logo: Scale with bounding box to maintain exact ratio matching "w-56 object-contain"
                    const reqWidth = 60
                    const imgProps = doc.getImageProperties(base64Logo)
                    const ratio = imgProps.height / imgProps.width
                    const reqHeight = reqWidth * ratio

                    const pageWidth = doc.internal.pageSize.getWidth()
                    doc.addImage(base64Logo, 'JPEG', (pageWidth - reqWidth) / 2, yPos, reqWidth, reqHeight)
                    yPos += reqHeight + 15
                }
            }
        } catch (error) {
            console.error("Failed to load logo for PDF", error)
        }

        // 2. Header Information
        const curDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
        const eventDateStr = new Date(event.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
        const endDateStr = new Date(event.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')

        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.text('To,', 14, yPos)

        doc.setFont('helvetica', 'bold')
        doc.text(webClientDisplayName, 22, yPos + 6)

        doc.setFont('helvetica', 'normal')
        doc.text(`Date: ${curDate}`, doc.internal.pageSize.getWidth() - 14, yPos, { align: 'right' })

        yPos += 15
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(`Event Date : ${eventDateStr} ${days > 1 ? 'to ' + endDateStr : ''}`, 14, yPos)
        
        doc.setFont('helvetica', 'normal')
        if (event.venue_name || city) {
            doc.text(`Venue : ${[event.venue_name, city, event.venue_zipcode].filter(Boolean).join(', ')}`, 14, yPos + 6)
            yPos += 16
        } else {
            yPos += 10
        }

        // 3. Render Tables natively using autoTable
        selections.forEach((sel) => {
            const groupedItems: Record<string, string[]> = {}
            sel.selected_items.forEach((item: string) => {
                const station = itemStationMap[item] || 'OTHER'
                if (!groupedItems[station]) groupedItems[station] = []
                groupedItems[station].push(item)
            })

            let contentBody: any[] = []

            Object.entries(groupedItems).forEach(([station, items], index) => {
                const topBorder = index === 0 ? 0 : 0.1;

                if (station !== 'OTHER') {
                    contentBody.push([
                        { content: station.toUpperCase(), styles: { fontStyle: 'bold', textColor: [180, 83, 9], cellPadding: { top: 4, bottom: 1, left: 4, right: 4 }, fontSize: 10, halign: 'left', lineWidth: { top: topBorder, right: 0, bottom: 0, left: 0.1 }, lineColor: [0, 0, 0] } }
                    ])
                    const itemsStr = items.join('\n')
                    contentBody.push([
                        { content: itemsStr, styles: { fontStyle: 'normal', cellPadding: { top: 1, bottom: 4, left: 4, right: 4 }, halign: 'left', fontSize: 10, lineWidth: { top: 0, right: 0, bottom: 0, left: 0.1 }, lineColor: [0, 0, 0] } }
                    ])
                } else {
                    contentBody.push([
                        { content: 'CUSTOM REQUESTS', styles: { fontStyle: 'bold', textColor: [180, 83, 9], cellPadding: { top: 4, bottom: 1, left: 4, right: 4 }, fontSize: 10, halign: 'left', lineWidth: { top: topBorder, right: 0, bottom: 0, left: 0.1 }, lineColor: [0, 0, 0] } }
                    ])
                    const itemsStr = items.join('\n')
                    contentBody.push([
                        { content: itemsStr, styles: { fontStyle: 'normal', cellPadding: { top: 1, bottom: 4, left: 4, right: 4 }, halign: 'left', fontSize: 10, lineWidth: { top: 0, right: 0, bottom: 0, left: 0.1 }, lineColor: [0, 0, 0] } }
                    ])
                }
            })

            if (contentBody.length > 0) {
                const lastRowStyles = contentBody[contentBody.length - 1][0].styles;
                lastRowStyles.lineWidth.bottom = 0.1;

                contentBody[0].push({
                    content: `Rs. ${((sel.price_per_plate || 0) * (sel.pax || 0)).toLocaleString('en-IN')} /-`,
                    rowSpan: contentBody.length,
                    styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 11, lineWidth: { top: 0, right: 0.1, bottom: 0.1, left: 0.1 }, lineColor: [0, 0, 0] }
                })
            } else {
                contentBody.push([
                    { content: 'No items selected.', styles: { fontStyle: 'italic', textColor: [220, 38, 38], cellPadding: 4, lineWidth: { top: 0, right: 0, bottom: 0.1, left: 0 }, lineColor: [0, 0, 0] } },
                    { content: `Rs. ${((sel.price_per_plate || 0) * (sel.pax || 0)).toLocaleString('en-IN')} /-`, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 11, lineWidth: { top: 0, right: 0.1, bottom: 0.1, left: 0.1 }, lineColor: [0, 0, 0] } }
                ])
            }

            if (yPos > doc.internal.pageSize.getHeight() - 40) {
                doc.addPage();
                yPos = 20;
            }

            autoTable(doc, {
                startY: yPos + 2,
                head: [[{ content: `${sel.category_title} ( ${sel.pax} PAX )`, colSpan: 2 }]],
                body: contentBody,
                theme: 'plain',
                tableLineColor: [0, 0, 0],
                tableLineWidth: 0,
                styles: {
                    font: 'helvetica',
                    fontSize: 10,
                    textColor: [0, 0, 0],
                    lineWidth: 0,
                    lineColor: [0, 0, 0]
                },
                headStyles: {
                    fillColor: [249, 249, 249],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    halign: 'center',
                    valign: 'middle',
                    cellPadding: 3,
                    lineWidth: 0.1,
                    lineColor: [0, 0, 0]
                },
                bodyStyles: {
                    halign: 'left',
                    valign: 'top',
                },
                columnStyles: {
                    0: { cellWidth: 135 },
                    1: { cellWidth: 45 }
                },
                margin: { left: 14, right: 14 },
                didDrawPage: (data) => {
                    yPos = data.cursor ? data.cursor.y : yPos
                }
            })

            yPos += 5
        })

        // 4. Notes Section
        if (yPos > doc.internal.pageSize.getHeight() - 60) {
            doc.addPage()
            yPos = 20
        }
        yPos += 5
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('NOTE:', 14, yPos)
        yPos += 6

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')

        const activeTerms = terms.filter(t => t.selected)
        if (activeTerms.length === 0) {
            doc.text("No additional terms.", 20, yPos)
            yPos += 5
        } else {
            activeTerms.forEach((term, idx) => {
                doc.text(`${idx + 1}. ${term.text}`, 20, yPos)
                yPos += 5
            })
        }

        if (yPos > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage()
            yPos = 20
        }

        // 5. Bank Details Section
        yPos += 5
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('Bank Details:', 14, yPos)

        autoTable(doc, {
            startY: yPos + 3,
            body: [
                ["A/c Holder's Name", appSettings?.bank_account_name || "THE RAMESHWARAM CAFE"],
                ["Bank Name", appSettings?.bank_name || "HDFC BANK LTD"],
                ["A/c No", appSettings?.bank_account_no || "50200012345678"],
                ["IFS Code", appSettings?.bank_ifsc || "HDFC0000123"],
                ["Branch", appSettings?.bank_branch || "VASANT VIHAR"]
            ],
            theme: 'grid',
            styles: {
                font: 'helvetica',
                fontSize: 10,
                textColor: [0, 0, 0],
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
            },
            columnStyles: {
                0: { cellWidth: 40, halign: 'left' },
                1: { cellWidth: 50, halign: 'left', fontStyle: 'bold' } // Uppercase already applied in strings
            },
            margin: { left: 14 },
            didDrawPage: (data) => {
                yPos = data.cursor ? data.cursor.y : yPos
            }
        })

        if (yPos > doc.internal.pageSize.getHeight() - 60) {
            doc.addPage()
            yPos = 20
        }
        yPos += 10
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(65, 122, 185)
        doc.text('Annexure C - Event Timings & Extension Charges', 14, yPos)
        doc.setTextColor(0, 0, 0)

        autoTable(doc, {
            startY: yPos + 3,
            head: [['Meal Type', 'Timings', 'Extension Charges (Rs/Hour)']],
            body: [
                ['Breakfast', '7:00 AM - 11:00 AM', '50,000'],
                ['Lunch', '12:00 PM - 3:00 PM', '50,000'],
                ['High Tea', '4:00 PM - 7:00 PM', '50,000'],
                ['Dinner', '7:00 PM - 11:00 PM', '50,000']
            ],
            theme: 'grid',
            styles: {
                font: 'helvetica',
                fontSize: 10,
                textColor: [0, 0, 0],
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                halign: 'left'
            },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 60 },
                2: { cellWidth: 50 }
            },
            margin: { left: 14 },
            didDrawPage: (data) => {
                yPos = data.cursor ? data.cursor.y : yPos
            }
        })

        doc.save(`Quotation_${event.event_code}.pdf`)
    }

    // DOWNLOAD WORD DOC (Updated to use native docx library for image embedding)
    const handleDownloadMenuSheet = async () => {
        let logoArrayBuffer: ArrayBuffer | null = null;
        try {
            const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
            const response = await fetch(`${currentOrigin}/logo.png`)
            if (response.ok) {
                logoArrayBuffer = await response.arrayBuffer()
            }
        } catch (error) {
            console.error("Failed to load logo for Word export", error)
        }

        const formattedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
        const eventDateStr = new Date(event.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
        const endDateStr = new Date(event.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')

        let clientDisplayName = 'Client Name'
        if (event.clients) {
            if (event.clients.contact_person && event.clients.entity_name) {
                clientDisplayName = `${event.clients.contact_person} (${event.clients.entity_name})`
            } else {
                clientDisplayName = event.clients.contact_person || event.clients.entity_name || 'Client Name'
            }
        }

        const noBorder = { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }

        const docChildren: any[] = []

        // 1. Image
        if (logoArrayBuffer) {
            docChildren.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new ImageRun({
                            data: logoArrayBuffer,
                            transformation: { width: 200, height: 185 }, // Symmetrical scale of the roughly 1:1 original image
                            type: "png"
                        }),
                    ],
                    spacing: { after: 400 },
                })
            )
        }

        // 2. Header Table (To Client / Date)
        docChildren.push(
            new Table({
                width: { size: 9000, type: WidthType.DXA },
                columnWidths: [5400, 3600],
                borders: noBorder,
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                borders: noBorder,
                                width: { size: 5400, type: WidthType.DXA },
                                children: [
                                    new Paragraph({ children: [new TextRun("To,")] }),
                                    new Paragraph({ children: [new TextRun({ text: clientDisplayName, bold: true })] }),
                                ]
                            }),
                            new TableCell({
                                borders: noBorder,
                                width: { size: 3600, type: WidthType.DXA },
                                children: [
                                    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun(`Date: ${formattedDate}`)] }),
                                ]
                            })
                        ]
                    })
                ]
            })
        )

        // 3. Event Date
        docChildren.push(
            new Paragraph({
                spacing: { before: 200, after: 200 },
                children: [
                    new TextRun({ text: `Event Date : ${eventDateStr} ${days > 1 ? 'to ' + endDateStr : ''}`, bold: true })
                ]
            })
        )

        // 4. Selections
        selections.forEach((sel) => {
            const groupedItems: Record<string, string[]> = {}
            sel.selected_items.forEach((item: string) => {
                const station = itemStationMap[item] || 'OTHER'
                if (!groupedItems[station]) groupedItems[station] = []
                groupedItems[station].push(item)
            })

            const itemParagraphs: Paragraph[] = []
            Object.entries(groupedItems).forEach(([station, items]) => {
                if (station !== 'OTHER') {
                    itemParagraphs.push(new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: station, bold: true, color: "b45309" })] }))
                }
                items.forEach(item => {
                    itemParagraphs.push(new Paragraph({ children: [new TextRun({ text: item })] }))
                })
            })

            docChildren.push(
                new Paragraph({ spacing: { before: 200 } }),
                new Table({
                    width: { size: 9000, type: WidthType.DXA },
                    columnWidths: [6750, 2250],
                    layout: TableLayoutType.FIXED,
                    rows: [
                        // Category Header
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 6750, type: WidthType.DXA },
                                    shading: { fill: "f9f9f9" },
                                    borders: { right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 }, children: [new TextRun({ text: `${sel.category_title} ( ${sel.pax} PAX )`, bold: true })] })]
                                }),
                                new TableCell({
                                    width: { size: 2250, type: WidthType.DXA },
                                    shading: { fill: "f9f9f9" },
                                    borders: { left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
                                    children: []
                                })
                            ]
                        }),
                        // Items & Price
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 6750, type: WidthType.DXA },
                                    margins: { left: 100, right: 100, top: 100, bottom: 100 },
                                    children: itemParagraphs
                                }),
                                new TableCell({
                                    width: { size: 2250, type: WidthType.DXA },
                                    margins: { left: 100, right: 100, top: 200, bottom: 100 },
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Rs. ${((sel.price_per_plate || 0) * (sel.pax || 0)).toLocaleString('en-IN')} /-`, bold: true })] })]
                                })
                            ]
                        })
                    ]
                })
            )
            docChildren.push(new Paragraph({ spacing: { after: 200 } })) // Spacer between tables
        })

        // 5. Notes
        const activeTerms = terms.filter(t => t.selected)
        docChildren.push(
            new Paragraph({ spacing: { before: 400, after: 100 }, children: [new TextRun({ text: "NOTE:", bold: true })] })
        )

        if (activeTerms.length > 0) {
            activeTerms.forEach((term, index) => {
                docChildren.push(
                    new Paragraph({
                        text: `${index + 1}. ${term.text}`,
                        spacing: { after: 60 }
                    })
                )
            })
        } else {
            docChildren.push(new Paragraph({ text: "No additional terms." }))
        }

        // 6. Bank Details
        docChildren.push(
            new Paragraph({ spacing: { before: 300, after: 100 }, children: [new TextRun({ text: "Bank Details:", bold: true })] })
        )

        const makeBankRow = (label: string, val: string, uppercase = false) => {
            return new TableRow({
                children: [
                    new TableCell({ margins: { top: 50, bottom: 50, left: 100, right: 100 }, children: [new Paragraph({ text: label })] }),
                    new TableCell({ margins: { top: 50, bottom: 50, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: uppercase ? val.toUpperCase() : val })] })] }),
                ]
            })
        }

        docChildren.push(
            new Table({
                width: { size: 9000, type: WidthType.DXA },
                columnWidths: [4500, 4500],
                rows: [
                    makeBankRow("A/c Holder's Name", appSettings?.bank_account_name || "THE RAMESHWARAM CAFE", true),
                    makeBankRow("Bank Name", appSettings?.bank_name || "HDFC BANK LTD", true),
                    makeBankRow("A/c No", appSettings?.bank_account_no || "50200012345678"),
                    makeBankRow("IFS Code", appSettings?.bank_ifsc || "HDFC0000123"),
                    makeBankRow("Branch", appSettings?.bank_branch || "Vasant Vihar", true),
                ]
            })
        )

        // 7. Annexure C
        docChildren.push(
            new Paragraph({ spacing: { before: 400, after: 100 }, children: [new TextRun({ text: "Annexure C - Event Timings & Extension Charges", bold: true, color: "417ab9" })] })
        )

        const makeAnnexureRow = (meal: string, timing: string, charges: string, isHeader = false) => {
            return new TableRow({
                children: [
                    new TableCell({ margins: { top: 50, bottom: 50, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: meal, bold: isHeader })] })] }),
                    new TableCell({ margins: { top: 50, bottom: 50, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: timing, bold: isHeader })] })] }),
                    new TableCell({ margins: { top: 50, bottom: 50, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: charges, bold: isHeader })] })] }),
                ]
            })
        }

        docChildren.push(
            new Table({
                width: { size: 9000, type: WidthType.DXA },
                columnWidths: [3000, 3000, 3000],
                rows: [
                    makeAnnexureRow("Meal Type", "Timings", "Extension Charges (Rs/Hour)", true),
                    makeAnnexureRow("Breakfast", "7:00 AM - 11:00 AM", "50,000"),
                    makeAnnexureRow("Lunch", "12:00 PM - 3:00 PM", "50,000"),
                    makeAnnexureRow("High Tea", "4:00 PM - 7:00 PM", "50,000"),
                    makeAnnexureRow("Dinner", "7:00 PM - 11:00 PM", "50,000")
                ]
            })
        )

        // Generate and Download
        const docx = new Document({
            styles: {
                default: {
                    document: { run: { font: "Arial", size: 22 } } // 11pt = 22 half-points
                }
            },
            sections: [{
                properties: {},
                children: docChildren
            }]
        })

        Packer.toBlob(docx).then(blob => {
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `Quotation_${event.event_code}.docx`
            link.click()
            URL.revokeObjectURL(url)
        })
    }

    const handleSubmitToClient = async () => {
        const confirmed = window.confirm("Submit quotation to client? Once submitted, the quotation will be LOCKED TO EDIT for admin until unlocked.")
        if (!confirmed) return

        const adminName = (typeof window !== 'undefined' && localStorage.getItem('admin_login_name')) || 'Admin'
        const districtState = [city, state].filter(Boolean).join(', ') || 'Karnataka'

        await supabase.from('events').update({
            status: 'sent',
            quote_status: 'sent',
            quote_submitted: true,
        }).eq('id', id)

        setIsQuoteLocked(true)

        logActivity({
            actorName: adminName,
            clientName: clientName || 'Client',
            action: 'Submitted Quote',
            districtState,
            eventStartDate: startDate,
            eventCode: event.event_code || 'EVENT',
            details: 'Quotation submitted to client and locked to edit.'
        })

        alert("✅ Quotation submitted to client and locked to edit!")
        fetchData()
    }

    const handleUnlockForEdit = async () => {
        const adminName = (typeof window !== 'undefined' && localStorage.getItem('admin_login_name')) || 'Admin'
        const districtState = [city, state].filter(Boolean).join(', ') || 'Karnataka'

        await supabase.from('events').update({
            quote_status: 'draft',
            quote_submitted: false,
        }).eq('id', id)

        setIsQuoteLocked(false)
        setShowEditReasonModal(false)

        logActivity({
            actorName: adminName,
            clientName: clientName || 'Client',
            action: 'Edited Quotation',
            districtState,
            eventStartDate: startDate,
            eventCode: event.event_code || 'EVENT',
            details: editReason ? `Reason: ${editReason}` : 'Unlocked for editing'
        })

        alert("🔓 Quotation unlocked for editing.")
        setEditReason('')
        fetchData()
    }

    const handleRefreshMenu = async () => {
        await fetchData()
        alert("🔄 Refreshed to update to latest menu selections!")
    }

    const handleToggleLockMenu = async () => {
        const nextState = !isMenuLocked
        await supabase.from('events').update({ menu_locked: nextState }).eq('id', id)
        setIsMenuLocked(nextState)

        const adminName = (typeof window !== 'undefined' && localStorage.getItem('admin_login_name')) || 'Admin'
        logActivity({
            actorName: adminName,
            clientName: clientName || 'Client',
            action: nextState ? 'Locked Menu' : 'Unlocked Menu',
            districtState: [city, state].filter(Boolean).join(', ') || 'Karnataka',
            eventStartDate: startDate,
            eventCode: event.event_code || 'EVENT',
        })

        alert(nextState ? "🔒 Menu locked before auto-lock." : "🔓 Menu unlocked.")
    }

    if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-stone-400">Loading Quote...</div>
    if (!event) return <div>Event not found</div>

    const inputClass = "w-full border border-gray-300 bg-white p-2 rounded text-sm font-bold text-black outline-none focus:border-black focus:ring-1 focus:ring-black placeholder-gray-400 transition-all"
    const labelClass = "block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest"

    let webClientDisplayName = 'Client Name'
    if (event && event.clients) {
        if (event.clients.contact_person && event.clients.entity_name) {
            webClientDisplayName = `${event.clients.contact_person} (${event.clients.entity_name})`
        } else {
            webClientDisplayName = event.clients.contact_person || event.clients.entity_name || 'Client Name'
        }
    }

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-black pb-20 print:bg-white print:pb-0">

            {/* NAVBAR */}
            {!isClientPreview ? (
                <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap justify-between items-center sticky top-0 z-50 print:hidden bg-opacity-90 backdrop-blur shadow-sm gap-3">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full font-bold hover:bg-gray-200 transition">←</Link>
                        <div>
                            <h1 className="text-xl font-black">{event.event_code}</h1>
                            <p className="text-xs font-bold text-gray-500 uppercase">{event.clients?.entity_name}</p>
                        </div>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
                        {[
                            { id: 'quote', label: 'Quote' },
                            { id: 'settings', label: 'Settings' },
                            { id: 'history', label: `Versions & History (${versions.length})` }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-md text-xs font-black uppercase tracking-wide transition-all ${
                                    activeTab === tab.id
                                        ? 'bg-white shadow-sm text-black'
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Save Revision Button */}
                        <button
                            onClick={() => openSaveRevisionModal()}
                            className={`px-3.5 py-2 rounded text-xs font-bold transition flex items-center gap-1.5 shadow ${
                                hasUnsavedChanges
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                                    : 'bg-black text-white hover:bg-gray-800'
                            }`}
                            title="Save a new version of this quotation with reason notes"
                        >
                            <span>💾</span> {hasUnsavedChanges ? 'Save Revision *' : 'Save Revision'}
                        </button>

                        {/* Lock / Refresh Controls */}
                        <button onClick={handleRefreshMenu} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded text-xs font-bold transition flex items-center gap-1.5" title="Refresh to update to latest Menu">
                            <span>🔄</span> Refresh Menu
                        </button>

                        <button onClick={handleToggleLockMenu} className={`px-3 py-2 rounded text-xs font-bold transition flex items-center gap-1.5 ${isMenuLocked ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            <span>{isMenuLocked ? '🔒' : '🔓'}</span> {isMenuLocked ? 'Menu Locked' : 'Lock Menu'}
                        </button>

                        {isQuoteLocked ? (
                            <button onClick={() => setShowEditReasonModal(true)} className="bg-amber-500 text-white hover:bg-amber-600 px-3.5 py-2 rounded text-xs font-bold shadow transition flex items-center gap-1.5">
                                <span>✏️</span> Edit Quotation
                            </button>
                        ) : (
                            <button onClick={handleSubmitToClient} className="bg-blue-600 text-white hover:bg-blue-700 px-3.5 py-2 rounded text-xs font-bold shadow transition flex items-center gap-1.5">
                                <span>📤</span> Submit to Client
                            </button>
                        )}

                        <button onClick={handleDownloadMenuSheet} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded text-xs font-bold transition flex items-center gap-1.5">
                            <span>📄</span> Word
                        </button>
                        <button onClick={handleDownloadPDF} className="bg-black text-white px-4 py-2 rounded text-xs font-bold shadow hover:bg-gray-800 transition flex items-center gap-1.5">
                            <span>🖨️</span> PDF
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50 print:hidden shadow-sm">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-black text-black">Your Quotation</h1>
                    </div>
                    <button onClick={handleDownloadPDF} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-blue-700 transition flex items-center gap-2">
                        <span>📥</span> Download PDF
                    </button>
                </div>
            )}

            {/* QUOTE LOCKED BANNER FOR ADMIN */}
            {!isClientPreview && isQuoteLocked && (
                <div className="max-w-[210mm] mx-auto mt-4 px-4">
                    <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 px-5 py-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-base">🔒</span>
                            <span>Quotation is <strong>LOCKED TO EDIT</strong> (Submitted to Client). Click "Edit Quotation" above if you need to modify details or prices.</span>
                        </div>
                        <button onClick={() => setShowEditReasonModal(true)} className="bg-amber-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-amber-700 transition">
                            Edit Quotation
                        </button>
                    </div>
                </div>
            )}

            {/* EDIT REASON MODAL */}
            {showEditReasonModal && (
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                        <h3 className="text-lg font-black text-gray-900">Edit Quotation</h3>
                        <p className="text-xs text-gray-500 font-medium">Please enter a reason for unlocking and editing this quotation (optional):</p>
                        <textarea
                            value={editReason}
                            onChange={e => setEditReason(e.target.value)}
                            placeholder="Reason for edit (e.g. Client requested price/menu update)..."
                            className="w-full border border-gray-300 p-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 h-24"
                        />
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setShowEditReasonModal(false)} className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={handleUnlockForEdit} className="px-5 py-2 text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-lg shadow">Unlock & Edit</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SAVE REVISION MODAL */}
            {showSaveRevisionModal && (
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">💾</span>
                                <h3 className="text-lg font-black text-gray-900">Save Quotation Revision</h3>
                            </div>
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                                Next: v{(versions[0]?.versionNumber || 0) + 1}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 font-medium">
                            Every change is tracked with author and reason for full version control and audit history.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-wider">Who is making this change?</label>
                                <input
                                    type="text"
                                    value={revisionActorName}
                                    onChange={e => setRevisionActorName(e.target.value)}
                                    placeholder="Enter your name (e.g. Nagaraj, Kavya, Admin)..."
                                    className="w-full border border-gray-300 p-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-wider">
                                    Reason for this Revision / Change <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={revisionReason}
                                    onChange={e => setRevisionReason(e.target.value)}
                                    placeholder="Why was this quotation modified? (e.g. Client requested 50 additional guests for Lunch and added Live Dosa station)..."
                                    rows={3}
                                    className="w-full border border-gray-300 p-3 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t">
                            <button
                                onClick={() => setShowSaveRevisionModal(false)}
                                disabled={saving}
                                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCommitRevision}
                                disabled={saving}
                                className="px-6 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow transition flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <span>💾</span> {saving ? 'Saving Revision...' : 'Save & Record Version'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ROLLBACK / RESTORE CONFIRMATION MODAL */}
            {selectedVersionForRestore && (
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                        <div className="flex items-center gap-2 border-b pb-3">
                            <span className="text-xl">↺</span>
                            <div>
                                <h3 className="text-lg font-black text-gray-900">
                                    Restore to Version {selectedVersionForRestore.versionNumber}
                                </h3>
                                <p className="text-[11px] text-gray-500 font-medium">
                                    Originally created on {new Date(selectedVersionForRestore.createdAt).toLocaleString('en-GB')} by {selectedVersionForRestore.actorName}
                                </p>
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                            <p className="font-bold">⚠️ Notice: Reverting Quotation</p>
                            <p className="text-[11px] text-amber-800">
                                This will restore the menu selections, PAX, per-plate pricing, event dates, venue, and terms back to Version {selectedVersionForRestore.versionNumber}. A new revision version will be recorded so your history remains intact.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                Reason for Rollback <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={rollbackReason}
                                onChange={e => setRollbackReason(e.target.value)}
                                placeholder="Why are you restoring to this previous version? (e.g. Client preferred earlier pricing package)..."
                                rows={3}
                                className="w-full border border-gray-300 p-3 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500 text-black bg-white"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t">
                            <button
                                onClick={() => { setSelectedVersionForRestore(null); setRollbackReason('') }}
                                disabled={isRestoring}
                                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRestoreVersion}
                                disabled={isRestoring}
                                className="px-6 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow transition flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <span>↺</span> {isRestoring ? 'Restoring...' : `Confirm & Restore v${selectedVersionForRestore.versionNumber}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW SNAPSHOT MODAL */}
            {selectedVersionForView && (
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-black text-xs">
                                        Version {selectedVersionForView.versionNumber}
                                    </span>
                                    <span className="font-bold text-gray-700 text-sm">
                                        Snapshot by {selectedVersionForView.actorName}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    Saved on {new Date(selectedVersionForView.createdAt).toLocaleString('en-GB')}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedVersionForView(null)}
                                className="text-gray-400 hover:text-black font-bold p-2 text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 text-xs text-black">
                            {/* Reason Box */}
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider block mb-1">Reason for Revision</span>
                                <p className="font-medium text-blue-950 text-sm italic">"{selectedVersionForView.reason}"</p>
                            </div>

                            {/* Summary Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Subtotal</span>
                                    <p className="text-sm font-black text-black mt-0.5">₹{Math.round(selectedVersionForView.snapshot.financials?.grandTotal || 0).toLocaleString('en-IN')}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">GST (18%)</span>
                                    <p className="text-sm font-black text-black mt-0.5">₹{Math.round(selectedVersionForView.snapshot.financials?.gst || 0).toLocaleString('en-IN')}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Grand Total</span>
                                    <p className="text-base font-black text-emerald-600 mt-0.5">₹{Math.round(selectedVersionForView.snapshot.financials?.finalAmount || 0).toLocaleString('en-IN')}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Total Guests</span>
                                    <p className="text-sm font-black text-black mt-0.5">
                                        {selectedVersionForView.snapshot.selections?.reduce((sum, s) => sum + (s.pax || 0), 0)} PAX
                                    </p>
                                </div>
                            </div>

                            {/* Menu Selections Table */}
                            <div>
                                <h4 className="font-black text-sm uppercase tracking-wider text-gray-700 mb-2">Menu Selections in this Version</h4>
                                <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                                    {selectedVersionForView.snapshot.selections?.map((sel, sIdx) => (
                                        <div key={sIdx} className="p-3 bg-white">
                                            <div className="flex justify-between items-center font-bold mb-1">
                                                <span className="text-amber-800">{sel.category_title}</span>
                                                <span className="text-gray-600 font-mono">
                                                    {sel.pax} PAX × ₹{sel.price_per_plate} = ₹{(sel.pax * sel.price_per_plate).toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {(sel.selected_items || []).map((item, iIdx) => (
                                                    <span key={iIdx} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px]">
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Venue & Dates */}
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Event Schedule</span>
                                    <p className="font-bold text-gray-800 mt-0.5">
                                        {selectedVersionForView.snapshot.event.startDate} to {selectedVersionForView.snapshot.event.endDate || selectedVersionForView.snapshot.event.startDate}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Venue</span>
                                    <p className="font-bold text-gray-800 mt-0.5">
                                        {selectedVersionForView.snapshot.event.venueName || selectedVersionForView.snapshot.event.city || 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-medium">
                                Reviewing snapshot details for Version {selectedVersionForView.versionNumber}
                            </span>
                            <button
                                onClick={() => setSelectedVersionForView(null)}
                                className="px-5 py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FLOATING UNSAVED CHANGES BANNER */}
            {hasUnsavedChanges && !isClientPreview && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 backdrop-blur text-white px-6 py-3 rounded-2xl shadow-2xl border border-gray-700 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span className="text-xs font-bold">You have unsaved changes in this quotation</span>
                    </div>
                    <button
                        onClick={() => openSaveRevisionModal()}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-xl text-xs font-black transition shadow flex items-center gap-1.5"
                    >
                        <span>💾</span> Save Revision & Reason
                    </button>
                </div>
            )}

            <div className="max-w-[210mm] mx-auto my-4 md:my-8 overflow-x-auto print:overflow-visible print:my-0 print:max-w-full">

                {/* === QUOTE TAB === */}
                {activeTab === 'quote' && (
                    <div className="bg-white shadow-lg print:shadow-none min-h-[297mm] min-w-[700px] print:min-w-0 flex flex-col relative text-black text-sm p-8 md:p-16 font-bold">

                        {/* LOGO AREA */}
                        <div className="text-center mb-8 flex flex-col items-center">
                            {/* Logo */}
                            <img
                                src="/logo.png"
                                alt="The Rameshwaram Cafe"
                                className="w-56 object-contain mb-2"
                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                        </div>

                        {/* TO & DATE */}
                        <div className="flex justify-between items-start mb-6 text-sm">
                            <div>
                                <p>To,</p>
                                <p className="ml-4 font-bold">{webClientDisplayName}</p>
                            </div>
                            <div>
                                <p>Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')}</p>
                            </div>
                        </div>

                        {/* EVENT DATES & VENUE */}
                        <div className="mb-4 text-sm font-bold">
                            <p>Event Date : {new Date(event.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')} {days > 1 ? 'to ' + new Date(event.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : ''}</p>
                            {(event.venue_name || city) && (
                                <p className="mt-1 font-normal">Venue : {[event.venue_name, city, event.venue_zipcode].filter(Boolean).join(', ')}</p>
                            )}
                        </div>

                        {/* TABLES MAP */}
                        {selections.map((sel, idx) => {
                            const groupedItems: Record<string, string[]> = {}
                            sel.selected_items.forEach((item: string) => {
                                const station = itemStationMap[item] || 'OTHER'
                                if (!groupedItems[station]) groupedItems[station] = []
                                groupedItems[station].push(item)
                            })

                            return (
                                <div key={sel.id} className="mb-8">
                                    <table className="w-full border-collapse border border-black text-sm mt-5">
                                        <tbody>
                                            <tr>
                                                <td colSpan={2} className="border-b border-black text-center font-bold bg-gray-50 p-2 relative">
                                                    {/* Custom Alignment Arrows */}
                                                    <div className="absolute left-2 top-1/2 -translate-y-1/2 print:hidden flex gap-2">
                                                        <button
                                                            onClick={() => handleMoveCategory(idx, 'up')}
                                                            disabled={idx === 0}
                                                            className="text-gray-400 hover:text-black disabled:opacity-30 disabled:hover:text-gray-400 text-xs"
                                                            title="Move Up"
                                                        >
                                                            ▲
                                                        </button>
                                                        <button
                                                            onClick={() => handleMoveCategory(idx, 'down')}
                                                            disabled={idx === selections.length - 1}
                                                            className="text-gray-400 hover:text-black disabled:opacity-30 disabled:hover:text-gray-400 text-xs"
                                                            title="Move Down"
                                                        >
                                                            ▼
                                                        </button>
                                                    </div>

                                                    {sel.category_title} (
                                                    <span className="print:hidden mx-1">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={sel.pax}
                                                            onChange={(e) => handleUpdateLineItem(sel.id, 'pax', e.target.value)}
                                                            className="w-16 mx-1 border border-gray-300 rounded text-center px-1 text-xs"
                                                        />
                                                    </span>
                                                    <span className="hidden print:inline">{sel.pax}</span>
                                                    PAX )
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="border-r border-black p-4 align-top w-3/4">
                                                    {Object.entries(groupedItems).map(([station, items], sIdx) => (
                                                        <div key={sIdx} className="mb-3 last:mb-0">
                                                             {station === 'OTHER' ? (
                                                                 <h4 className="font-bold text-amber-700 text-sm uppercase tracking-wider mb-1">Custom Requests</h4>
                                                             ) : (
                                                                 <h4 className="font-bold text-amber-700 text-sm uppercase tracking-wider mb-1">{station}</h4>
                                                             )}
                                                             <ul className="list-none leading-tight space-y-0.5">
                                                                {items.map((item, i) => (
                                                                    <li key={i}>{item}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ))}
                                                </td>
                                                <td className="p-4 align-top text-center font-bold w-1/4 pt-6">
                                                    <div className="flex flex-col items-center justify-start h-full gap-2">
                                                        {/* For Admin: Edit per plate cost */}
                                                        {!isClientPreview && (
                                                            <div className="flex items-center justify-center text-xs text-gray-500 print:hidden font-normal w-full">
                                                                <span className="mr-1">Per Plate: Rs.</span>
                                                                <input
                                                                    type="number"
                                                                    value={sel.price_per_plate}
                                                                    onChange={(e) => handleUpdateLineItem(sel.id, 'price_per_plate', e.target.value)}
                                                                    className="w-16 text-center bg-transparent border-b border-gray-300 focus:border-black outline-none font-bold text-black"
                                                                />
                                                                <span>/-</span>
                                                            </div>
                                                        )}
                                                        {/* Total Amount (Visible to Client and Print) */}
                                                        <div className="flex items-center text-base mt-2">
                                                            <span className="mr-1 text-xs text-gray-600 font-normal">Total:</span>
                                                            <span className="mr-1">Rs.</span>
                                                            <span className="font-bold">{((sel.price_per_plate || 0) * (sel.pax || 0)).toLocaleString('en-IN')}</span>
                                                            <span className="ml-1">/-</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )
                        })}

                        {/* PAGE BREAK MAYBE FOR PRINT */}
                        <div className="print:break-inside-avoid text-sm mt-8">
                            {/* NOTE */}
                            <div className="mb-10 group">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="uppercase font-bold">NOTE:</p>
                                    {/* Action Buttons */}
                                    {!isClientPreview && (
                                        <div className="mt-8 flex gap-4">
                                            <button
                                                onClick={() => {
                                                    setTerms([...terms, { id: 't' + Date.now(), text: 'New Condition...', selected: true }])
                                                    setHasUnsavedChanges(true)
                                                }}
                                                className="bg-gray-100 hover:bg-gray-200 text-black px-6 py-2 rounded text-sm font-bold uppercase tracking-wide transition shadow-sm active:scale-95 border-2 border-dashed border-gray-300"
                                            >
                                                + Add Condition
                                            </button>
                                            <button
                                                onClick={handleSaveSettings}
                                                disabled={saving || !hasUnsavedChanges}
                                                className="bg-black text-white px-8 py-2 rounded text-sm font-bold uppercase tracking-wide hover:bg-gray-800 transition shadow-lg active:scale-95 disabled:opacity-50"
                                            >
                                                {saving ? 'Saving...' : 'Save Terms'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {terms.map((term, index) => (
                                        <div key={term.id} className={`flex items-start gap-3 ${!term.selected && 'print:hidden'} ${(!term.selected && isClientPreview) ? 'hidden' : ''}`}>
                                            {!isClientPreview && (
                                                <div className="pt-1 print:hidden">
                                                    <input
                                                        type="checkbox"
                                                        checked={term.selected}
                                                        onChange={(e) => {
                                                            const newTerms = [...terms]
                                                            newTerms[index].selected = e.target.checked
                                                            setTerms(newTerms)
                                                            setHasUnsavedChanges(true)
                                                        }}
                                                        className="w-4 h-4 text-black rounded border-gray-300 focus:ring-black cursor-pointer"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 flex items-start gap-2">
                                                <span className={`font-medium ${!term.selected ? 'text-gray-400' : ''}`}>
                                                    {index + 1}.
                                                </span>
                                                <input
                                                    type="text"
                                                    value={term.text}
                                                    onChange={(e) => {
                                                        const newTerms = [...terms]
                                                        newTerms[index].text = e.target.value
                                                        setTerms(newTerms)
                                                        setHasUnsavedChanges(true)
                                                    }}
                                                    className={`w-full bg-transparent border-b border-transparent hover:border-gray-200 focus:border-black outline-none transition-colors ${!term.selected ? 'text-gray-400 line-through decoration-gray-300' : ''}`}
                                                    placeholder="Enter term condition..."
                                                />
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setTerms(terms.filter(t => t.id !== term.id))
                                                    setHasUnsavedChanges(true)
                                                }}
                                                className="text-gray-400 hover:text-red-500 font-bold px-2 print:hidden opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                                title="Remove Condition"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* BANK DETAILS */}
                            <div>
                                <p className="mb-2 font-bold">Bank Details:</p>
                                <table className="border-collapse border border-black text-center text-sm w-96">
                                    <tbody>
                                        <tr>
                                            <td className="border border-black p-1 px-4 text-xs whitespace-nowrap text-left">A/c Holder's Name</td>
                                            <td className="border border-black p-1 px-4 uppercase text-xs">THE RAMESHWARAM CAFE</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1 px-4 text-xs text-left">Bank Name</td>
                                            <td className="border border-black p-1 px-4 uppercase text-xs">HDFC BANK LTD</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1 px-4 text-xs text-left">A/c No</td>
                                            <td className="border border-black p-1 px-4 text-xs">50200012345678</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1 px-4 text-xs text-left">IFS Code</td>
                                            <td className="border border-black p-1 px-4 text-xs">HDFC0000123</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1 px-4 text-xs text-left">Branch</td>
                                            <td className="border border-black p-1 px-4 uppercase text-xs">{appSettings?.bank_branch || "Vasant Vihar"}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* ANNEXURE C */}
                            <div className="mt-8">
                                <p className="mb-2 font-bold text-[#417ab9]">Annexure C - Event Timings & Extension Charges</p>
                                <table className="border-collapse border border-black text-center text-sm w-[36rem]">
                                    <thead>
                                        <tr>
                                            <td className="border border-black p-1 px-4 text-xs text-left font-bold w-1/3">Meal Type</td>
                                            <td className="border border-black p-1 px-4 text-xs font-bold w-1/3">Timings</td>
                                            <td className="border border-black p-1 px-4 text-xs font-bold w-1/3">Extension Charges (₹/Hour)</td>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="border border-black p-1 px-4 text-xs text-left">Breakfast</td>
                                            <td className="border border-black p-1 px-4 text-xs">7:00 AM - 11:00 AM</td>
                                            <td className="border border-black p-1 px-4 text-xs">50,000</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1 px-4 text-xs text-left">Lunch</td>
                                            <td className="border border-black p-1 px-4 text-xs">12:00 PM - 3:00 PM</td>
                                            <td className="border border-black p-1 px-4 text-xs">50,000</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1 px-4 text-xs text-left">High Tea</td>
                                            <td className="border border-black p-1 px-4 text-xs">4:00 PM - 7:00 PM</td>
                                            <td className="border border-black p-1 px-4 text-xs">50,000</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-1 px-4 text-xs text-left">Dinner</td>
                                            <td className="border border-black p-1 px-4 text-xs">7:00 PM - 11:00 PM</td>
                                            <td className="border border-black p-1 px-4 text-xs">50,000</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                )}

                {/* === SETTINGS TAB === */}
                {activeTab === 'settings' && (
                    <div className="bg-white p-8 rounded shadow-sm border border-gray-200">
                        <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                            <h3 className="font-black text-2xl text-black">Event Details</h3>
                            <button
                                onClick={handleSaveSettings}
                                disabled={saving}
                                className="bg-black text-white px-8 py-3 rounded text-sm font-bold uppercase tracking-wide hover:bg-gray-800 transition shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

                            {/* LEFT COL */}
                            <div className="space-y-8">

                                {/* NEW: CLIENT DETAILS */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-black uppercase tracking-widest border-b border-gray-200 pb-2">Client Details</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className={labelClass}>Client Name</label>
                                            <input className={inputClass} value={clientName} onChange={e => { setClientName(e.target.value); setHasUnsavedChanges(true) }} />
                                        </div>
                                        <div><label className={labelClass}>GST Number</label><input className={inputClass} value={clientGst} onChange={e => { setClientGst(e.target.value); setHasUnsavedChanges(true) }} /></div>
                                        <div><label className={labelClass}>Contact Person</label><input className={inputClass} value={clientContact} onChange={e => { setClientContact(e.target.value); setHasUnsavedChanges(true) }} /></div>
                                        <div><label className={labelClass}>Mobile</label><input className={inputClass} value={clientMobile} onChange={e => { setClientMobile(e.target.value); setHasUnsavedChanges(true) }} /></div>
                                        <div><label className={labelClass}>Email</label><input className={inputClass} value={clientEmail} onChange={e => { setClientEmail(e.target.value); setHasUnsavedChanges(true) }} /></div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-black uppercase tracking-widest border-b border-gray-200 pb-2">Schedule & Type</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Start Date</label><input type="date" className={inputClass} value={startDate} onChange={e => { setStartDate(e.target.value); setHasUnsavedChanges(true); if (!endDate) setEndDate(e.target.value) }} /></div>
                                        <div><label className={labelClass}>End Date</label><input type="date" className={inputClass} value={endDate} onChange={e => { setEndDate(e.target.value); setHasUnsavedChanges(true) }} min={startDate} /></div>
                                    </div>
                                    {days > 0 && <div className="bg-gray-100 p-2 rounded text-center text-xs font-bold text-black uppercase tracking-wide">{days} Day Event</div>}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Event Type</label>
                                            <select className={inputClass} value={eventType} onChange={e => { setEventType(e.target.value as any); setHasUnsavedChanges(true) }}>
                                                <option value="B2B">B2B (Corporate)</option>
                                                <option value="B2C">B2C</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Size Category</label>
                                            <select className={inputClass} value={eventSize} onChange={e => { setEventSize(e.target.value as any); setHasUnsavedChanges(true) }}>
                                                <option value="Small">Small (Green)</option>
                                                <option value="Large">Large (Red)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-black uppercase tracking-widest border-b border-gray-200 pb-2">Point of Contact (Event Specific)</h4>
                                    <div><label className={labelClass}>POC Name</label><input className={inputClass} value={pocName} onChange={e => { setPocName(e.target.value); setHasUnsavedChanges(true) }} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Mobile</label><input className={inputClass} value={pocMobile} onChange={e => { setPocMobile(e.target.value); setHasUnsavedChanges(true) }} /></div>
                                        <div><label className={labelClass}>Email</label><input className={inputClass} value={pocEmail} onChange={e => { setPocEmail(e.target.value); setHasUnsavedChanges(true) }} /></div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COL */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-black text-black uppercase tracking-widest border-b border-gray-200 pb-2">Venue Location</h4>

                                <div>
                                    <label className={labelClass}>Google Maps Link</label>
                                    <input
                                        className={`${inputClass} text - blue - 600 underline`}
                                        value={googleMapsLink}
                                        onChange={e => { setGoogleMapsLink(e.target.value); setHasUnsavedChanges(true) }}
                                        placeholder="Paste maps link..."
                                    />
                                </div>

                                <div className="h-64 border border-gray-200 rounded overflow-hidden">
                                    <EventMap onLocationSelect={handleMapSelect} />
                                </div>

                                <div><label className={labelClass}>Venue Name</label><input className={`${inputClass} text - lg`} value={venueName} onChange={e => { setVenueName(e.target.value); setHasUnsavedChanges(true) }} /></div>
                                <div><label className={labelClass}>Address</label><textarea className={`${inputClass} h - 20`} value={fullAddress} onChange={e => { setFullAddress(e.target.value); setHasUnsavedChanges(true) }} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className={labelClass}>City</label><input className={inputClass} value={city} onChange={e => { setCity(e.target.value); setHasUnsavedChanges(true) }} /></div>
                                    <div><label className={labelClass}>State</label><input className={inputClass} value={state} onChange={e => { setState(e.target.value); setHasUnsavedChanges(true) }} /></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* === VERSIONS & HISTORY TAB === */}
                {activeTab === 'history' && (
                    <div className="space-y-6">
                        {/* Header Banner */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-black text-black">Quotation Version Control & History</h3>
                                    <span className="bg-blue-50 text-blue-700 text-xs font-black px-2.5 py-0.5 rounded-full border border-blue-200">
                                        {versions.length} {versions.length === 1 ? 'Version' : 'Versions'} Recorded
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 font-medium mt-1">
                                    Full audit trail of every change made to this quotation. Track who changed it, why, and roll back if needed.
                                </p>
                            </div>

                            <button
                                onClick={() => openSaveRevisionModal()}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2 shrink-0 self-start sm:self-auto"
                            >
                                <span>💾</span> Save New Revision
                            </button>
                        </div>

                        {/* Versions List */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider px-1">
                                Revision History Timeline
                            </h4>

                            {versions.length === 0 ? (
                                <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-400 font-bold text-sm">
                                    No revisions recorded yet. Click "Save New Revision" to record the first version snapshot!
                                </div>
                            ) : (
                                versions.map((ver, idx) => {
                                    const isLatest = idx === 0
                                    const totalGuests = ver.snapshot.selections?.reduce((sum, s) => sum + (s.pax || 0), 0) || 0
                                    const finalTotal = ver.snapshot.financials?.finalAmount || 0

                                    return (
                                        <div
                                            key={ver.id || idx}
                                            className={`bg-white rounded-2xl p-6 shadow-sm border transition ${
                                                isLatest
                                                    ? 'border-blue-400 ring-2 ring-blue-100'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                {/* Left Info */}
                                                <div className="space-y-3 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="bg-black text-white px-3 py-1 rounded-lg text-xs font-black tracking-wider">
                                                            VERSION {ver.versionNumber}
                                                        </span>

                                                        {isLatest && (
                                                            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-md text-[11px] font-black flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                                Current Active Version
                                                            </span>
                                                        )}

                                                        <span className="text-gray-400">•</span>
                                                        {(() => {
                                                            const raw = ver.actorName || 'System'
                                                            const match = raw.match(/^([^(]+)(?:\s*\(([^)]+)\))?$/)
                                                            const name = match ? match[1].trim() : raw
                                                            const email = match && match[2] ? match[2].trim() : ''

                                                            return (
                                                                <span className="inline-flex items-center gap-1.5 text-xs font-black text-gray-800 bg-gray-100 px-2.5 py-0.5 rounded-md border border-gray-200">
                                                                    <span>👤</span> {name}
                                                                    {email && (
                                                                        <span className="font-semibold text-gray-500 text-[11px] font-mono">({email})</span>
                                                                    )}
                                                                </span>
                                                            )
                                                        })()}

                                                        <span className="text-gray-400">•</span>
                                                        <span className="text-xs text-gray-400 font-medium">
                                                            {new Date(ver.createdAt).toLocaleString('en-GB', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </span>
                                                    </div>

                                                    {/* Reason Box */}
                                                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs">
                                                        <span className="font-black text-[10px] text-amber-800 uppercase tracking-wider block mb-0.5">
                                                            Reason for Revision / Change:
                                                        </span>
                                                        <p className="font-bold text-gray-900 text-sm">
                                                            "{ver.reason}"
                                                        </p>
                                                    </div>

                                                    {/* Changes Summary */}
                                                    {ver.changesSummary && (
                                                        <p className="text-[11px] text-gray-500 font-medium">
                                                            <span className="font-black text-gray-400 uppercase text-[10px] mr-1">Diff Summary:</span>
                                                            {ver.changesSummary}
                                                        </p>
                                                    )}

                                                    {/* Snapshot Metrics */}
                                                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-600 pt-1">
                                                        <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                                            <span className="text-gray-400 text-[10px] uppercase mr-1.5 font-normal">Total:</span>
                                                            <span className="text-black font-black">₹{Math.round(finalTotal).toLocaleString('en-IN')}</span>
                                                        </div>
                                                        <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                                            <span className="text-gray-400 text-[10px] uppercase mr-1.5 font-normal">PAX:</span>
                                                            <span className="text-black font-black">{totalGuests}</span>
                                                        </div>
                                                        <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                                            <span className="text-gray-400 text-[10px] uppercase mr-1.5 font-normal">Meals:</span>
                                                            <span className="text-black font-black">{ver.snapshot.selections?.length || 0}</span>
                                                        </div>
                                                        <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                                            <span className="text-gray-400 text-[10px] uppercase mr-1.5 font-normal">Dates:</span>
                                                            <span className="text-gray-800">{ver.snapshot.event.startDate || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Actions */}
                                                <div className="flex sm:flex-col items-center sm:items-stretch gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
                                                    <button
                                                        onClick={() => setSelectedVersionForView(ver)}
                                                        className="flex-1 sm:flex-initial bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                                                    >
                                                        <span>👁️</span> View Snapshot
                                                    </button>

                                                    {!isLatest ? (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedVersionForRestore(ver)
                                                                setRollbackReason(`Restoring to Version ${ver.versionNumber}`)
                                                            }}
                                                            className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                                                            title="Roll back to this version"
                                                        >
                                                            <span>↺</span> Restore This
                                                        </button>
                                                    ) : (
                                                        <span className="text-center text-[10px] font-bold text-gray-400 py-1">
                                                            Current Version
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Event Audit Trail */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
                            <div className="flex items-center justify-between border-b pb-3">
                                <div>
                                    <h4 className="font-black text-sm uppercase tracking-wider text-black">
                                        Quotation Activity Log
                                    </h4>
                                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                                        Every action taken on {event.event_code} by admins, staff, and clients
                                    </p>
                                </div>
                                <span className="text-xs text-gray-400 font-bold">
                                    {eventAuditLogs.length} Records
                                </span>
                            </div>

                            {eventAuditLogs.length === 0 ? (
                                <p className="text-center text-gray-400 py-6 text-xs font-medium">
                                    No separate actions recorded yet for this quotation.
                                </p>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {eventAuditLogs.map((log, idx) => (
                                        <div key={log.id || idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    {(() => {
                                                        const raw = log.actorName || 'System'
                                                        const match = raw.match(/^([^(]+)(?:\s*\(([^)]+)\))?$/)
                                                        const name = match ? match[1].trim() : raw
                                                        const email = match && match[2] ? match[2].trim() : ''

                                                        return (
                                                            <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100 inline-flex items-center gap-1.5">
                                                                <span>👤</span> {name}
                                                                {email && (
                                                                    <span className="text-blue-500 font-semibold text-[11px] font-mono">({email})</span>
                                                                )}
                                                            </span>
                                                        )
                                                    })()}
                                                    <span className="font-black text-gray-900">
                                                        {log.action}
                                                    </span>
                                                </div>
                                                {log.details && (
                                                    <p className="text-[11px] text-gray-500 italic pl-1">
                                                        {log.details}
                                                    </p>
                                                )}
                                            </div>
                                            {log.timestamp && (
                                                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                                                    {new Date(log.timestamp).toLocaleString('en-GB')}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div >
    )
}