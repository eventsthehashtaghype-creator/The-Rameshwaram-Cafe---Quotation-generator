'use client'

import { useState, useMemo } from 'react'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, HeadingLevel } from 'docx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getComputedEventStatus, getStatusDisplayInfo, getEventDateRange } from '@/app/lib/eventStatus'

interface CalendarPrintModalProps {
    isOpen: boolean
    onClose: () => void
    events: any[]
    currentDate: Date
}

export default function CalendarPrintModal({ isOpen, onClose, events, currentDate }: CalendarPrintModalProps) {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // Default to 1st of current month to end of current month
    const defaultStartStr = new Date(year, month, 1).toISOString().split('T')[0]
    const defaultEndStr = new Date(year, month + 1, 0).toISOString().split('T')[0]

    const [fromDate, setFromDate] = useState(defaultStartStr)
    const [toDate, setToDate] = useState(defaultEndStr)
    const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending'>('all')
    const [clientFilter, setClientFilter] = useState<string>('all')
    const [includePoc, setIncludePoc] = useState<boolean>(true)
    const [exportingWord, setExportingWord] = useState(false)
    const [exportingPdf, setExportingPdf] = useState(false)

    // Helper: format complete venue address
    const getCompleteVenueAddress = (evt: any) => {
        const parts: string[] = []
        if (evt.venue_name) parts.push(evt.venue_name)
        if (evt.venue_address) parts.push(evt.venue_address)
        const cityStateZip = [
            evt.city,
            evt.state,
            evt.venue_zipcode ? `PIN: ${evt.venue_zipcode}` : ''
        ].filter(Boolean).join(', ')
        if (cityStateZip) parts.push(cityStateZip)

        return {
            venueName: evt.venue_name || '',
            streetAddress: evt.venue_address || '',
            cityStateZip,
            fullString: parts.length > 0 ? parts.join(', ') : '—'
        }
    }

    // Helper: format POC details
    const getPocDetails = (evt: any) => {
        const name = evt.poc_name || evt.client?.contact_person || evt.clients?.contact_person || ''
        const mobile = evt.poc_mobile || evt.client?.mobile || evt.clients?.mobile || ''
        const email = evt.poc_email || evt.client?.email || evt.clients?.email || ''
        return {
            name,
            mobile,
            email,
            hasPoc: Boolean(name || mobile || email),
            fullString: [name, mobile ? `Ph: ${mobile}` : '', email].filter(Boolean).join(' | ') || '—'
        }
    }

    // Extract unique client names
    const clientList = useMemo(() => {
        const names = new Set<string>()
        events.forEach(e => {
            const name = e.client?.entity_name || e.clients?.entity_name
            if (name) names.add(name)
        })
        return Array.from(names).sort()
    }, [events])

    // Filter events
    const filteredEvents = useMemo(() => {
        const from = fromDate ? new Date(fromDate) : new Date(2000, 0, 1)
        from.setHours(0, 0, 0, 0)
        const to = toDate ? new Date(toDate) : new Date(2100, 11, 31)
        to.setHours(23, 59, 59, 999)

        return events.filter(e => {
            const { startDate, endDate } = getEventDateRange(e)

            // Date overlap: event starts before or on `to` AND ends after or on `from`
            if (startDate > to || endDate < from) {
                return false
            }

            // Status filter
            const computed = getComputedEventStatus(e)
            if (statusFilter === 'confirmed') {
                if (e.status !== 'confirmed' && computed !== 'event_today') return false
            } else if (statusFilter === 'pending') {
                if (e.status === 'confirmed' || computed === 'event_today' || e.status === 'cancelled') return false
            }

            // Client filter
            if (clientFilter !== 'all') {
                const clientName = e.client?.entity_name || e.clients?.entity_name
                if (clientName !== clientFilter) return false
            }

            return true
        }).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
    }, [events, fromDate, toDate, statusFilter, clientFilter])

    if (!isOpen) return null

    // Preset helper
    const applyPreset = (type: 'this_month' | 'next_month' | 'next_30' | 'all') => {
        const now = new Date()
        if (type === 'this_month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1)
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
            setFromDate(start.toISOString().split('T')[0])
            setToDate(end.toISOString().split('T')[0])
        } else if (type === 'next_month') {
            const start = new Date(now.getFullYear(), now.getMonth() + 1, 1)
            const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)
            setFromDate(start.toISOString().split('T')[0])
            setToDate(end.toISOString().split('T')[0])
        } else if (type === 'next_30') {
            const start = new Date()
            const end = new Date()
            end.setDate(end.getDate() + 30)
            setFromDate(start.toISOString().split('T')[0])
            setToDate(end.toISOString().split('T')[0])
        } else if (type === 'all') {
            setFromDate('')
            setToDate('')
        }
    }

    // Export to Word (.docx)
    const handleExportWord = async () => {
        setExportingWord(true)
        try {
            const tableBorder = {
                top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
                insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
            }

            // Word Table Headers
            const headerCells = [
                new TableCell({
                    shading: { fill: "8B0000" },
                    children: [new Paragraph({ children: [new TextRun({ text: "S.No", bold: true, color: "FFFFFF", size: 18 })] })],
                    width: { size: includePoc ? 4 : 5, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                    shading: { fill: "8B0000" },
                    children: [new Paragraph({ children: [new TextRun({ text: "Event Code", bold: true, color: "FFFFFF", size: 18 })] })],
                    width: { size: includePoc ? 12 : 14, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                    shading: { fill: "8B0000" },
                    children: [new Paragraph({ children: [new TextRun({ text: "Client Name", bold: true, color: "FFFFFF", size: 18 })] })],
                    width: { size: includePoc ? 16 : 20, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                    shading: { fill: "8B0000" },
                    children: [new Paragraph({ children: [new TextRun({ text: "Dates", bold: true, color: "FFFFFF", size: 18 })] })],
                    width: { size: includePoc ? 14 : 16, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                    shading: { fill: "8B0000" },
                    children: [new Paragraph({ children: [new TextRun({ text: "Complete Venue Address", bold: true, color: "FFFFFF", size: 18 })] })],
                    width: { size: includePoc ? 25 : 27, type: WidthType.PERCENTAGE }
                }),
            ]

            if (includePoc) {
                headerCells.push(
                    new TableCell({
                        shading: { fill: "8B0000" },
                        children: [new Paragraph({ children: [new TextRun({ text: "POC Details", bold: true, color: "FFFFFF", size: 18 })] })],
                        width: { size: 15, type: WidthType.PERCENTAGE }
                    })
                )
            }

            headerCells.push(
                new TableCell({
                    shading: { fill: "8B0000" },
                    children: [new Paragraph({ children: [new TextRun({ text: "Pax / Size", bold: true, color: "FFFFFF", size: 18 })] })],
                    width: { size: includePoc ? 7 : 10, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                    shading: { fill: "8B0000" },
                    children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true, color: "FFFFFF", size: 18 })] })],
                    width: { size: includePoc ? 7 : 8, type: WidthType.PERCENTAGE }
                })
            )

            const headerRow = new TableRow({
                tableHeader: true,
                children: headerCells
            })

            const dataRows = filteredEvents.map((evt, idx) => {
                const clientName = evt.client?.entity_name || evt.clients?.entity_name || '—'
                const start = new Date(evt.event_date).toLocaleDateString('en-GB')
                const end = evt.end_date ? new Date(evt.end_date).toLocaleDateString('en-GB') : start
                const dateText = start === end ? start : `${start} to ${end}`
                const venueInfo = getCompleteVenueAddress(evt)
                const pocInfo = getPocDetails(evt)
                const paxText = evt.pax_count ? `${evt.pax_count} (${evt.event_size || 'M'})` : (evt.event_size || '—')
                const statusInfo = getStatusDisplayInfo(evt)

                const cells = [
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: `${idx + 1}`, size: 18 })] })]
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: evt.event_code || '—', bold: true, size: 18 })] })]
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: clientName, size: 18 })] })]
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: dateText, size: 18 })] })]
                    }),
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: venueInfo.venueName || 'Venue TBD', bold: true, size: 16 }),
                                    ...(venueInfo.streetAddress ? [new TextRun({ text: `\n${venueInfo.streetAddress}`, size: 14, color: "444444" })] : []),
                                    ...(venueInfo.cityStateZip ? [new TextRun({ text: `\n${venueInfo.cityStateZip}`, size: 14, color: "666666" })] : []),
                                ]
                            })
                        ]
                    }),
                ]

                if (includePoc) {
                    cells.push(
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: pocInfo.name || '—', bold: Boolean(pocInfo.name), size: 16 }),
                                        ...(pocInfo.mobile ? [new TextRun({ text: `\nPh: ${pocInfo.mobile}`, size: 14, color: "333333" })] : []),
                                        ...(pocInfo.email ? [new TextRun({ text: `\n${pocInfo.email}`, size: 14, color: "555555" })] : []),
                                    ]
                                })
                            ]
                        })
                    )
                }

                cells.push(
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: paxText, size: 18 })] })]
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: statusInfo.label, bold: true, size: 16 })] })]
                    })
                )

                return new TableRow({ children: cells })
            })

            const doc = new Document({
                sections: [{
                    properties: {
                        page: {
                            margin: { top: 720, bottom: 720, left: 720, right: 720 },
                            size: { orientation: 'landscape' as any }
                        }
                    },
                    children: [
                        new Paragraph({
                            heading: HeadingLevel.HEADING_1,
                            children: [
                                new TextRun({ text: "THE RAMESHWARAM CAFE", bold: true, size: 32, color: "8B0000" })
                            ]
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ text: "EVENT CALENDAR SCHEDULE REPORT", bold: true, size: 24, color: "333333" })
                            ]
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ 
                                    text: `Filters Applied: Dates: ${fromDate || 'All'} to ${toDate || 'All'} | Status: ${statusFilter.toUpperCase()} | Client: ${clientFilter === 'all' ? 'All Clients' : clientFilter} | Complete Venue: YES | POC Details: ${includePoc ? 'Included' : 'Excluded'} | Total Events: ${filteredEvents.length}`,
                                    size: 16,
                                    color: "666666"
                                })
                            ]
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ 
                                    text: `Generated on: ${new Date().toLocaleString('en-GB')}`,
                                    size: 14,
                                    italics: true,
                                    color: "888888"
                                })
                            ]
                        }),
                        new Paragraph({ text: "" }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            borders: tableBorder,
                            rows: [headerRow, ...dataRows]
                        })
                    ]
                }]
            })

            const blob = await Packer.toBlob(doc)
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = `Event_Calendar_Schedule_${fromDate || 'start'}_to_${toDate || 'end'}.docx`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (err: any) {
            alert("Error exporting Word document: " + err.message)
        } finally {
            setExportingWord(false)
        }
    }

    // Export to PDF (.pdf)
    const handleExportPdf = () => {
        setExportingPdf(true)
        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

            // Title Header
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(18)
            doc.setTextColor(139, 0, 0)
            doc.text("THE RAMESHWARAM CAFE", 14, 15)

            doc.setFontSize(12)
            doc.setTextColor(40, 40, 40)
            doc.text("EVENT CALENDAR SCHEDULE REPORT", 14, 22)

            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8.5)
            doc.setTextColor(100, 100, 100)
            const filterSummary = `Date Range: ${fromDate || 'All'} to ${toDate || 'All'}  |  Status: ${statusFilter.toUpperCase()}  |  Client: ${clientFilter === 'all' ? 'All' : clientFilter}  |  POC: ${includePoc ? 'Yes' : 'No'}  |  Total: ${filteredEvents.length} Events`
            doc.text(filterSummary, 14, 28)
            doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 280, 28, { align: 'right' })

            const tableRows = filteredEvents.map((evt, idx) => {
                const clientName = evt.client?.entity_name || evt.clients?.entity_name || '—'
                const start = new Date(evt.event_date).toLocaleDateString('en-GB')
                const end = evt.end_date ? new Date(evt.end_date).toLocaleDateString('en-GB') : start
                const dateText = start === end ? start : `${start} - ${end}`
                
                const venueInfo = getCompleteVenueAddress(evt)
                const venueString = [
                    venueInfo.venueName,
                    venueInfo.streetAddress,
                    venueInfo.cityStateZip
                ].filter(Boolean).join('\n') || '—'

                const pocInfo = getPocDetails(evt)
                const pocString = [
                    pocInfo.name,
                    pocInfo.mobile ? `Ph: ${pocInfo.mobile}` : '',
                    pocInfo.email
                ].filter(Boolean).join('\n') || '—'

                const paxText = evt.pax_count ? `${evt.pax_count} (${evt.event_size || 'M'})` : (evt.event_size || '—')
                const statusInfo = getStatusDisplayInfo(evt)

                if (includePoc) {
                    return [
                        (idx + 1).toString(),
                        evt.event_code || '—',
                        clientName,
                        dateText,
                        venueString,
                        pocString,
                        paxText,
                        statusInfo.label
                    ]
                } else {
                    return [
                        (idx + 1).toString(),
                        evt.event_code || '—',
                        clientName,
                        dateText,
                        venueString,
                        paxText,
                        statusInfo.label
                    ]
                }
            })

            const pdfHeaders = includePoc
                ? [['#', 'Event Code', 'Client Entity', 'Event Dates', 'Complete Venue Address', 'POC Details', 'Pax / Size', 'Status']]
                : [['#', 'Event Code', 'Client Entity', 'Event Dates', 'Complete Venue Address', 'Pax / Size', 'Status']]

            const columnStylesConfig: { [key: string]: any } = includePoc
                ? {
                    0: { cellWidth: 8, halign: 'center' as const },
                    1: { cellWidth: 26, fontStyle: 'bold' as const },
                    2: { cellWidth: 46 },
                    3: { cellWidth: 30 },
                    4: { cellWidth: 65 },
                    5: { cellWidth: 46 },
                    6: { cellWidth: 22 },
                    7: { cellWidth: 26, fontStyle: 'bold' as const }
                }
                : {
                    0: { cellWidth: 10, halign: 'center' as const },
                    1: { cellWidth: 30, fontStyle: 'bold' as const },
                    2: { cellWidth: 55 },
                    3: { cellWidth: 35 },
                    4: { cellWidth: 85 },
                    5: { cellWidth: 26 },
                    6: { cellWidth: 28, fontStyle: 'bold' as const }
                }

            autoTable(doc, {
                head: pdfHeaders,
                body: tableRows,
                startY: 32,
                theme: 'grid',
                headStyles: {
                    fillColor: [139, 0, 0],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 8.5,
                    cellPadding: 3
                },
                styles: {
                    fontSize: 7.5,
                    cellPadding: 2.5,
                    textColor: [40, 40, 40],
                    overflow: 'linebreak'
                },
                columnStyles: columnStylesConfig,
                alternateRowStyles: {
                    fillColor: [248, 250, 252]
                },
                margin: { left: 14, right: 14 }
            })

            doc.save(`Event_Calendar_Schedule_${fromDate || 'start'}_to_${toDate || 'end'}.pdf`)
        } catch (err: any) {
            alert("Error exporting PDF: " + err.message)
        } finally {
            setExportingPdf(false)
        }
    }

    // Browser Print
    const handleBrowserPrint = () => {
        window.print()
    }

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm print:p-0 print:bg-white">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-200 print:max-h-none print:shadow-none print:rounded-none print:w-full">
                
                {/* Modal Header (Hidden on Print) */}
                <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/70 print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-bold shrink-0">
                            🖨️
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-black text-gray-900">Print / Export Calendar Events</h3>
                            <p className="text-xs font-semibold text-gray-500">Includes complete venue address, status, and optional POC details</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition cursor-pointer shrink-0">
                        ✕
                    </button>
                </div>

                {/* Filters & Options Row (Hidden on Print) */}
                <div className="p-4 sm:p-5 bg-white border-b border-gray-100 space-y-4 print:hidden">
                    {/* Presets */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Quick Presets:</span>
                        <button onClick={() => applyPreset('this_month')} className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer">This Month</button>
                        <button onClick={() => applyPreset('next_month')} className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer">Next Month</button>
                        <button onClick={() => applyPreset('next_30')} className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer">Next 30 Days</button>
                        <button onClick={() => applyPreset('all')} className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer">All Events</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* From Date */}
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">From Date</label>
                            <input 
                                type="date" 
                                className="w-full border border-gray-200 bg-gray-50 p-2 rounded-xl text-xs font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500 transition"
                                value={fromDate}
                                onChange={e => setFromDate(e.target.value)}
                            />
                        </div>

                        {/* To Date */}
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">To Date</label>
                            <input 
                                type="date" 
                                className="w-full border border-gray-200 bg-gray-50 p-2 rounded-xl text-xs font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500 transition"
                                value={toDate}
                                onChange={e => setToDate(e.target.value)}
                            />
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Status</label>
                            <select 
                                className="w-full border border-gray-200 bg-gray-50 p-2 rounded-xl text-xs font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500 transition"
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value as any)}
                            >
                                <option value="all">All Statuses</option>
                                <option value="confirmed">Confirmed Only</option>
                                <option value="pending">Pending Only</option>
                            </select>
                        </div>

                        {/* Client Filter */}
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Client</label>
                            <select 
                                className="w-full border border-gray-200 bg-gray-50 p-2 rounded-xl text-xs font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500 transition"
                                value={clientFilter}
                                onChange={e => setClientFilter(e.target.value)}
                            >
                                <option value="all">All Clients ({clientList.length})</option>
                                {clientList.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Options: POC Details Toggle & Venue Address Info */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                        <label className="flex items-center gap-2 cursor-pointer select-none bg-amber-50/70 border border-amber-200/80 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-950 hover:bg-amber-100/80 transition">
                            <input
                                type="checkbox"
                                checked={includePoc}
                                onChange={e => setIncludePoc(e.target.checked)}
                                className="w-4 h-4 text-amber-900 rounded border-amber-300 focus:ring-amber-500 cursor-pointer accent-amber-900"
                            />
                            <span>Include Point of Contact (POC) details in export</span>
                        </label>

                        <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                            <span>📍</span> Complete Venue Address is automatically included
                        </span>
                    </div>
                </div>

                {/* Browser Print Header (Visible ONLY when printed) */}
                <div className="hidden print:block p-6 border-b-2 border-black">
                    <h1 className="text-2xl font-black text-black tracking-tight">THE RAMESHWARAM CAFE</h1>
                    <h2 className="text-base font-bold text-gray-800 mt-0.5">EVENT CALENDAR SCHEDULE REPORT</h2>
                    <p className="text-xs text-gray-600 mt-1 font-medium">
                        Dates: {fromDate || 'All'} to {toDate || 'All'}  |  Status: {statusFilter.toUpperCase()}  |  Client: {clientFilter === 'all' ? 'All Clients' : clientFilter}  |  POC Details: {includePoc ? 'Included' : 'Excluded'}  |  Total: {filteredEvents.length} Events
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                        Generated on {new Date().toLocaleString('en-GB')}
                    </p>
                </div>

                {/* Table Live Preview & Printable Container */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-gray-50/50 print:bg-white print:p-0 print:overflow-visible">
                    <div className="flex justify-between items-center mb-3 print:hidden">
                        <span className="text-xs font-bold text-gray-600">
                            Matching Events: <strong className="text-blue-600 font-black">{filteredEvents.length}</strong>
                        </span>
                        <span className="text-[11px] text-gray-400 font-medium">
                            Previewing schedule table
                        </span>
                    </div>

                    {filteredEvents.length === 0 ? (
                        <div className="p-12 text-center bg-white rounded-xl border border-gray-200 text-gray-400 font-bold text-sm">
                            No events match the selected filters.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm print:border-black print:rounded-none">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-gray-100/80 border-b border-gray-200 text-[10px] font-black text-gray-600 uppercase tracking-wider print:bg-gray-200 print:text-black">
                                        <tr>
                                            <th className="p-3 w-8 text-center">#</th>
                                            <th className="p-3">Event Code</th>
                                            <th className="p-3">Client Entity</th>
                                            <th className="p-3 whitespace-nowrap">Dates</th>
                                            <th className="p-3 min-w-[220px]">Complete Venue Address</th>
                                            {includePoc && <th className="p-3 min-w-[180px]">POC Details</th>}
                                            <th className="p-3 whitespace-nowrap">Pax / Size</th>
                                            <th className="p-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 print:divide-gray-300">
                                        {filteredEvents.map((evt, idx) => {
                                            const start = new Date(evt.event_date).toLocaleDateString('en-GB')
                                            const end = evt.end_date ? new Date(evt.end_date).toLocaleDateString('en-GB') : start
                                            const dateText = start === end ? start : `${start} - ${end}`
                                            const venueInfo = getCompleteVenueAddress(evt)
                                            const pocInfo = getPocDetails(evt)
                                            const statusInfo = getStatusDisplayInfo(evt)

                                            return (
                                                <tr key={evt.id} className="hover:bg-gray-50/80 transition align-top">
                                                    <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                                                    <td className="p-3 font-black text-gray-800 whitespace-nowrap">{evt.event_code}</td>
                                                    <td className="p-3 font-bold text-gray-900">{evt.client?.entity_name || evt.clients?.entity_name || '—'}</td>
                                                    <td className="p-3 text-gray-600 font-medium whitespace-nowrap">{dateText}</td>
                                                    
                                                    {/* Complete Venue Address */}
                                                    <td className="p-3 text-gray-700 font-medium space-y-0.5">
                                                        <div className="font-bold text-gray-900">{venueInfo.venueName || 'Venue TBD'}</div>
                                                        {venueInfo.streetAddress && (
                                                            <div className="text-[11px] text-gray-600 leading-snug">{venueInfo.streetAddress}</div>
                                                        )}
                                                        {venueInfo.cityStateZip && (
                                                            <div className="text-[10px] font-bold text-gray-500">{venueInfo.cityStateZip}</div>
                                                        )}
                                                    </td>

                                                    {/* POC Details (if toggled) */}
                                                    {includePoc && (
                                                        <td className="p-3 text-gray-700 font-medium space-y-0.5">
                                                            {pocInfo.hasPoc ? (
                                                                <>
                                                                    <div className="font-bold text-gray-900">{pocInfo.name || '—'}</div>
                                                                    {pocInfo.mobile && (
                                                                        <div className="text-[11px] text-gray-600 font-mono flex items-center gap-1">
                                                                            <span>📞</span> {pocInfo.mobile}
                                                                        </div>
                                                                    )}
                                                                    {pocInfo.email && (
                                                                        <div className="text-[10px] text-gray-500 font-mono truncate max-w-[160px]">
                                                                            ✉️ {pocInfo.email}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="text-gray-400 italic">—</span>
                                                            )}
                                                        </td>
                                                    )}

                                                    <td className="p-3 text-gray-600 font-semibold whitespace-nowrap">
                                                        {evt.pax_count ? `${evt.pax_count} Pax` : evt.event_size || '—'}
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${statusInfo.badgeClass}`}>
                                                            {statusInfo.label}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action Buttons (Hidden on Print) */}
                <div className="p-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3 print:hidden">
                    <div className="text-xs text-gray-400 font-medium">
                        Export as Word (.docx) or PDF (.pdf) with complete venue & POC details
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={handleExportWord}
                            disabled={exportingWord || filteredEvents.length === 0}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            <span>📄</span> {exportingWord ? 'Exporting...' : 'Export Word (.docx)'}
                        </button>
                        <button
                            onClick={handleExportPdf}
                            disabled={exportingPdf || filteredEvents.length === 0}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            <span>📑</span> {exportingPdf ? 'Exporting...' : 'Export PDF (.pdf)'}
                        </button>
                        <button
                            onClick={handleBrowserPrint}
                            disabled={filteredEvents.length === 0}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-black text-white hover:bg-gray-800 font-bold text-xs shadow transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            <span>🖨️</span> Print Table
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
