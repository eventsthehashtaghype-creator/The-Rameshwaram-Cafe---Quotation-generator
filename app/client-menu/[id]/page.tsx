'use client'
import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { logActivity } from '@/app/lib/audit'
import { MenuPreset, getAllPresets, saveCustomPreset, deleteCustomPreset } from '@/app/lib/presets'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// --- TYPES ---
type MenuCategory = { id: string; title: string; default_price: number; stations: any[] }
type DaySession = { dayIndex: number; dateStr: string; categoryId: string; pax: number }
type SelectionKey = string // Format: "${dayIndex}_${categoryId}"

function ClientMenuContent() {
    const { id } = useParams()
    const searchParams = useSearchParams()
    const router = useRouter()
    const isPreview = searchParams.get('preview') === 'true' // Check for preview mode
    const isPrint = searchParams.get('print') === 'true' // Trigger print dialog on load

    const [event, setEvent] = useState<any>(null)

    // WIZARD STATE
    const [step, setStep] = useState(1) // 1=Config, 2=SelectionHub, 3=ItemSelection, 4=Preview
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [allowEdit, setAllowEdit] = useState(false)
    const [isLockedByDate, setIsLockedByDate] = useState(false)
    const [isMenuLockedByAdmin, setIsMenuLockedByAdmin] = useState(false)

    // DATA STATE
    const [menuData, setMenuData] = useState<MenuCategory[]>([])
    const [loading, setLoading] = useState(true)
    const [eventDays, setEventDays] = useState<string[]>([])

    // USER SELECTIONS
    const [sessionConfig, setSessionConfig] = useState<Record<SelectionKey, number>>({})
    const [menuSelections, setMenuSelections] = useState<Record<SelectionKey, string[]>>({})

    // ACTIVE SESSION (For Step 3)
    const [activeSession, setActiveSession] = useState<{ dayIndex: number; categoryId: string } | null>(null)
    const [expandedStations, setExpandedStations] = useState<Record<string, boolean>>({})

    // PRESET MENUS STATE
    const [presets, setPresets] = useState<MenuPreset[]>([])
    const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false)
    const [newPresetName, setNewPresetName] = useState('')
    const [newPresetDesc, setNewPresetDesc] = useState('')
    const [presetToast, setPresetToast] = useState<string | null>(null)

    useEffect(() => {
        setPresets(getAllPresets())
    }, [])

    // 1. FETCH DATA
    useEffect(() => {
        async function fetchData() {
            setLoading(true)

            // A. Fetch Event
            let dateLocked = false
            const { data: eventData } = await supabase.from('events').select('*, clients(*)').eq('id', id).single()
            if (eventData) {
                setEvent(eventData)
                const eventDate = new Date(eventData.event_date)
                eventDate.setHours(0, 0, 0, 0)
                const limitDate = new Date(eventDate)
                limitDate.setDate(limitDate.getDate() - 2)
                const today = new Date()
                dateLocked = today >= limitDate
                setIsLockedByDate(dateLocked)
                const adminLocked = eventData.menu_locked === true
                setIsMenuLockedByAdmin(adminLocked)

                const isLocked = dateLocked || adminLocked || ['client_submitted', 'edit_requested'].includes(eventData.quote_status) || ['pending_admin_approval', 'sent', 'confirmed', 'cancelled', 'edit_requested'].includes(eventData.status)
                if (isLocked && !isPreview) setSubmitted(true) // Block editing if already submitted/locked

                // Calculate Days
                const start = new Date(eventData.event_date)
                const end = eventData.end_date ? new Date(eventData.end_date) : start
                const days: string[] = []
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    days.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))
                }
                setEventDays(days)
            }

            // B. Fetch Menu Structure
            const { data: cats } = await supabase.from('menu_categories').select('*').order('sort_order')
            const { data: stations } = await supabase.from('menu_stations').select('*').order('sort_order')
            const { data: items } = await supabase.from('menu_items').select('*').order('name')

            if (cats && stations && items) {
                const fullMenu = cats.map(cat => ({
                    ...cat,
                    stations: stations.filter(s => s.category_id === cat.id).map(st => ({
                        ...st,
                        items: items.filter(i => i.station_id === st.id)
                    }))
                }))
                setMenuData(fullMenu)
            }

            // C. Fetch Existing Selections (Restore State)
            const { data: selections } = await supabase.from('menu_selections').select('*').eq('event_id', id)

            // Local Storage Recovery
            let restoredFromLocal = false
            const localConfig = localStorage.getItem(`menu_config_${id}`)
            const localSels = localStorage.getItem(`menu_sels_${id}`)
            const isLocked = eventData ? (dateLocked || eventData.menu_locked === true || ['client_submitted', 'edit_requested'].includes(eventData.quote_status) || ['pending_admin_approval', 'sent', 'confirmed', 'cancelled', 'edit_requested'].includes(eventData.status)) : false

            if (localConfig && localSels && !isLocked) {
                try {
                    setSessionConfig(JSON.parse(localConfig))
                    setMenuSelections(JSON.parse(localSels))
                    restoredFromLocal = true
                    console.log("Restored transient session from LocalStorage")
                } catch (e) { }
            }

            if (selections && selections.length > 0 && !restoredFromLocal) {
                const newConfig: Record<SelectionKey, number> = {}
                const newSelections: Record<SelectionKey, string[]> = {}

                selections.forEach((sel: any) => {
                    const dayMatch = sel.category_title.match(/Day (\d+)/)
                    const dayIndex = dayMatch ? parseInt(dayMatch[1]) - 1 : 0
                    const key = `${dayIndex}_${sel.category_id}`
                    newConfig[key] = sel.pax
                    newSelections[key] = typeof sel.selected_items === 'string' ? JSON.parse(sel.selected_items) : sel.selected_items
                })

                setSessionConfig(newConfig)
                setMenuSelections(newSelections)

                if (isPreview || isLocked) {
                    setStep(4)
                }
            } else if (restoredFromLocal && (isPreview || isLocked)) {
                setStep(4)
            }

            setLoading(false)
        }
        if (id) fetchData()
    }, [id, isPreview])

    // AUTO-SAVE TO LOCAL STORAGE
    useEffect(() => {
        if (!loading && !submitted && !isPreview && Object.keys(sessionConfig).length > 0) {
            localStorage.setItem(`menu_config_${id}`, JSON.stringify(sessionConfig))
            localStorage.setItem(`menu_sels_${id}`, JSON.stringify(menuSelections))
        }
    }, [sessionConfig, menuSelections, loading, submitted, isPreview, id])

    // --- HELPERS ---
    const getSessionKey = (dayIndex: number, catId: string) => `${dayIndex}_${catId}`

    const toggleSession = (dayIndex: number, catId: string) => {
        const key = getSessionKey(dayIndex, catId)
        setSessionConfig(prev => {
            if (prev[key] !== undefined) {
                const copy = { ...prev }; delete copy[key]; return copy
            }
            return { ...prev, [key]: 0 } // Enable with 0 pax
        })
    }

    const toggleStation = (stationId: string) => {
        setExpandedStations(prev => ({ ...prev, [stationId]: !prev[stationId] }))
    }

    const updatePax = (dayIndex: number, catId: string, val: string) => {
        const key = getSessionKey(dayIndex, catId)
        const num = Math.max(0, parseInt(val) || 0)
        setSessionConfig(prev => ({ ...prev, [key]: num }))
    }

    const handleAddCustomItem = () => {
        if (!activeSession || event?.menu_locked) {
            if (event?.menu_locked) alert("Menu is locked by administrator. Changes cannot be made.")
            return
        }
        const key = getSessionKey(activeSession.dayIndex, activeSession.categoryId)
        const input = document.getElementById('custom-item-input') as HTMLInputElement
        const name = input?.value?.trim()
        if (!name) return

        setMenuSelections(prev => {
            const current = prev[key] || []
            if (current.includes(name)) {
                alert("This item is already added/selected.")
                return prev
            }
            return {
                ...prev,
                [key]: [...current, name]
            }
        })
        if (input) input.value = ''
    }

    const removeCustomItem = (name: string) => {
        if (!activeSession || event?.menu_locked) {
            if (event?.menu_locked) alert("Menu is locked by administrator. Changes cannot be made.")
            return
        }
        const key = getSessionKey(activeSession.dayIndex, activeSession.categoryId)
        setMenuSelections(prev => {
            const current = prev[key] || []
            return {
                ...prev,
                [key]: current.filter(i => i !== name)
            }
        })
    }

    const showPresetToast = (msg: string) => {
        setPresetToast(msg)
        setTimeout(() => setPresetToast(null), 3500)
    }

    const applyPreset = (preset: MenuPreset, dayIndex: number, categoryId: string, replace: boolean = true) => {
        if (event?.menu_locked) {
            alert("Menu is locked by administrator. Changes cannot be made.")
            return
        }
        const key = getSessionKey(dayIndex, categoryId)
        const current = menuSelections[key] || []
        const nextItems = replace ? [...preset.items] : Array.from(new Set([...current, ...preset.items]))
        
        setMenuSelections(prev => ({
            ...prev,
            [key]: nextItems
        }))
        showPresetToast(`Applied preset "${preset.name}" (${preset.items.length} items)`)
    }

    const clearActiveSessionItems = () => {
        if (!activeSession || event?.menu_locked) {
            if (event?.menu_locked) alert("Menu is locked by administrator. Changes cannot be made.")
            return
        }
        if (!confirm("Clear all selected items for this session?")) return
        const key = getSessionKey(activeSession.dayIndex, activeSession.categoryId)
        setMenuSelections(prev => ({ ...prev, [key]: [] }))
        showPresetToast("Cleared all selected items for this session")
    }

    const handleSaveCurrentAsPreset = () => {
        if (!activeSession) return
        const key = getSessionKey(activeSession.dayIndex, activeSession.categoryId)
        const items = menuSelections[key] || []
        if (items.length === 0) {
            alert("Please select at least one item before saving as a preset.")
            return
        }
        if (!newPresetName.trim()) {
            alert("Please enter a name for your preset menu.")
            return
        }

        const activeCat = menuData.find(c => c.id === activeSession.categoryId)
        const catUpper = (activeCat?.title || '').toUpperCase()
        const mealCat = (catUpper.includes('BREAKFAST') ? 'BREAKFAST'
            : catUpper.includes('LUNCH') ? 'LUNCH'
            : catUpper.includes('HI-TEA') || catUpper.includes('TEA') ? 'HI-TEA'
            : catUpper.includes('DINNER') ? 'DINNER'
            : 'ALL') as any

        saveCustomPreset({
            name: newPresetName.trim(),
            description: newPresetDesc.trim() || `Custom preset for ${activeCat?.title || 'Session'} with ${items.length} items`,
            mealCategory: mealCat,
            items: [...items],
        })

        setPresets(getAllPresets())
        setIsSavePresetModalOpen(false)
        setNewPresetName('')
        setNewPresetDesc('')
        showPresetToast(`Saved preset "${newPresetName.trim()}" successfully!`)
    }

    const handleDeleteCustomPreset = (presetId: string, name: string) => {
        if (!confirm(`Delete custom preset "${name}"?`)) return
        deleteCustomPreset(presetId)
        setPresets(getAllPresets())
        showPresetToast(`Deleted preset "${name}"`)
    }

    const toggleMenuItem = (item: string, station?: any) => {
        if (!activeSession || event?.menu_locked) {
            if (event?.menu_locked) alert("Menu is locked by administrator. Changes cannot be made.")
            return
        }
        const key = getSessionKey(activeSession.dayIndex, activeSession.categoryId)
        
        setMenuSelections(prev => {
            const current = prev[key] || []
            const isSelected = current.includes(item)

            if (!isSelected && station && station.selection_type) {
                const match = station.selection_type.match(/\d+/)
                if (match) {
                    const limit = parseInt(match[0])
                    const stationItemNames = station.items.map((i: any) => i.name)
                    const currentlySelected = current.filter(name => stationItemNames.includes(name)).length
                    
                    if (currentlySelected >= limit) {
                        alert(`You can only select up to ${limit} items from ${station.name}.`)
                        return prev
                    }
                }
            }

            return isSelected
                ? { ...prev, [key]: current.filter(i => i !== item) }
                : { ...prev, [key]: [...current, item] }
        })
    }

    const getPricePerPlate = (mealType: string, pax: number, totalDays: number): number => {
        const paxSafe = pax || 0
        
        if (mealType.toUpperCase() === 'BANANA LEAF MEAL') {
             if (paxSafe >= 1000) return 1800
             if (paxSafe >= 500) return 2000
             if (paxSafe >= 200) return 2500
             return 3000 // 100 pax base
        }

        // Standard Slabs (Breakfast, Lunch, High Tea, Dinner)
        if (paxSafe >= 1000) {
            return 1000
        } else if (paxSafe >= 500) {
            return 1200
        } else if (paxSafe >= 200) {
            if (totalDays >= 2) return 1300
            else return 1500
        } else { // 100 pax base
            if (totalDays >= 3) return 1500
            else if (totalDays === 2) return 1800
            else return 2000
        }
    }

    const calculateTotal = () => {
        let total = 0
        Object.keys(sessionConfig).forEach(key => {
            const [dayIdx, catId] = key.split('_')
            const cat = menuData.find(c => c.id === catId)
            const pax = sessionConfig[key]
            if (cat && pax > 0) {
                total += (getPricePerPlate(cat.title, pax, eventDays.length) * pax)
            }
        })
        return total
    }

    // DOWNLOAD PDF: jsPDF implementation mapping Quotation layout
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
        const curDate = new Date().toLocaleDateString('en-GB').replace(/ /g, '-')
        const eventDateStr = new Date(event.event_date).toLocaleDateString('en-GB')

        let clientDisplayName = 'Client Name'
        if (event.clients) {
            clientDisplayName = event.clients.entity_name || event.clients.contact_person || 'Client'
        }

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text('To,', 14, yPos)

        doc.setFont('helvetica', 'bold')
        doc.text(clientDisplayName, 22, yPos + 6)

        doc.setFont('helvetica', 'normal')
        doc.text(`Date: ${curDate}`, doc.internal.pageSize.getWidth() - 14, yPos, { align: 'right' })

        yPos += 15
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('CONFIRMED MENU SELECTION', doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' })

        yPos += 15
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(`Event Date : ${eventDateStr}`, 14, yPos)
        yPos += 10

        // Build item to station map
        const itemStationMap: Record<string, string> = {}
        menuData.forEach(cat => {
            cat.stations?.forEach((st: any) => {
                st.items?.forEach((it: any) => {
                    itemStationMap[it.name] = st.name
                })
            })
        })

        // 3. Render Tables natively using autoTable
        eventDays.forEach((dayLabel, dayIndex) => {
            const daySessions = Object.keys(sessionConfig).filter(k => k.startsWith(`${dayIndex}_`))
            if (daySessions.length === 0) return

            // Removed external Day Header logic. Now merging Day into the Table Header.

            daySessions.forEach(key => {
                const catId = key.split('_')[1]
                const cat = menuData.find(c => c.id === catId)
                const pax = sessionConfig[key]
                const items = menuSelections[key] || []

                if (!cat) return

                const groupedItems: Record<string, string[]> = {}
                items.forEach((item: string) => {
                    const station = itemStationMap[item] || 'OTHER'
                    if (!groupedItems[station]) groupedItems[station] = []
                    groupedItems[station].push(item)
                })

                let contentBody: any[] = []

                if (items.length === 0) {
                    contentBody.push([{ content: 'No items selected.', styles: { fontStyle: 'italic', textColor: [220, 38, 38], cellPadding: { top: 6, bottom: 6, left: 40 } } }])
                } else {
                    // Spacer at top
                    contentBody.push([{ content: '', styles: { cellPadding: 2 } }])

                    Object.entries(groupedItems).forEach(([station, items]) => {
                        if (station !== 'OTHER') {
                            contentBody.push([{ content: station.toUpperCase(), styles: { fontStyle: 'bold', textColor: [180, 83, 9], cellPadding: { top: 4, bottom: 1, left: 40 }, fontSize: 11, halign: 'left' } }]) // Amber color
                        }
                        const itemsStr = items.join('\n')
                        contentBody.push([{ content: itemsStr, styles: { fontStyle: 'bold', cellPadding: { top: 1, bottom: 6, left: 40 }, halign: 'left', fontSize: 10 } }])
                    })

                    // Spacer at bottom
                    contentBody.push([{ content: '', styles: { cellPadding: 2 } }])
                }

                if (yPos > doc.internal.pageSize.getHeight() - 40) {
                    doc.addPage()
                    yPos = 20
                }

                autoTable(doc, {
                    startY: yPos + 2,
                    head: [[`DAY ${dayIndex + 1} - ${dayLabel} -${cat.title}( ${pax} PAX )`]],
                    body: contentBody,
                    theme: 'plain', // Removes inner grid lines
                    tableLineColor: [0, 0, 0],
                    tableLineWidth: 0.1, // Outer border
                    styles: {
                        font: 'helvetica',
                        fontSize: 10,
                        textColor: [0, 0, 0],
                    },
                    headStyles: {
                        fillColor: [255, 255, 255],
                        textColor: [0, 0, 0],
                        fontStyle: 'bold',
                        halign: 'left',
                        valign: 'middle',
                        cellPadding: 4,
                        lineWidth: 0.1, // Only draws line for the header cell borders (bottom line!) 
                        lineColor: [0, 0, 0]
                    },
                    bodyStyles: {
                        halign: 'left',
                        valign: 'top',
                    },
                    columnStyles: {
                        0: { cellWidth: 'auto' }
                    },
                    margin: { left: 14, right: 14 },
                    didDrawPage: (data) => {
                        yPos = data.cursor ? data.cursor.y : yPos
                    }
                })

                // Add minor gap between sessions
                yPos += 8
            })

            // Add major gap between days
            yPos += 5
        })

        doc.save(`Menu_Selection_${event.event_code}.pdf`)
    }

    // Download Trigger Hook
    useEffect(() => {
        if (isPrint && !loading && menuData.length > 0 && event) {
            handleDownloadPDF()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPrint, loading, menuData, event])

    const handleSubmit = async () => {
        setSubmitting(true)

        const payload = []
        for (const key in sessionConfig) {
            const [dayIdx, catId] = key.split('_')
            const dayIndex = parseInt(dayIdx)
            const cat = menuData.find(c => c.id === catId)
            const pax = sessionConfig[key]

            if (cat && pax > 0) {
                payload.push({
                    event_id: id,
                    category_id: catId,
                    category_title: `Day ${dayIndex + 1} (${eventDays[dayIndex]}) - ${cat.title}`,
                    pax: pax,
                    price_per_plate: getPricePerPlate(cat.title, pax, eventDays.length),
                    selected_items: JSON.stringify(menuSelections[key] || [])
                })
            }
        }

        await supabase.from('menu_selections').delete().eq('event_id', id)
        const { error } = await supabase.from('menu_selections').insert(payload)
        await supabase.from('events').update({ quote_status: 'client_submitted', status: 'pending_admin_approval' }).eq('id', id)

        // Log Activity
        if (event) {
            const clientName = event.clients?.entity_name || event.clients?.contact_person || 'Client'
            logActivity({
                actorName: clientName,
                clientName: clientName,
                action: 'Changed Menu',
                districtState: [event.city, event.state].filter(Boolean).join(', ') || 'Karnataka',
                eventStartDate: event.event_date,
                eventCode: event.event_code || 'EVENT',
            })
        }

        // Generate PDF in memory for email attachment
        let pdfBase64 = ''
        try {
            const doc = new jsPDF()
            let yPos = 20

            // 1. Logo
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
                                resolve(canvas.toDataURL('image/jpeg', 0.8))
                            } else {
                                resolve('')
                            }
                        }
                        img.onerror = reject
                        img.src = URL.createObjectURL(blob)
                    })

                    if (base64Logo) {
                        const reqWidth = 60
                        const imgProps = doc.getImageProperties(base64Logo)
                        const ratio = imgProps.height / imgProps.width
                        const reqHeight = reqWidth * ratio
                        const pageWidth = doc.internal.pageSize.getWidth()
                        doc.addImage(base64Logo, 'JPEG', (pageWidth - reqWidth) / 2, yPos, reqWidth, reqHeight)
                        yPos += reqHeight + 15
                    }
                }
            } catch (e) {
                console.error("Failed to load logo for confirmation PDF", e)
            }

            // 2. Header
            const curDate = new Date().toLocaleDateString('en-GB').replace(/ /g, '-')
            const eventDateStr = new Date(event.event_date).toLocaleDateString('en-GB')
            const clientDisplayName = event.clients?.entity_name || event.clients?.contact_person || 'Client'

            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            doc.text('To,', 14, yPos)
            doc.setFont('helvetica', 'bold')
            doc.text(clientDisplayName, 22, yPos + 6)
            doc.setFont('helvetica', 'normal')
            doc.text(`Date: ${curDate}`, doc.internal.pageSize.getWidth() - 14, yPos, { align: 'right' })

            yPos += 15
            doc.setFontSize(14)
            doc.setFont('helvetica', 'bold')
            doc.text('CONFIRMED MENU SELECTION', doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' })

            yPos += 15
            doc.setFontSize(10)
            doc.setFont('helvetica', 'bold')
            doc.text(`Event Date : ${eventDateStr}`, 14, yPos)
            yPos += 10

            // Build item to station map
            const itemStationMap: Record<string, string> = {}
            menuData.forEach(cat => {
                cat.stations?.forEach((st: any) => {
                    st.items?.forEach((it: any) => {
                        itemStationMap[it.name] = st.name
                    })
                })
            })

            // 3. Render Tables
            eventDays.forEach((dayLabel, dayIndex) => {
                const daySessions = Object.keys(sessionConfig).filter(k => k.startsWith(`${dayIndex}_`))
                if (daySessions.length === 0) return

                daySessions.forEach(key => {
                    const catId = key.split('_')[1]
                    const cat = menuData.find(c => c.id === catId)
                    const pax = sessionConfig[key]
                    const items = menuSelections[key] || []

                    if (!cat) return

                    const groupedItems: Record<string, string[]> = {}
                    items.forEach((item: string) => {
                        const station = itemStationMap[item] || 'OTHER'
                        if (!groupedItems[station]) groupedItems[station] = []
                        groupedItems[station].push(item)
                    })

                    let contentBody: any[] = []

                    if (items.length === 0) {
                        contentBody.push([{ content: 'No items selected.', styles: { fontStyle: 'italic', textColor: [220, 38, 38], cellPadding: { top: 6, bottom: 6, left: 40 } } }])
                    } else {
                        contentBody.push([{ content: '', styles: { cellPadding: 2 } }])

                        Object.entries(groupedItems).forEach(([station, items]) => {
                            if (station !== 'OTHER') {
                                contentBody.push([{ content: station.toUpperCase(), styles: { fontStyle: 'bold', textColor: [180, 83, 9], cellPadding: { top: 4, bottom: 1, left: 40 }, fontSize: 11, halign: 'left' } }])
                            } else {
                                contentBody.push([{ content: 'CUSTOM REQUESTS', styles: { fontStyle: 'bold', textColor: [180, 83, 9], cellPadding: { top: 4, bottom: 1, left: 40 }, fontSize: 11, halign: 'left' } }])
                            }
                            const itemsStr = items.join('\n')
                            contentBody.push([{ content: itemsStr, styles: { fontStyle: 'bold', cellPadding: { top: 1, bottom: 6, left: 40 }, halign: 'left', fontSize: 10 } }])
                        })

                        contentBody.push([{ content: '', styles: { cellPadding: 2 } }])
                    }

                    if (yPos > doc.internal.pageSize.getHeight() - 40) {
                        doc.addPage()
                        yPos = 20
                    }

                    autoTable(doc, {
                        startY: yPos + 2,
                        head: [[`DAY ${dayIndex + 1} - ${dayLabel} - ${cat.title} (${pax} PAX)`]],
                        body: contentBody,
                        theme: 'plain',
                        tableLineColor: [0, 0, 0],
                        tableLineWidth: 0.1,
                        styles: {
                            font: 'helvetica',
                            fontSize: 10,
                            textColor: [0, 0, 0],
                        },
                        headStyles: {
                            fillColor: [255, 255, 255],
                            textColor: [0, 0, 0],
                            fontStyle: 'bold',
                            halign: 'left',
                            valign: 'middle',
                            cellPadding: 4,
                            lineWidth: 0.1,
                            lineColor: [0, 0, 0]
                        },
                        bodyStyles: {
                            halign: 'left',
                            valign: 'top',
                        },
                        columnStyles: {
                            0: { cellWidth: 'auto' }
                        },
                        margin: { left: 14, right: 14 },
                        didDrawPage: (data) => {
                            yPos = data.cursor ? data.cursor.y : yPos
                        }
                    })

                    yPos += 8
                })
            })

            const dataUri = doc.output('datauristring')
            pdfBase64 = dataUri.split(',')[1]
        } catch (e) {
            console.error("Error generating PDF in memory:", e)
        }

        // Call email API
        if (pdfBase64) {
            try {
                await fetch('/api/send-menu-confirmation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventId: id, pdfBase64 })
                })
            } catch (e) {
                console.error("Error calling confirmation email API:", e)
            }
        }

        // Clear Cache
        localStorage.removeItem(`menu_config_${id}`)
        localStorage.removeItem(`menu_sels_${id}`)

        setSubmitting(false)
        if (error) {
            alert("Error: " + error.message)
        } else {
            setSubmitted(true)
            setAllowEdit(false) // Toggle back so SuccessScreen shows
        }
    }

    // PREVIEW MODE EMPTY STATE
    if (isPreview && !loading && Object.keys(sessionConfig).length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-8">
                <div className="bg-white p-10 rounded-2xl shadow-xl border border-gray-200 max-w-md w-full">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-3xl">⏳</span>
                    </div>
                    <h2 className="text-2xl font-black text-black mb-2">Selection Awaited</h2>
                    <p className="text-gray-500 font-medium mb-8">The client has not started the menu selection process yet.</p>
                    <button onClick={() => window.history.length > 2 ? router.back() : window.close()} className="text-sm font-bold text-gray-400 hover:text-black uppercase tracking-widest">Close Preview</button>
                </div>
            </div>
        )
    }

    if (submitted && !isPreview && !allowEdit) return <SuccessScreen onEdit={() => { if (!isMenuLockedByAdmin && !isLockedByDate) setAllowEdit(true); }} eventId={id as string} isLockedByDate={isLockedByDate} isMenuLockedByAdmin={isMenuLockedByAdmin} />
    if (loading || !event) return <div className="h-screen flex items-center justify-center font-bold text-gray-400">Loading Planner...</div>

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-black pb-32">
            {isMenuLockedByAdmin && !isPreview && (
                <div className="bg-amber-600 text-white px-4 py-2.5 text-center text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 sticky top-0 z-[100] shadow-md">
                    <span>🔒</span> Menu Locked by Administrator — No changes can be made.
                </div>
            )}
            <Header event={event} />

            <div className="max-w-4xl mx-auto p-6">

                {/* STEP 1: CONFIGURATION MATRIX */}
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-black text-black mb-3">Configure Sessions</h2>
                            <p className="text-gray-500 font-medium text-lg max-w-2xl mx-auto">Select the dining sessions you wish to host and define the guest count for each.</p>
                        </div>

                        {/* DESKTOP TABLE (Hidden on Mobile) */}
                        <div className="hidden md:block overflow-x-auto rounded-xl shadow-lg border border-gray-200">
                            <table className="w-full bg-white border-collapse">
                                <thead>
                                    <tr className="bg-black text-white">
                                        <th className="p-4 font-bold text-lg text-left w-1/4">Session</th>
                                        {eventDays.map((day, i) => (
                                            <th key={i} className="p-4 text-left border-l border-gray-800">
                                                <div className="font-bold text-xs text-gray-400 uppercase tracking-widest mb-1">Day {i + 1}</div>
                                                <div className="font-bold text-lg">{day}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {menuData.map(cat => (
                                        <tr key={cat.id} className="hover:bg-gray-50 transition group">
                                            <td className="p-6 font-bold text-xl text-gray-800 border-b border-gray-100 group-last:border-0">
                                                {cat.title}
                                            </td>
                                            {eventDays.map((_, dayIndex) => {
                                                const key = getSessionKey(dayIndex, cat.id)
                                                const isEnabled = sessionConfig[key] !== undefined
                                                return (
                                                    <td key={dayIndex} className="p-4 border-l border-b border-gray-100 group-last:border-b-0 align-middle">
                                                        <div
                                                            onClick={() => toggleSession(dayIndex, cat.id)}
                                                            className={`cursor-pointer transition-all duration-200 h-24 flex flex-col items-center justify-center rounded-lg border-2 ${isEnabled ? 'bg-white border-black shadow-md scale-[1.02]' : 'bg-transparent border-dashed border-gray-200 hover:border-gray-400 hover:bg-gray-50'}`}
                                                        >
                                                            {isEnabled ? (
                                                                <div onClick={e => e.stopPropagation()} className="w-full px-4">
                                                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center mb-1">Guests</div>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        className="w-full text-center font-black text-2xl bg-transparent border-b-2 border-gray-200 focus:border-black outline-none pb-1 transition-colors"
                                                                        value={sessionConfig[key] || ''}
                                                                        onChange={e => updatePax(dayIndex, cat.id, e.target.value)}
                                                                        placeholder="0"
                                                                        autoFocus
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span className="text-2xl text-gray-300 font-bold">+</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* MOBILE STACK (Visible on Mobile) */}
                        <div className="md:hidden space-y-6">
                            {eventDays.map((day, dayIndex) => (
                                <div key={dayIndex} className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
                                    <div className="bg-gray-50 border-b border-gray-100 p-4">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Day {dayIndex + 1}</span>
                                        <h3 className="text-xl font-black text-gray-900">{day}</h3>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {menuData.map(cat => {
                                            const key = getSessionKey(dayIndex, cat.id)
                                            const isEnabled = sessionConfig[key] !== undefined

                                            return (
                                                <div key={cat.id} className="p-4 flex items-center justify-between">
                                                    <div>
                                                        <div className="font-bold text-gray-800">{cat.title}</div>
                                                    </div>

                                                    {isEnabled ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="relative w-20">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    className="w-full font-black text-xl text-center border-b-2 border-black focus:outline-none bg-transparent p-1"
                                                                    value={sessionConfig[key] || ''}
                                                                    onChange={e => updatePax(dayIndex, cat.id, e.target.value)}
                                                                    placeholder="0"
                                                                    autoFocus
                                                                />
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase absolute -bottom-4 left-0 right-0 text-center">Guests</span>
                                                            </div>
                                                            <button onClick={() => toggleSession(dayIndex, cat.id)} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-full text-lg font-bold border border-red-100 ml-2">×</button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => toggleSession(dayIndex, cat.id)}
                                                            className="px-4 py-2 rounded-lg bg-gray-50 text-gray-500 font-bold text-xs border border-gray-200 hover:bg-gray-100 hover:text-black uppercase tracking-wide"
                                                        >
                                                            + Add
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <StepFooter total={calculateTotal()} onNext={() => setStep(2)} nextLabel="Proceed to Selection" disabled={Object.keys(sessionConfig).length === 0} />
                    </div>
                )}
                {/* STEP 2: SELECTION HUB */}
                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-700">
                        <div className="flex items-center gap-6 mb-12">
                            <button onClick={() => setStep(1)} className="text-xs font-bold text-gray-500 hover:text-black uppercase tracking-widest transition-colors">
                                ← Back to Configuration
                            </button>
                            <div className="h-px bg-gray-200 flex-1"></div>
                            <h2 className="text-3xl font-black text-black">Menu Composition</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.keys(sessionConfig).map(key => {
                                const [dayIdx, catId] = key.split('_')
                                const dayIndex = parseInt(dayIdx)
                                const cat = menuData.find(c => c.id === catId)
                                const itemsCount = (menuSelections[key] || []).length
                                const isFixedMenu = cat?.title.toUpperCase() === 'BANANA LEAF MEAL'
                                const currentPax = sessionConfig[key] || 0
                                const currentPrice = getPricePerPlate(cat?.title || '', currentPax, eventDays.length)

                                return (
                                    <div
                                        key={key}
                                        onClick={() => { if (!isFixedMenu) { setActiveSession({ dayIndex, categoryId: catId }); setStep(3) } }}
                                        className={`bg-white p-8 rounded-xl shadow-sm border-2 transition-all duration-200 ${isFixedMenu ? 'cursor-default border-gray-200' : 'cursor-pointer group hover:-translate-y-1 hover:shadow-lg'} ${itemsCount > 0 ? 'border-black' : 'border-transparent hover:border-gray-200'}`}
                                    >
                                        <div className="flex justify-between items-start mb-6">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Day {dayIndex + 1}</span>
                                            {!isFixedMenu && itemsCount > 0 && <span className="bg-black text-white text-[10px] font-bold px-3 py-1 rounded-full">{itemsCount} Selected</span>}
                                            {isFixedMenu && <span className="bg-green-100 text-green-800 text-[10px] font-bold px-3 py-1 rounded-full border border-green-200">Fixed Menu</span>}
                                        </div>
                                        <h3 className="text-2xl font-black text-gray-900 mb-1 group-hover:text-gray-600 transition-colors">{cat?.title}</h3>
                                        <p className="text-sm font-bold text-gray-500 mb-2">{eventDays[dayIndex]}</p>

                                        <div className="mt-8 flex justify-between items-end">
                                            <div className="text-gray-900">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Guests</div>
                                                <div className="font-bold text-xl">{currentPax}</div>
                                            </div>
                                            {!isFixedMenu && <span className="text-xs font-bold uppercase tracking-widest text-black underline opacity-0 group-hover:opacity-100 transition-opacity">Customize →</span>}
                                        </div>

                                        {!isFixedMenu && (
                                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                                    <span>⚡</span> Preset:
                                                </span>
                                                <select
                                                    className="text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 rounded-lg px-2.5 py-1.5 outline-none hover:bg-amber-100 transition cursor-pointer max-w-[170px] truncate"
                                                    defaultValue=""
                                                    onChange={(e) => {
                                                        const p = presets.find(pr => pr.id === e.target.value)
                                                        if (p) {
                                                            applyPreset(p, dayIndex, catId)
                                                            e.target.value = ""
                                                        }
                                                    }}
                                                >
                                                    <option value="" disabled>Choose Preset...</option>
                                                    {presets.map(p => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.name} ({p.items.length} items)
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        <StepFooter total={calculateTotal()} onNext={() => setStep(4)} nextLabel="Review & Confirm" disabled={false} />
                    </div>
                )}
                {/* STEP 3: ITEM SELECTION (MODAL VIEW) */}
                {step === 3 && activeSession && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] overflow-y-auto animate-in fade-in duration-300">
                        <div className="min-h-screen flex items-end md:items-center justify-center md:p-4">
                            <div className="bg-white w-full md:max-w-4xl rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 relative h-[90vh] md:h-auto flex flex-col">

                                <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 p-4 md:p-6 flex justify-between items-center z-10 shrink-0">
                                    <div>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Day {activeSession.dayIndex + 1} • {eventDays[activeSession.dayIndex]}</span>
                                        <h1 className="text-xl md:text-2xl font-black text-gray-900 uppercase tracking-tight truncate max-w-[200px] md:max-w-md">
                                            {menuData.find(c => c.id === activeSession.categoryId)?.title}
                                        </h1>
                                    </div>
                                    <button onClick={() => setStep(2)} className="bg-black text-white px-5 py-2.5 rounded-full text-xs font-bold hover:bg-gray-800 transition-colors shadow-lg">
                                        Done
                                    </button>
                                </div>

                                <div className="p-4 md:p-8 space-y-8 md:space-y-10 pb-20 overflow-y-auto flex-1 bg-gray-50">
                                    {/* PRESET MENUS BAR */}
                                    {(() => {
                                        const key = getSessionKey(activeSession.dayIndex, activeSession.categoryId)
                                        const currentItems = menuSelections[key] || []
                                        const activeCat = menuData.find(c => c.id === activeSession.categoryId)
                                        const catTitleUpper = (activeCat?.title || '').toUpperCase()

                                        const sortedPresets = [...presets].sort((a, b) => {
                                            const aMatches = a.mealCategory === 'ALL' || catTitleUpper.includes(a.mealCategory)
                                            const bMatches = b.mealCategory === 'ALL' || catTitleUpper.includes(b.mealCategory)
                                            if (aMatches && !bMatches) return -1
                                            if (!aMatches && bMatches) return 1
                                            return 0
                                        })

                                        return (
                                            <div className="bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 border border-amber-200/80 rounded-2xl p-4 md:p-5 shadow-sm space-y-3">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="text-2xl">⚡</span>
                                                        <div>
                                                            <h4 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                                                                Quick Preset Menus
                                                            </h4>
                                                            <p className="text-xs text-amber-900/70 font-medium">
                                                                Select a preset to auto-populate frequent combinations. All items remain 100% customisable!
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsSavePresetModalOpen(true)}
                                                            disabled={currentItems.length === 0}
                                                            className="bg-amber-900 text-white hover:bg-black px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                                                            title="Save current selected items as a new custom preset"
                                                        >
                                                            <span>⭐</span> Save Current as Preset
                                                        </button>
                                                        {currentItems.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={clearActiveSessionItems}
                                                                className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition"
                                                                title="Clear all selected items for this session"
                                                            >
                                                                Clear All
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Presets flex/scroll */}
                                                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
                                                    {sortedPresets.map(preset => {
                                                        const selectedCount = preset.items.filter(i => currentItems.includes(i)).length
                                                        const isFullySelected = selectedCount === preset.items.length && preset.items.length > 0

                                                        return (
                                                            <div
                                                                key={preset.id}
                                                                className={`shrink-0 flex items-center rounded-xl border transition-all ${
                                                                    isFullySelected
                                                                        ? 'bg-amber-900 text-white border-amber-950 shadow-md ring-2 ring-amber-400'
                                                                        : 'bg-white hover:bg-amber-100/80 border-amber-200 text-slate-800'
                                                                }`}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => applyPreset(preset, activeSession.dayIndex, activeSession.categoryId)}
                                                                    className="px-3.5 py-2 text-left flex flex-col justify-center"
                                                                    title={preset.description}
                                                                >
                                                                    <span className="text-xs font-black leading-tight flex items-center gap-1.5">
                                                                        {preset.isCustom ? '⭐' : '🍽️'} {preset.name}
                                                                    </span>
                                                                    <span className={`text-[10px] font-bold ${isFullySelected ? 'text-amber-200' : 'text-slate-500'}`}>
                                                                        {preset.items.length} items {selectedCount > 0 && !isFullySelected ? `(${selectedCount} active)` : ''} • Click to apply
                                                                    </span>
                                                                </button>
                                                                {preset.isCustom && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleDeleteCustomPreset(preset.id, preset.name)
                                                                        }}
                                                                        className="px-2.5 py-2 text-red-500 hover:text-red-700 text-xs font-bold border-l border-amber-200/60"
                                                                        title="Delete custom preset"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })()}

                                    {menuData.find(c => c.id === activeSession.categoryId)?.stations.map(station => {
                                        const isExpanded = expandedStations[station.id]
                                        return (
                                            <div key={station.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
                                                <div
                                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                                    onClick={() => toggleStation(station.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="font-black text-lg md:text-xl text-gray-900">{station.name}</h3>
                                                        <span className="text-[9px] font-black bg-gray-200 text-gray-600 px-2 py-1 rounded tracking-wider uppercase inline-block">{station.selection_type}</span>
                                                    </div>
                                                    <div className={`transform transition-transform text-gray-400 font-bold ${isExpanded ? 'rotate-180' : ''}`}>▼</div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="p-4 border-t border-gray-100 bg-gray-50">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {station.items.map((item: any) => {
                                                                const key = getSessionKey(activeSession.dayIndex, activeSession.categoryId)
                                                                const isSelected = (menuSelections[key] || []).includes(item.name)
                                                                return (
                                                                    <div
                                                                        key={item.id}
                                                                        onClick={() => toggleMenuItem(item.name, station)}
                                                                        className={`p-3 md:p-4 rounded-lg border-2 cursor-pointer flex items-center gap-3 md:gap-4 transition-all duration-200 group ${isSelected ? 'bg-black text-white border-black shadow-lg' : 'bg-white border-gray-200 hover:border-gray-400 hover:shadow-sm'}`}
                                                                    >
                                                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-white' : 'border-gray-300 group-hover:border-gray-400'}`}>
                                                                            {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                                                                        </div>
                                                                        <span className={`font-bold text-sm leading-tight ${isSelected ? 'text-white' : 'text-gray-700'}`}>{item.name}</span>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}

                                    {/* Pseudo-station for custom items */}
                                    {(() => {
                                        const activeCategory = menuData.find(c => c.id === activeSession.categoryId)
                                        const dbItemNames = new Set(activeCategory?.stations.flatMap((s: any) => s.items.map((i: any) => i.name)) || [])
                                        const key = getSessionKey(activeSession.dayIndex, activeSession.categoryId)
                                        const selectedItems = menuSelections[key] || []
                                        const categoryCustomItems = selectedItems.filter(name => !dbItemNames.has(name))

                                        return (
                                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
                                                <div className="p-4 bg-gray-50/50 border-b border-gray-200 flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="font-black text-lg text-gray-900">Custom Items / Special Requests</h3>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-white space-y-4">
                                                    {categoryCustomItems.length > 0 ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {categoryCustomItems.map((item) => (
                                                                <div
                                                                    key={item}
                                                                    className="p-3 md:p-4 rounded-lg border-2 cursor-default flex items-center justify-between bg-black text-white border-black shadow-lg"
                                                                >
                                                                    <span className="font-bold text-sm leading-tight text-white">{item}</span>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => removeCustomItem(item)}
                                                                        className="text-red-400 hover:text-red-600 font-bold text-xs cursor-pointer tracking-wider uppercase ml-2 bg-transparent border-0"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-400 font-medium italic">No custom items requested yet.</p>
                                                    )}
                                                    
                                                    <div className="pt-2 border-t border-gray-100 flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Type custom item name (e.g., Organic Guava Juice)..."
                                                            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:border-black transition"
                                                            id="custom-item-input"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleAddCustomItem();
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleAddCustomItem}
                                                            className="bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition active:scale-95 shadow-sm uppercase tracking-wider"
                                                        >
                                                            + Add
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 4: FINAL PREVIEW */}
                {step === 4 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {!isPreview && !event?.menu_locked && !isLockedByDate && (
                            <button onClick={() => setStep(2)} className="mb-8 text-xs font-bold text-gray-500 hover:text-black flex items-center gap-2 transition uppercase tracking-widest">
                                ← Edit Selections
                            </button>
                        )}

                        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-xl border border-gray-200 mb-12 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-black"></div>
                            <h2 className="text-3xl font-black mb-8 text-center text-gray-900 border-b border-gray-100 pb-8">
                                {isPreview ? 'Preview of Selected Menu' : 'Review Your Menu'}
                            </h2>

                            <div className="space-y-10">
                                {eventDays.map((day, dayIndex) => {
                                    const daySessions = Object.keys(sessionConfig).filter(k => k.startsWith(`${dayIndex}_`))
                                    if (daySessions.length === 0) return null

                                    return (
                                        <div key={day} className="border-b border-gray-100 pb-10 last:border-0 last:pb-0">
                                            <div className="flex items-center gap-4 mb-8">
                                                <span className="bg-black text-white px-4 py-1.5 rounded text-xs font-black uppercase tracking-widest">Day {dayIndex + 1}</span>
                                                <span className="font-bold text-xl text-gray-500">{day}</span>
                                            </div>

                                            <div className="grid grid-cols-1 gap-6">
                                                {daySessions.map(key => {
                                                    const catId = key.split('_')[1]
                                                    const cat = menuData.find(c => c.id === catId)
                                                    const items = menuSelections[key] || []

                                                    const isFixedMenu = cat?.title.toUpperCase() === 'BANANA LEAF MEAL'
                                                    const currentPax = sessionConfig[key] || 0
                                                    const currentPrice = getPricePerPlate(cat?.title || '', currentPax, eventDays.length)

                                                    return (
                                                        <div key={key} className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col md:flex-row gap-6">
                                                            <div className="md:w-1/4 pt-1">
                                                                <h4 className="font-black text-xl uppercase text-gray-900 leading-none mb-2">{cat?.title}</h4>
                                                                <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">{currentPax} Guests</p>
                                                            </div>

                                                            <div className="flex-1">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {items.length === 0 ? (
                                                                        isFixedMenu ? (
                                                                            <span className="text-green-600 bg-green-50 px-3 py-1 rounded text-xs font-bold border border-green-100">Fixed Traditional Menu</span>
                                                                        ) : (
                                                                            <span className="text-red-500 bg-red-50 px-3 py-1 rounded text-xs font-bold italic border border-red-100">Selection Pending</span>
                                                                        )
                                                                    ) : items.map((it, idx) => (
                                                                        <span key={idx} className="text-sm font-bold bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-gray-700 shadow-sm">{it}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {!isPreview && !event?.menu_locked && !isLockedByDate && (
                            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 z-40">
                                <div className="max-w-5xl mx-auto flex justify-end items-center">
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                        className="bg-green-600 text-white px-10 py-3 rounded-xl text-sm font-bold hover:bg-green-700 transition shadow-xl shadow-green-900/10 active:scale-95 disabled:opacity-50 uppercase tracking-wide"
                                    >
                                        {submitting ? 'Processing...' : 'Confirm Final Menu'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {event?.menu_locked && !isPreview && (
                            <div className="fixed bottom-0 left-0 right-0 bg-amber-950/95 backdrop-blur-md border-t border-amber-600/40 p-4 z-40 text-center">
                                <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center justify-center gap-2">
                                    <span>🔒</span> Menu Locked by Administrator — No changes can be submitted
                                </span>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* SAVE CURRENT AS PRESET MODAL */}
            {isSavePresetModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">⭐</span>
                                <h3 className="text-lg font-black text-gray-900">Save Preset Menu</h3>
                            </div>
                            <button
                                onClick={() => setIsSavePresetModalOpen(false)}
                                className="text-gray-400 hover:text-black font-bold text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 font-medium leading-relaxed">
                            Save the currently selected items as a reusable preset template for future frequent menu selections.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">Preset Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g., South Indian Meals, Deluxe Wedding Lunch..."
                                    value={newPresetName}
                                    onChange={e => setNewPresetName(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-amber-500"
                                    autoFocus
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            handleSaveCurrentAsPreset()
                                        }
                                    }}
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">Description (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Signature 10-item lunch combo for special events"
                                    value={newPresetDesc}
                                    onChange={e => setNewPresetDesc(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl p-3 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsSavePresetModalOpen(false)}
                                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold text-xs hover:bg-gray-200 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveCurrentAsPreset}
                                className="flex-1 bg-amber-900 text-white py-3 rounded-xl font-bold text-xs hover:bg-black transition shadow-lg shadow-amber-900/20"
                            >
                                Save Preset
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FLOATING PRESET TOAST NOTIFICATION */}
            {presetToast && (
                <div className="fixed bottom-6 right-6 z-[90] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in slide-in-from-bottom-5 duration-300">
                    <span className="text-amber-400 text-lg">⚡</span>
                    <span className="text-xs font-bold">{presetToast}</span>
                    <button onClick={() => setPresetToast(null)} className="text-slate-400 hover:text-white text-xs ml-2">✕</button>
                </div>
            )}
        </div>
    )
}

// --- SUB-COMPONENTS ---

function Header({ event }: { event: any }) {
    return (
        <div className="bg-white border-b border-gray-200 sticky top-0 z-50 bg-opacity-90 backdrop-blur-md">
            <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-gray-900">{event.clients?.entity_name}</h1>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Event Menu Selection</p>
                </div>
                <div className="text-right hidden md:block">
                    <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Event Date</span>
                    <span className="font-bold text-lg text-gray-900">{new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
            </div>
        </div>
    )
}

function StepFooter({ onNext, nextLabel, disabled }: any) {
    return (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-200 z-40 bg-opacity-95 backdrop-blur shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
            <div className="max-w-5xl mx-auto flex justify-end items-center">
                <button
                    onClick={onNext}
                    disabled={disabled}
                    className="bg-black text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed tracking-wide uppercase"
                >
                    {nextLabel}
                </button>
            </div>
        </div>
    )
}

function SuccessScreen({ onEdit, eventId, isLockedByDate, isMenuLockedByAdmin }: { onEdit: () => void, eventId: string, isLockedByDate: boolean, isMenuLockedByAdmin: boolean }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6 sm:p-10 text-center font-sans">
            <div className="text-6xl mb-6">🎉</div>
            <h1 className="text-3xl sm:text-4xl font-black mb-3">Menu Confirmed!</h1>
            <p className="text-gray-400 text-sm sm:text-base max-w-md mb-8">Your selections have been sent to our team. We will review and provide the final quotation shortly.</p>

            {isMenuLockedByAdmin && (
                <div className="bg-amber-950/60 border border-amber-500/40 text-amber-300 p-4 rounded-2xl flex items-center justify-center gap-3 mb-6 max-w-md w-full">
                    <span className="text-xl">🔒</span>
                    <div className="text-left">
                        <p className="text-xs font-black uppercase tracking-wider">Menu Locked by Administrator</p>
                        <p className="text-[11px] text-amber-200/80 font-medium mt-0.5">The administration has finalized and locked this menu. Editing is closed.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
                {isMenuLockedByAdmin ? (
                    <button
                        disabled
                        className="bg-gray-800 text-gray-500 border border-gray-700 px-8 py-3 rounded-full text-xs font-bold shadow-lg cursor-not-allowed uppercase tracking-widest whitespace-nowrap"
                    >
                        🔒 Menu Locked by Admin
                    </button>
                ) : isLockedByDate ? (
                    <button
                        disabled
                        className="bg-gray-800 text-gray-500 border border-gray-700 px-8 py-3 rounded-full text-xs font-bold shadow-lg cursor-not-allowed uppercase tracking-widest whitespace-nowrap"
                    >
                        🔒 Editing Locked
                    </button>
                ) : (
                    <button
                        onClick={onEdit}
                        className="bg-white text-black px-8 py-3 rounded-full text-xs font-bold shadow-lg hover:bg-gray-200 transition-colors uppercase tracking-widest whitespace-nowrap"
                    >
                        Edit Menu
                    </button>
                )}
                <a
                    href={`/client-menu/${eventId}?preview=true&print=true`}
                    target="_blank"
                    className="bg-gray-800 border border-gray-700 text-white px-8 py-3 rounded-full text-xs font-bold shadow-lg hover:bg-gray-700 transition-colors uppercase tracking-widest whitespace-nowrap"
                >
                    Download Menu Document
                </a>
            </div>
        </div>
    )
}

export default function ClientMenuPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-gray-400">Loading Menu...</div>}>
            <ClientMenuContent />
        </Suspense>
    )
}