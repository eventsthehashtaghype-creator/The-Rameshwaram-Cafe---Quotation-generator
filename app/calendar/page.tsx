'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'
import AppSidebar from '@/app/components/AppSidebar'

export default function CalendarPage() {
    const [events, setEvents] = useState<any[]>([])
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDayOverflow, setSelectedDayOverflow] = useState<{ day: number, events: any[] } | null>(null)

    useEffect(() => { fetchEvents() }, [])

    async function fetchEvents() {
        const { data } = await supabase.from('events').select('*, client:clients(entity_name)')
        if (data) setEvents(data.filter((e: any) => e.status !== 'cancelled'))
    }

    const year = currentDate.getFullYear(); const month = currentDate.getMonth()
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    const firstDay = new Date(year, month, 1); const daysInMonth = new Date(year, month + 1, 0).getDate()
    const startingDayOfWeek = firstDay.getDay()

    const getEventsForDay = (day: number) => events.filter(e => {
        const currentTargetDate = new Date(year, month, day) // The calendar cell date
        const startDate = new Date(e.event_date)
        const endDate = e.end_date ? new Date(e.end_date) : startDate

        // Strip time from all dates for accurate day comparison
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(0, 0, 0, 0)
        currentTargetDate.setHours(0, 0, 0, 0)

        // Return true if currentTargetDate is between or equal to start and end
        return currentTargetDate >= startDate && currentTargetDate <= endDate
    })

    return (
        <div className="flex h-screen bg-[#F3F4F6] font-sans overflow-hidden">
            <AppSidebar />
            <main className="flex-1 overflow-y-auto relative p-4 md:p-8 lg:p-12">
                {/* Mobile Header Spacer */}
                <div className="h-16 lg:hidden"></div>

                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Event Calendar</h1>
                        <p className="text-slate-500 mt-2 text-sm font-medium">Manage your schedule for {monthNames[month]} {year}.</p>
                    </div>

                    <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 p-1.5">
                        <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-800 transition">←</button>
                        <span className="w-48 text-center font-bold text-slate-800 text-lg select-none">{monthNames[month]} {year}</span>
                        <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-800 transition">→</button>
                    </div>
                </div>

                {/* CALENDAR GRID */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden w-full">
                    <div className="overflow-x-auto w-full scrollbar-hide">
                        <div className="min-w-[1000px] w-full">
                            {/* Days Header */}
                            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                    <div key={d} className="py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">{d}</div>
                                ))}
                            </div>

                            {/* Days Cells & Gantt Container */}
                            <div className="grid grid-cols-7 bg-slate-100 gap-px border-b border-t border-slate-100">
                                {/* Grid Background Cells */}
                                {Array.from({ length: Math.ceil((startingDayOfWeek + daysInMonth) / 7) * 7 }).map((_, i) => {
                                    const weekIndex = Math.floor(i / 7)
                                    const colIndex = i % 7
                                    const day = i - startingDayOfWeek + 1
                                    const isCurrentMonth = day > 0 && day <= daysInMonth

                                    if (!isCurrentMonth) {
                                        return <div key={`empty-${i}`} className="bg-white/50 min-h-[180px]" style={{ gridRow: weekIndex + 1, gridColumn: colIndex + 1 }}></div>
                                    }

                                    const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year

                                    const eventsOnDay = getEventsForDay(day)
                                    const overflowCount = Math.max(0, eventsOnDay.length - 3)

                                    return (
                                        <div key={`day-${day}`} className={`bg-white min-h-[180px] p-3 transition hover:bg-slate-50 group flex flex-col`} style={{ gridRow: weekIndex + 1, gridColumn: colIndex + 1 }}>
                                            <span className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full shrink-0
                                                ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                                {day}
                                            </span>
                                            <div className="mt-auto pt-2 flex justify-end relative z-20 pointer-events-none">
                                                {overflowCount > 0 && (
                                                    <span
                                                        onClick={(e) => { e.stopPropagation(); setSelectedDayOverflow({ day, events: eventsOnDay }) }}
                                                        className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded shadow-sm opacity-90 uppercase tracking-widest pointer-events-auto hover:bg-slate-200 cursor-pointer transition"
                                                    >
                                                        +{overflowCount} More
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}

                                {/* Gantt Event Bars Layer (Rendered inline in the same grid) */}
                                {Array.from({ length: Math.ceil((startingDayOfWeek + daysInMonth) / 7) }).map((_, weekIndex) => {
                                    // Find events that fall into this week row
                                    const weekStartDay = (weekIndex * 7) - startingDayOfWeek + 1
                                    const weekEndDay = weekStartDay + 6

                                    // Filter events touching this week
                                    const weekEvents = events.filter(evt => {
                                        const sDate = new Date(evt.event_date); sDate.setHours(0, 0, 0, 0)
                                        const eDate = evt.end_date ? new Date(evt.end_date) : new Date(sDate); eDate.setHours(0, 0, 0, 0)

                                        const wStart = new Date(year, month, weekStartDay); wStart.setHours(0, 0, 0, 0)
                                        const wEnd = new Date(year, month, weekEndDay); wEnd.setHours(0, 0, 0, 0)

                                        return sDate <= wEnd && eDate >= wStart
                                    }).sort((a, b) => {
                                        const aStart = new Date(a.event_date).getTime()
                                        const bStart = new Date(b.event_date).getTime()
                                        if (aStart !== bStart) return aStart - bStart // Sort by start date (ascending)
                                        const aDuration = new Date(a.end_date || a.event_date).getTime() - aStart
                                        const bDuration = new Date(b.end_date || b.event_date).getTime() - bStart
                                        return bDuration - aDuration // Then sort by longest duration (descending)
                                    })

                                    // Dynamic Row Packing Algorithm
                                    const rowAssignments = new Map<string, number>()
                                    const rowsData: { start: Date, end: Date }[][] = []

                                    weekEvents.forEach((evt) => {
                                        const sDate = new Date(evt.event_date); sDate.setHours(0, 0, 0, 0)
                                        const eDate = evt.end_date ? new Date(evt.end_date) : new Date(sDate); eDate.setHours(0, 0, 0, 0)

                                        // Clamp event to the current week's visible bounds
                                        const wStart = new Date(year, month, weekStartDay); wStart.setHours(0, 0, 0, 0)
                                        const wEnd = new Date(year, month, weekEndDay); wEnd.setHours(0, 0, 0, 0)
                                        const visibleStart = sDate < wStart ? wStart : sDate
                                        const visibleEnd = eDate > wEnd ? wEnd : eDate

                                        let assignedRow = 0
                                        while (true) {
                                            const row = rowsData[assignedRow] || []
                                            // Two events overlap if their visible start is LTE the existing end AND their visible end is GTE the existing start
                                            const hasOverlap = row.some(existing => {
                                                return visibleStart.getTime() <= existing.end.getTime() && visibleEnd.getTime() >= existing.start.getTime()
                                            })

                                            if (!hasOverlap) {
                                                if (!rowsData[assignedRow]) rowsData[assignedRow] = []
                                                rowsData[assignedRow].push({ start: visibleStart, end: visibleEnd })
                                                rowAssignments.set(evt.id, assignedRow)
                                                break
                                            }
                                            assignedRow++
                                        }
                                    })

                                    return weekEvents.map((evt) => {
                                        const sDate = new Date(evt.event_date); sDate.setHours(0, 0, 0, 0)
                                        const eDate = evt.end_date ? new Date(evt.end_date) : new Date(sDate); eDate.setHours(0, 0, 0, 0)

                                        // Clamp to week bounds
                                        const wStart = new Date(year, month, weekStartDay); wStart.setHours(0, 0, 0, 0)
                                        const wEnd = new Date(year, month, weekEndDay); wEnd.setHours(0, 0, 0, 0)

                                        const actualStart = sDate < wStart ? wStart : sDate
                                        const actualEnd = eDate > wEnd ? wEnd : eDate

                                        // Calculate col start (0-6)
                                        let startCol = actualStart.getDay()

                                        // Calculate duration in days within this week
                                        const diffTime = Math.abs(actualEnd.getTime() - actualStart.getTime())
                                        const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

                                        const sizeColorClass =
                                            evt.event_size === 'Small' ? 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200' :
                                                evt.event_size === 'Large' ? 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200' :
                                                    'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'

                                        const isConfirmed = evt.status === 'confirmed'

                                        const assignedRow = rowAssignments.get(evt.id) || 0

                                        // Cap visual rendering at 3 items, the rest are shown in the "+X More" pill
                                        if (assignedRow >= 3) return null;

                                        const topOffset = (assignedRow * 32) + 48 // 48px to clear the day number

                                        // Only show title if it starts in this row, or it's the first day of the week
                                        const showTitle = sDate.getTime() === actualStart.getTime() || startCol === 0

                                        // Check if it's visually continuing from previous row or to next row to adjust border radii
                                        const continuesFromPrev = sDate < wStart
                                        const continuesToNext = eDate > wEnd

                                        return (
                                            <div key={`${evt.id}-${weekIndex}`} style={{ gridRow: weekIndex + 1, gridColumn: `${startCol + 1} / span ${durationDays}`, marginTop: `${topOffset}px` }} className="h-7 z-10 mx-1 mb-2">
                                                <Link href={`/quotation/${evt.id}`}
                                                    className={`h-full w-full text-[10px] font-bold px-2 pointer-events-auto border transition transform hover:scale-[1.01] hover:z-20 shadow-sm flex items-center gap-1.5 overflow-hidden ${sizeColorClass} ${continuesFromPrev ? 'rounded-l-sm border-l-0 -ml-1' : 'rounded-l-lg'} ${continuesToNext ? 'rounded-r-sm border-r-0 -mr-1' : 'rounded-r-lg'}`}>
                                                    {showTitle && (
                                                        <>
                                                            {isConfirmed && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 shadow-sm"></span>}
                                                            <span className="truncate">{evt.event_code} - {evt.client?.entity_name}</span>
                                                        </>
                                                    )}
                                                </Link>
                                            </div>
                                        )
                                    })
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* DAY OVERFLOW MODAL */}
            {selectedDayOverflow && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-black text-gray-900">Events for the {selectedDayOverflow.day}</h3>
                                <p className="text-sm font-medium text-gray-500 mt-1">{monthNames[month]} {year}</p>
                            </div>
                            <button onClick={() => setSelectedDayOverflow(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-3">
                            {selectedDayOverflow.events.map((evt: any, idx: number) => {
                                const isConfirmed = evt.status === 'confirmed'
                                const sizeColorClass =
                                    evt.event_size === 'Small' ? 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100 hover:border-purple-300' :
                                        evt.event_size === 'Large' ? 'bg-red-50 text-red-900 border-red-200 hover:bg-red-100 hover:border-red-300' :
                                            'bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100 hover:border-slate-300'

                                return (
                                    <Link key={`modal-${evt.id}-${idx}`} href={`/quotation/${evt.id}`} className={`block p-4 rounded-xl border transition shadow-sm group ${sizeColorClass}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                {isConfirmed && <span className="w-2 h-2 rounded-full bg-green-500 shadow-sm" title="Confirmed Event"></span>}
                                                <span className="font-black text-sm">{evt.event_code}</span>
                                            </div>
                                            <span className="text-xs font-bold uppercase tracking-wider opacity-60 bg-white/50 px-2 py-0.5 rounded">{evt.event_size}</span>
                                        </div>
                                        <p className="font-bold text-lg mb-1">{evt.client?.entity_name}</p>
                                        <div className="flex items-center gap-4 text-xs font-medium opacity-80 mt-3 pt-3 border-t border-black/5">
                                            <span>Starts: {new Date(evt.event_date).toLocaleDateString()}</span>
                                            {evt.end_date && <span>Ends: {new Date(evt.end_date).toLocaleDateString()}</span>}
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
