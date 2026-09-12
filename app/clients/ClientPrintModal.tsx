'use client'

import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Client } from '@/app/types'

interface ClientPrintModalProps {
    isOpen: boolean
    onClose: () => void
    allClients: Client[]
    filteredClients: Client[]
    searchTerm: string
}

type ColumnKey = 'entity_name' | 'contact_person' | 'mobile' | 'email' | 'gst_number' | 'city' | 'state' | 'address' | 'created_at'

interface ColumnDef {
    key: ColumnKey
    label: string
    defaultChecked: boolean
}

const AVAILABLE_COLUMNS: ColumnDef[] = [
    { key: 'entity_name', label: 'Entity / Company Name', defaultChecked: true },
    { key: 'contact_person', label: 'Contact Person', defaultChecked: true },
    { key: 'mobile', label: 'Phone / Mobile', defaultChecked: true },
    { key: 'email', label: 'Email Address', defaultChecked: true },
    { key: 'gst_number', label: 'GSTIN', defaultChecked: true },
    { key: 'city', label: 'City', defaultChecked: true },
    { key: 'state', label: 'State', defaultChecked: true },
    { key: 'address', label: 'Full Address', defaultChecked: true },
    { key: 'created_at', label: 'Added Date', defaultChecked: false }
]

export default function ClientPrintModal({
    isOpen,
    onClose,
    allClients,
    filteredClients,
    searchTerm
}: ClientPrintModalProps) {
    // Mode: 'all_details' (all columns) vs 'select_details' (custom columns)
    const [detailMode, setDetailMode] = useState<'all' | 'custom'>('all')

    // Selection of columns when in 'custom' mode
    const [selectedColumns, setSelectedColumns] = useState<Record<ColumnKey, boolean>>({
        entity_name: true,
        contact_person: true,
        mobile: true,
        email: true,
        gst_number: true,
        city: true,
        state: true,
        address: false,
        created_at: false
    })

    // Scope: 'all' or 'filtered'
    const [dataScope, setDataScope] = useState<'all' | 'filtered'>(searchTerm.trim() ? 'filtered' : 'all')

    // Selected individual client IDs for fine-grained print selection
    const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set())
    const [useManualSelection, setUseManualSelection] = useState(false)

    // Exporting states
    const [exportingExcel, setExportingExcel] = useState(false)
    const [exportingPdf, setExportingPdf] = useState(false)

    // Clients to include
    const baseClients = dataScope === 'filtered' ? filteredClients : allClients

    const clientsToExport = useMemo(() => {
        if (!useManualSelection || selectedClientIds.size === 0) {
            return baseClients
        }
        return baseClients.filter(c => selectedClientIds.has(c.id))
    }, [baseClients, useManualSelection, selectedClientIds])

    // Active column list
    const activeColumns = useMemo(() => {
        if (detailMode === 'all') {
            return AVAILABLE_COLUMNS
        }
        return AVAILABLE_COLUMNS.filter(col => selectedColumns[col.key])
    }, [detailMode, selectedColumns])

    if (!isOpen) return null

    // Toggle column checkbox
    const toggleColumn = (key: ColumnKey) => {
        setSelectedColumns(prev => ({ ...prev, [key]: !prev[key] }))
    }

    // Toggle individual client selection
    const toggleClientSelection = (id: string) => {
        setSelectedClientIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAllClients = () => {
        if (selectedClientIds.size === baseClients.length) {
            setSelectedClientIds(new Set())
        } else {
            setSelectedClientIds(new Set(baseClients.map(c => c.id)))
        }
    }

    // Helper: format cell value
    const formatCellValue = (client: any, key: ColumnKey) => {
        if (key === 'created_at') {
            return client.created_at ? new Date(client.created_at).toLocaleDateString('en-GB') : '—'
        }
        return client[key] || '—'
    }

    // Export to Excel (.xlsx)
    const handleExportExcel = () => {
        setExportingExcel(true)
        try {
            // Build data objects with active column headers
            const sheetData = clientsToExport.map((client, idx) => {
                const row: Record<string, any> = { 'S.No': idx + 1 }
                activeColumns.forEach(col => {
                    row[col.label] = formatCellValue(client, col.key)
                })
                return row
            })

            const worksheet = XLSX.utils.json_to_sheet(sheetData)

            // Auto-fit column widths
            const colWidths = [{ wch: 6 }]
            activeColumns.forEach(col => {
                colWidths.push({ wch: Math.max(col.label.length + 4, 18) })
            })
            worksheet['!cols'] = colWidths

            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients')

            const filename = `Client_Master_Directory_${new Date().toISOString().split('T')[0]}.xlsx`
            XLSX.writeFile(workbook, filename)
        } catch (err: any) {
            alert('Error exporting Excel file: ' + err.message)
        } finally {
            setExportingExcel(false)
        }
    }

    // Export to PDF (.pdf)
    const handleExportPdf = () => {
        setExportingPdf(true)
        try {
            const isWide = activeColumns.length > 5
            const doc = new jsPDF({
                orientation: isWide ? 'landscape' : 'portrait',
                unit: 'mm',
                format: 'a4'
            })

            // Header
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(16)
            doc.setTextColor(139, 0, 0)
            doc.text("THE RAMESHWARAM CAFE", 14, 14)

            doc.setFontSize(11)
            doc.setTextColor(40, 40, 40)
            doc.text("CLIENT MASTER DIRECTORY", 14, 20)

            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8)
            doc.setTextColor(100, 100, 100)
            const summary = `Scope: ${dataScope === 'all' ? 'All Clients' : 'Filtered Search'} | Detail Level: ${detailMode === 'all' ? 'All Details' : 'Custom Fields'} | Total Records: ${clientsToExport.length}`
            doc.text(summary, 14, 26)
            doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, isWide ? 280 : 195, 26, { align: 'right' })

            // AutoTable headers & body
            const headers = ['#', ...activeColumns.map(c => c.label)]
            const body = clientsToExport.map((client, idx) => [
                (idx + 1).toString(),
                ...activeColumns.map(col => formatCellValue(client, col.key))
            ])

            autoTable(doc, {
                head: [headers],
                body: body,
                startY: 30,
                theme: 'grid',
                headStyles: {
                    fillColor: [139, 0, 0],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 8,
                    cellPadding: 2.5
                },
                styles: {
                    fontSize: 7.5,
                    cellPadding: 2,
                    textColor: [40, 40, 40],
                    overflow: 'linebreak'
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252]
                },
                margin: { left: 14, right: 14 }
            })

            doc.save(`Client_Master_Directory_${new Date().toISOString().split('T')[0]}.pdf`)
        } catch (err: any) {
            alert('Error generating PDF: ' + err.message)
        } finally {
            setExportingPdf(false)
        }
    }

    // Direct Browser Print
    const handleBrowserPrint = () => {
        window.print()
    }

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold">
                            🖨️
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900">Print / Export Client Directory</h3>
                            <p className="text-xs font-semibold text-gray-500">
                                Choose all details or select specific columns to print in table format or export to Excel sheet
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition">
                        ✕
                    </button>
                </div>

                {/* Filters & Column Selection Options */}
                <div className="p-5 bg-white border-b border-gray-100 space-y-4">
                    {/* Controls Row: Scope & Detail Mode */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Scope Toggle */}
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Clients:</span>
                            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                                <button
                                    onClick={() => { setDataScope('all'); setUseManualSelection(false) }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${dataScope === 'all' && !useManualSelection ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    All Clients ({allClients.length})
                                </button>
                                {searchTerm.trim() && (
                                    <button
                                        onClick={() => { setDataScope('filtered'); setUseManualSelection(false) }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${dataScope === 'filtered' && !useManualSelection ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Search Results ({filteredClients.length})
                                    </button>
                                )}
                                <button
                                    onClick={() => setUseManualSelection(!useManualSelection)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${useManualSelection ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    Select Specific ({selectedClientIds.size > 0 ? selectedClientIds.size : 'None'})
                                </button>
                            </div>
                        </div>

                        {/* Detail Mode Toggle */}
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Columns / Details:</span>
                            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                                <button
                                    onClick={() => setDetailMode('all')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${detailMode === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    All Details ({AVAILABLE_COLUMNS.length} Columns)
                                </button>
                                <button
                                    onClick={() => setDetailMode('custom')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${detailMode === 'custom' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    Select Specific Details
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Column Checkboxes if in Custom Mode */}
                    {detailMode === 'custom' && (
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 animate-in fade-in-50 duration-150">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
                                    Check details to include in table / export:
                                </span>
                                <div className="flex gap-2 text-[10px] font-bold text-blue-600">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            const allChecked = AVAILABLE_COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: true }), {})
                                            setSelectedColumns(allChecked as any)
                                        }}
                                        className="hover:underline"
                                    >
                                        Check All
                                    </button>
                                    <span>•</span>
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setSelectedColumns({ entity_name: true } as any)
                                        }}
                                        className="hover:underline"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                {AVAILABLE_COLUMNS.map(col => (
                                    <label key={col.key} className="flex items-center gap-2 text-xs font-bold text-gray-700 p-1.5 rounded-lg hover:bg-white cursor-pointer transition select-none">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                            checked={!!selectedColumns[col.key]}
                                            onChange={() => toggleColumn(col.key)}
                                            disabled={col.key === 'entity_name'} // Entity name always required
                                        />
                                        <span>{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Table Live Preview */}
                <div className="flex-1 overflow-y-auto p-5 bg-gray-50/50">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-gray-600">
                            Ready to Export: <strong className="text-emerald-600 font-black">{clientsToExport.length} Clients</strong> ({activeColumns.length} Columns)
                        </span>
                        {useManualSelection && (
                            <button
                                onClick={toggleSelectAllClients}
                                className="text-xs font-bold text-blue-600 hover:underline"
                            >
                                {selectedClientIds.size === baseClients.length ? 'Deselect All' : 'Select All in List'}
                            </button>
                        )}
                    </div>

                    {clientsToExport.length === 0 ? (
                        <div className="p-12 text-center bg-white rounded-xl border border-gray-200 text-gray-400 font-bold text-sm">
                            No clients match the current selection.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-gray-100/70 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                        <tr>
                                            {useManualSelection && (
                                                <th className="p-3 w-8 text-center">✓</th>
                                            )}
                                            <th className="p-3 w-10 text-center">#</th>
                                            {activeColumns.map(col => (
                                                <th key={col.key} className="p-3 whitespace-nowrap">
                                                    {col.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {clientsToExport.map((client, idx) => (
                                            <tr 
                                                key={client.id} 
                                                className={`hover:bg-gray-50/80 transition ${useManualSelection && selectedClientIds.has(client.id) ? 'bg-blue-50/40' : ''}`}
                                            >
                                                {useManualSelection && (
                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded text-blue-600 border-gray-300 cursor-pointer"
                                                            checked={selectedClientIds.has(client.id)}
                                                            onChange={() => toggleClientSelection(client.id)}
                                                        />
                                                    </td>
                                                )}
                                                <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                                                {activeColumns.map(col => (
                                                    <td key={col.key} className="p-3 text-gray-700 whitespace-nowrap">
                                                        {formatCellValue(client, col.key)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action Buttons */}
                <div className="p-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="text-xs text-gray-400 font-medium">
                        Export as Excel spreadsheet (.xlsx) or formatted PDF table
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={handleExportExcel}
                            disabled={exportingExcel || clientsToExport.length === 0}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                            <span>📊</span> {exportingExcel ? 'Generating...' : 'Export to Excel Sheet (.xlsx)'}
                        </button>
                        <button
                            onClick={handleExportPdf}
                            disabled={exportingPdf || clientsToExport.length === 0}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            <span>📑</span> {exportingPdf ? 'Generating...' : 'Export PDF (.pdf)'}
                        </button>
                        <button
                            onClick={handleBrowserPrint}
                            disabled={clientsToExport.length === 0}
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
