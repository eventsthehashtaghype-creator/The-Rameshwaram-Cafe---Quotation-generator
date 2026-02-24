'use client'
import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
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

    // 1. FETCH DATA
    useEffect(() => {
        async function fetchData() {
            setLoading(true)

            // A. Fetch Event
            const { data: eventData } = await supabase.from('events').select('*, clients(*)').eq('id', id).single()
            if (eventData) {
                setEvent(eventData)
                if (eventData.quote_status === 'client_submitted' && !isPreview) setSubmitted(true) // Only block if NOT preview

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

            if (localConfig && localSels && eventData?.quote_status !== 'client_submitted') {
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

                if (isPreview || eventData?.quote_status === 'client_submitted') {
                    setStep(4)
                }
            } else if (restoredFromLocal && (isPreview || eventData?.quote_status === 'client_submitted')) {
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

    const toggleMenuItem = (item: string) => {
        if (!activeSession) return
        const key = getSessionKey(activeSession.dayIndex, activeSession.categoryId)
        setMenuSelections(prev => {
            const current = prev[key] || []
            return current.includes(item)
                ? { ...prev, [key]: current.filter(i => i !== item) }
                : { ...prev, [key]: [...current, item] }
        })
    }

    const calculateTotal = () => {
        let total = 0
        Object.keys(sessionConfig).forEach(key => {
            const [dayIdx, catId] = key.split('_')
            const cat = menuData.find(c => c.id === catId)
            if (cat) total += (sessionConfig[key] * cat.default_price)
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

            if (cat) {
                payload.push({
                    event_id: id,
                    category_id: catId,
                    category_title: `Day ${dayIndex + 1} (${eventDays[dayIndex]}) - ${cat.title}`,
                    pax: sessionConfig[key],
                    price_per_plate: cat.default_price,
                    selected_items: JSON.stringify(menuSelections[key] || [])
                })
            }
        }

        await supabase.from('menu_selections').delete().eq('event_id', id)
        const { error } = await supabase.from('menu_selections').insert(payload)
        await supabase.from('events').update({ quote_status: 'client_submitted' }).eq('id', id)

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

    if (submitted && !isPreview && !allowEdit) return <SuccessScreen onEdit={() => setAllowEdit(true)} eventId={id as string} />
    if (loading || !event) return <div className="h-screen flex items-center justify-center font-bold text-gray-400">Loading Planner...</div>

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-black pb-32">
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
                                                <div className="text-xs font-normal text-gray-400 mt-1">Starts at ₹{cat.default_price}</div>
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
                                                        <div className="text-xs text-gray-400">₹{cat.default_price} / plate</div>
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

                                return (
                                    <div
                                        key={key}
                                        onClick={() => { setActiveSession({ dayIndex, categoryId: catId }); setStep(3) }}
                                        className={`bg-white p-8 rounded-xl shadow-sm border-2 transition-all duration-200 cursor-pointer group hover:-translate-y-1 hover:shadow-lg ${itemsCount > 0 ? 'border-black' : 'border-transparent hover:border-gray-200'}`}
                                    >
                                        <div className="flex justify-between items-start mb-6">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Day {dayIndex + 1}</span>
                                            {itemsCount > 0 && <span className="bg-black text-white text-[10px] font-bold px-3 py-1 rounded-full">{itemsCount} Selected</span>}
                                        </div>
                                        <h3 className="text-2xl font-black text-gray-900 mb-1 group-hover:text-gray-600 transition-colors">{cat?.title}</h3>
                                        <p className="text-sm font-bold text-gray-500">{eventDays[dayIndex]}</p>

                                        <div className="mt-8 flex justify-between items-end">
                                            <div className="text-gray-900">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Guests</div>
                                                <div className="font-bold text-xl">{sessionConfig[key]}</div>
                                            </div>
                                            <span className="text-xs font-bold uppercase tracking-widest text-black underline opacity-0 group-hover:opacity-100 transition-opacity">Customize →</span>
                                        </div>
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
                                                        <span className="text-[9px] font-black bg-gray-200 text-gray-600 px-2 py-1 rounded tracking-wider uppercase hidden sm:inline-block">{station.selection_type}</span>
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
                                                                        onClick={() => toggleMenuItem(item.name)}
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
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 4: FINAL PREVIEW */}
                {step === 4 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {!isPreview && (
                            <button onClick={() => setStep(2)} className="mb-8 text-xs font-bold text-gray-500 hover:text-black flex items-center gap-2 transition uppercase tracking-widest">
                                ← Edit Selections
                            </button>
                        )}

                        <div className="bg-white p-10 rounded-2xl shadow-xl border border-gray-200 mb-12 relative overflow-hidden">
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

                                                    return (
                                                        <div key={key} className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col md:flex-row gap-6">
                                                            <div className="md:w-1/4 pt-1">
                                                                <h4 className="font-black text-xl uppercase text-gray-900 leading-none mb-2">{cat?.title}</h4>
                                                                <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">{sessionConfig[key]} Guests</p>
                                                            </div>

                                                            <div className="flex-1">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {items.length === 0 ? (
                                                                        <span className="text-red-500 bg-red-50 px-3 py-1 rounded text-xs font-bold italic border border-red-100">Selection Pending</span>
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

                        {!isPreview && (
                            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-200 z-50 bg-opacity-95 backdrop-blur shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                                <div className="max-w-5xl mx-auto flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Estimate</p>
                                        <h3 className="text-3xl font-black text-gray-900">₹ {calculateTotal().toLocaleString()}</h3>
                                    </div>
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
                    </div>
                )}

            </div>
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

function StepFooter({ total, onNext, nextLabel, disabled }: any) {
    return (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-200 z-40 bg-opacity-95 backdrop-blur shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
            <div className="max-w-5xl mx-auto flex justify-between items-center">
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estimated Total</p>
                    <h3 className="text-3xl font-black text-gray-900">₹ {total.toLocaleString()}</h3>
                </div>
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

function SuccessScreen({ onEdit, eventId }: { onEdit: () => void, eventId: string }) {
    return (
        <div className="h-screen flex flex-col items-center justify-center bg-black text-white p-10 text-center font-sans">
            <div className="text-6xl mb-6">🎉</div>
            <h1 className="text-4xl font-black mb-3">Menu Confirmed!</h1>
            <p className="text-gray-400 text-lg max-w-md mb-8">Your selections have been sent to our team. We will review and provide the final quotation shortly.</p>
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
                <button
                    onClick={onEdit}
                    className="bg-white text-black px-8 py-3 rounded-full text-xs font-bold shadow-lg hover:bg-gray-200 transition-colors uppercase tracking-widest whitespace-nowrap"
                >
                    Edit Menu
                </button>
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