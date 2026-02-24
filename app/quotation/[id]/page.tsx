'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
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

    // --- EDITING STATE ---
    const [saving, setSaving] = useState(false)

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
        { id: 't6', text: "Extra Pax will be charged as per above pricing", selected: true }
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

    async function fetchData() {
        console.log("fetchData started...")
        try {
            // 1. Fetch Event
            const { data: eventData, error: eventError } = await supabase.from('events').select(`*, clients(*)`).eq('id', id).single()

            if (eventError) {
                console.error("Error fetching event:", eventError)
                alert("Error loading event: " + eventError.message)
                setLoading(false)
                return
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

            setLoading(false)
        } catch (error) {
            console.error("Critical error in fetchData:", error)
            alert("Unexpected error loading quotation.")
            setLoading(false)
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
        await supabase.from('menu_selections').update({ [field]: num }).eq('id', selectionId)
    }

    // REMOVE AN ITEM FROM THE MENU LIST
    const handleRemoveItem = async (selectionId: string, itemToRemove: string) => {
        const selection = selections.find(s => s.id === selectionId)
        if (!selection) return
        const newItems = selection.selected_items.filter((i: string) => i !== itemToRemove)
        setSelections(prev => prev.map(s => s.id === selectionId ? { ...s, selected_items: newItems } : s))
        await supabase.from('menu_selections').update({ selected_items: JSON.stringify(newItems) }).eq('id', selectionId)
    }

    // SAVE EVENT SETTINGS
    const handleSaveSettings = async () => {
        setSaving(true)

        // 1. Update Event
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

        // 2. Update Client (if changed)
        if (clientId) {
            const { error: clientError } = await supabase.from('clients').update({
                entity_name: clientName,
                gst_number: clientGst,
                contact_person: clientContact,
                mobile: clientMobile,
                email: clientEmail
            }).eq('id', clientId)

            if (clientError) {
                alert("Error saving client details: " + clientError.message)
                setSaving(false)
                return
            }
        }

        setSaving(false)
        alert("Event & Client details updated successfully!")
        fetchData() // Refresh
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
        yPos += 10

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
                    const itemsStr = items.join('\n')
                    contentBody.push([
                        { content: itemsStr, styles: { fontStyle: 'normal', cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }, halign: 'left', fontSize: 10, lineWidth: { top: topBorder, right: 0, bottom: 0, left: 0.1 }, lineColor: [0, 0, 0] } }
                    ])
                }
            })

            if (contentBody.length > 0) {
                const lastRowStyles = contentBody[contentBody.length - 1][0].styles;
                lastRowStyles.lineWidth.bottom = 0.1;

                contentBody[0].push({
                    content: `Rs. ${sel.price_per_plate} /-`,
                    rowSpan: contentBody.length,
                    styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 11, lineWidth: { top: 0, right: 0.1, bottom: 0.1, left: 0.1 }, lineColor: [0, 0, 0] }
                })
            } else {
                contentBody.push([
                    { content: 'No items selected.', styles: { fontStyle: 'italic', textColor: [220, 38, 38], cellPadding: 4, lineWidth: { top: 0, right: 0, bottom: 0.1, left: 0 }, lineColor: [0, 0, 0] } },
                    { content: `Rs. ${sel.price_per_plate} /-`, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 11, lineWidth: { top: 0, right: 0.1, bottom: 0.1, left: 0.1 }, lineColor: [0, 0, 0] } }
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
                ["A/c Holder's Name", "THE RAMESHWARAM CAFE"],
                ["Bank Name", "HDFC BANK LTD"],
                ["A/c No", "50200012345678"],
                ["IFS Code", "HDFC0000123"],
                ["Branch", "VASANT VIHAR"]
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
                            transformation: { width: 250, height: 75 },
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
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Rs. ${sel.price_per_plate} /-`, bold: true })] })]
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
                    makeBankRow("A/c Holder's Name", "THE RAMESHWARAM CAFE", true),
                    makeBankRow("Bank Name", "HDFC BANK LTD", true),
                    makeBankRow("A/c No", "50200012345678"),
                    makeBankRow("IFS Code", "HDFC0000123"),
                    makeBankRow("Branch", "Vasant Vihar", true),
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

            {/* NAVBAR (Hidden in Print) */}
            <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50 print:hidden bg-opacity-90 backdrop-blur shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href="/" className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full font-bold hover:bg-gray-200 transition">←</Link>
                    <div>
                        <h1 className="text-xl font-black">{event.event_code}</h1>
                        <p className="text-xs font-bold text-gray-500 uppercase">{event.clients?.entity_name}</p>
                    </div>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
                    {['quote', 'settings'].map((tab) => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 rounded-md text-xs font-black uppercase tracking-wide transition-all ${activeTab === tab ? 'bg-white shadow-sm text-black' : 'text-gray-400 hover:text-gray-600'}`}>{tab}</button>
                    ))}
                </div>
                <div className="flex gap-3">
                    <button onClick={handleDownloadMenuSheet} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded text-xs font-bold transition flex items-center gap-2">
                        <span>📄</span> Word
                    </button>
                    <button onClick={handleDownloadPDF} className="bg-black text-white px-5 py-2 rounded text-xs font-bold shadow-lg hover:bg-gray-800 transition flex items-center gap-2">
                        <span>🖨️</span> PDF
                    </button>
                </div>
            </div>

            <div className="max-w-[210mm] mx-auto my-8 print:my-0 print:max-w-full">

                {/* === QUOTE TAB === */}
                {activeTab === 'quote' && (
                    <div className="bg-white shadow-lg print:shadow-none min-h-[297mm] flex flex-col relative text-black text-sm p-8 md:p-16 font-bold">

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

                        {/* EVENT DATES */}
                        <div className="mb-4 text-sm font-bold">
                            <p>Event Date : {new Date(event.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')} {days > 1 ? 'to ' + new Date(event.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : ''}</p>
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
                                                            {station !== 'OTHER' && (
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
                                                    <div className="flex flex-col items-center justify-start h-full">
                                                        <div className="flex items-center">
                                                            <span className="mr-1">Rs.</span>
                                                            <input
                                                                type="number"
                                                                value={sel.price_per_plate}
                                                                onChange={(e) => handleUpdateLineItem(sel.id, 'price_per_plate', e.target.value)}
                                                                className="w-16 text-center bg-transparent border-b border-gray-300 focus:border-black outline-none print:hidden font-bold"
                                                            />
                                                            <span className="print:inline hidden">{sel.price_per_plate}</span>
                                                            <span>/-</span>
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
                                    <button
                                        onClick={() => setTerms([...terms, { id: `custom-${Date.now()}`, text: "New Condition", selected: true }])}
                                        className="text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1 rounded transition-colors print:hidden opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                    >
                                        + Add Condition
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {terms.map((term, index) => (
                                        <div key={term.id} className={`flex items-start gap-3 ${!term.selected && 'print:hidden'}`}>
                                            <div className="pt-1 print:hidden">
                                                <input
                                                    type="checkbox"
                                                    checked={term.selected}
                                                    onChange={(e) => {
                                                        const newTerms = [...terms]
                                                        newTerms[index].selected = e.target.checked
                                                        setTerms(newTerms)
                                                    }}
                                                    className="w-4 h-4 text-black rounded border-gray-300 focus:ring-black cursor-pointer"
                                                />
                                            </div>
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
                                                    }}
                                                    className={`w-full bg-transparent border-b border-transparent hover:border-gray-200 focus:border-black outline-none transition-colors ${!term.selected ? 'text-gray-400 line-through decoration-gray-300' : ''}`}
                                                    placeholder="Enter term condition..."
                                                />
                                            </div>
                                            <button
                                                onClick={() => setTerms(terms.filter(t => t.id !== term.id))}
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
                                            <td className="border border-black p-1 px-4 uppercase text-xs">Vasant Vihar</td>
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
                                            <input className={inputClass} value={clientName} onChange={e => setClientName(e.target.value)} />
                                        </div>
                                        <div><label className={labelClass}>GST Number</label><input className={inputClass} value={clientGst} onChange={e => setClientGst(e.target.value)} /></div>
                                        <div><label className={labelClass}>Contact Person</label><input className={inputClass} value={clientContact} onChange={e => setClientContact(e.target.value)} /></div>
                                        <div><label className={labelClass}>Mobile</label><input className={inputClass} value={clientMobile} onChange={e => setClientMobile(e.target.value)} /></div>
                                        <div><label className={labelClass}>Email</label><input className={inputClass} value={clientEmail} onChange={e => setClientEmail(e.target.value)} /></div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-black uppercase tracking-widest border-b border-gray-200 pb-2">Schedule & Type</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Start Date</label><input type="date" className={inputClass} value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }} /></div>
                                        <div><label className={labelClass}>End Date</label><input type="date" className={inputClass} value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} /></div>
                                    </div>
                                    {days > 0 && <div className="bg-gray-100 p-2 rounded text-center text-xs font-bold text-black uppercase tracking-wide">{days} Day Event</div>}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Event Type</label>
                                            <select className={inputClass} value={eventType} onChange={e => setEventType(e.target.value as any)}>
                                                <option value="B2B">B2B (Corporate)</option>
                                                <option value="B2C">B2C (Private)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Size Category</label>
                                            <select className={inputClass} value={eventSize} onChange={e => setEventSize(e.target.value as any)}>
                                                <option value="Small">Small (Green)</option>
                                                <option value="Large">Large (Red)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-black uppercase tracking-widest border-b border-gray-200 pb-2">Point of Contact (Event Specific)</h4>
                                    <div><label className={labelClass}>POC Name</label><input className={inputClass} value={pocName} onChange={e => setPocName(e.target.value)} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Mobile</label><input className={inputClass} value={pocMobile} onChange={e => setPocMobile(e.target.value)} /></div>
                                        <div><label className={labelClass}>Email</label><input className={inputClass} value={pocEmail} onChange={e => setPocEmail(e.target.value)} /></div>
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
                                        onChange={e => setGoogleMapsLink(e.target.value)}
                                        placeholder="Paste maps link..."
                                    />
                                </div>

                                <div className="h-64 border border-gray-200 rounded overflow-hidden">
                                    <EventMap onLocationSelect={handleMapSelect} />
                                </div>

                                <div><label className={labelClass}>Venue Name</label><input className={`${inputClass} text - lg`} value={venueName} onChange={e => setVenueName(e.target.value)} /></div>
                                <div><label className={labelClass}>Address</label><textarea className={`${inputClass} h - 20`} value={fullAddress} onChange={e => setFullAddress(e.target.value)} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className={labelClass}>City</label><input className={inputClass} value={city} onChange={e => setCity(e.target.value)} /></div>
                                    <div><label className={labelClass}>State</label><input className={inputClass} value={state} onChange={e => setState(e.target.value)} /></div>
                                </div>
                            </div>

                        </div>
                    </div>
                )}

            </div>
        </div >
    )
}