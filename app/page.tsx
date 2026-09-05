'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/app/lib/supabase'
import AppSidebar from './components/AppSidebar'
import NewEventModal from './components/NewEventModal'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { logActivity, getActivityLogs, getCurrentActorName, LogEntry } from '@/app/lib/audit'

export default function Dashboard() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [stats, setStats] = useState({ total: 0, upcoming: 0, action: 0 })

  // Internal Notes State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Activity Logs State
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logSearch, setLogSearch] = useState('')
  const [logFilter, setLogFilter] = useState<'all' | 'quotes' | 'menus' | 'status'>('all')

  const router = useRouter()

  // --- LOGIC ---
  async function fetchEvents() {
    setLoading(true)
    
    // Auth & Role check
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    
    const { data: clientUser } = await supabase.from('clients').select('id').eq('auth_user_id', session.user.id).single()
    if (clientUser) {
      router.replace('/portal/dashboard')
      return
    }

    const { data } = await supabase.from('events').select(`*, clients(entity_name, contact_person)`).order('created_at', { ascending: false })
    if (data) { setEvents(data as any); calculateStats(data) }
    setLoading(false)
  }

  async function fetchLogs() {
    setLogsLoading(true)
    const logs = await getActivityLogs(50)
    setRecentLogs(logs)
    setLogsLoading(false)
  }

  function calculateStats(data: any[]) {
    const total = data.length
    const upcoming = data.filter(e => new Date(e.event_date) > new Date()).length
    const action = data.filter(e =>
      e.status !== 'confirmed' && e.status !== 'cancelled' &&
      (e.status === 'draft' || e.quote_status === 'client_submitted')
    ).length
    setStats({ total, upcoming, action })
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActiveMenuId(null)
    if (newStatus === 'cancelled' && !window.confirm("Are you sure you want to reject/cancel this event?")) return
    await supabase.from('events').update({ status: newStatus }).eq('id', id)
    
    // Audit Logging
    const target = (events as any[]).find(e => e.id === id)
    if (target) {
      const adminName = await getCurrentActorName()
      const clientEntity = target.clients?.entity_name || 'Client'
      const actionTitle = newStatus === 'confirmed' ? 'Event Accepted' : (newStatus === 'cancelled' ? 'Event Rejected' : `Status: ${newStatus}`)
      const districtState = [target.city, target.state].filter(Boolean).join(', ') || 'Karnataka'
      
      await logActivity({
        actorName: adminName,
        clientName: clientEntity,
        action: actionTitle,
        districtState,
        eventStartDate: target.event_date,
        eventCode: target.event_code || 'EVENT',
        details: `Event marked as ${newStatus} by ${adminName}`,
      })
    }

    fetchEvents()
    fetchLogs()
  }

  const handleApproveEdit = async (id: string) => {
    setActiveMenuId(null)
    const confirmed = window.confirm("Approve edit request? The client will be able to edit their menu again.")
    if (!confirmed) return
    await supabase.from('events').update({ status: 'draft', quote_status: 'draft' }).eq('id', id)

    const target = (events as any[]).find(e => e.id === id)
    if (target) {
      const adminName = await getCurrentActorName()
      await logActivity({
        actorName: adminName,
        clientName: target.clients?.entity_name || 'Client',
        action: 'Approved Menu Edit',
        districtState: [target.city, target.state].filter(Boolean).join(', ') || 'Karnataka',
        eventStartDate: target.event_date,
        eventCode: target.event_code || 'EVENT',
        details: 'Admin approved menu edit request for client',
      })
    }

    fetchEvents()
    fetchLogs()
  }

  const startEditingNote = (event: any) => { setEditingNoteId(event.id); setNoteText(event.internal_notes || '') }

  const saveNote = async (id: string) => {
    setSavingNote(true)
    await supabase.from('events').update({ internal_notes: noteText }).eq('id', id)
    
    const target = (events as any[]).find(e => e.id === id)
    if (target) {
      const adminName = await getCurrentActorName()
      await logActivity({
        actorName: adminName,
        clientName: target.clients?.entity_name || 'Client',
        action: 'Updated Internal Note',
        districtState: [target.city, target.state].filter(Boolean).join(', ') || 'Karnataka',
        eventStartDate: target.event_date,
        eventCode: target.event_code || 'EVENT',
        details: noteText ? `Note updated: "${noteText}"` : 'Cleared internal notes',
      })
    }
    
    setSavingNote(false)
    setEditingNoteId(null)
    fetchEvents()
    fetchLogs()
  }

  const copyClientLink = (eventId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/client-menu/${eventId}`)
      .then(() => alert("✅ Link Copied!"))
  }

  const dispatchQuote = async (eventId: string) => {
    setActiveMenuId(null)
    const confirmed = window.confirm("Ready to send this quotation email to the client?")
    if (!confirmed) return

    alert("Sending quotation via Resend...")
    try {
      const res = await fetch('/api/send-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId })
      })
      const data = await res.json()
      if (res.ok) {
        alert("✅ " + data.message)
        fetchEvents() // refresh to show potentially updated status
      } else {
        alert("❌ Failed to send: " + data.error)
      }
    } catch (e: any) {
      alert("❌ Error: " + e.message)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: any) => { if (menuRef.current && !menuRef.current.contains(event.target)) setActiveMenuId(null) }
    document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    fetchEvents()
    fetchLogs()

    const handleRealtimeActivity = () => {
      fetchLogs()
      fetchEvents()
    }

    window.addEventListener('activity_logged', handleRealtimeActivity)
    window.addEventListener('quotation_version_saved', handleRealtimeActivity)

    return () => {
      window.removeEventListener('activity_logged', handleRealtimeActivity)
      window.removeEventListener('quotation_version_saved', handleRealtimeActivity)
    }
  }, [])

  // Filtered Activity Logs
  const filteredLogs = useMemo(() => {
    return recentLogs.filter(log => {
      // 1. Category filter
      if (logFilter === 'quotes') {
        const isQuote = log.action.toLowerCase().includes('quote') || log.action.toLowerCase().includes('version') || log.action.toLowerCase().includes('revert')
        if (!isQuote) return false
      } else if (logFilter === 'menus') {
        const isMenu = log.action.toLowerCase().includes('menu')
        if (!isMenu) return false
      } else if (logFilter === 'status') {
        const isStatus = log.action.toLowerCase().includes('accept') || log.action.toLowerCase().includes('reject') || log.action.toLowerCase().includes('cancel') || log.action.toLowerCase().includes('confirm') || log.action.toLowerCase().includes('status')
        if (!isStatus) return false
      }

      // 2. Search query filter
      if (!logSearch.trim()) return true
      const q = logSearch.toLowerCase()
      return (
        (log.actorName && log.actorName.toLowerCase().includes(q)) ||
        (log.clientName && log.clientName.toLowerCase().includes(q)) ||
        (log.action && log.action.toLowerCase().includes(q)) ||
        (log.eventCode && log.eventCode.toLowerCase().includes(q)) ||
        (log.details && log.details.toLowerCase().includes(q)) ||
        (log.districtState && log.districtState.toLowerCase().includes(q))
      )
    })
  }, [recentLogs, logFilter, logSearch])

  // Helper: Relative time formatter
  const getRelativeTime = (timestamp?: string) => {
    if (!timestamp) return ''
    const now = new Date().getTime()
    const time = new Date(timestamp).getTime()
    const diff = Math.floor((now - time) / 1000)

    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return new Date(timestamp).toLocaleDateString('en-GB')
  }

  // Helper: Status Badge Design
  const getStatusBadge = (event: any) => {
    const s = (event.status || 'draft').toLowerCase()

    if (s === 'cancelled') return <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded tracking-wide border border-red-100">● REJECTED</span>
    if (s === 'confirmed') return <span className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black uppercase rounded tracking-wide border border-green-100">● CONFIRMED</span>

    if (event.quote_status === 'edit_requested' || s === 'edit_requested')
      return <span className="px-3 py-1 bg-purple-50 text-purple-600 text-[10px] font-black uppercase rounded tracking-wide border border-purple-100">● EDIT REQUESTED</span>

    if (event.quote_status === 'client_submitted')
      return <span className="px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase rounded tracking-wide border border-orange-100">● CLIENT REQUEST PENDING</span>

    if (s === 'sent') return <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded tracking-wide border border-blue-100">● SENT</span>

    return <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-black uppercase rounded tracking-wide border border-gray-200">● DRAFT</span>
  }

  return (
    <div className="flex h-screen bg-[#F3F4F6] font-sans text-black">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto lg:ml-0">
        {/* Mobile Header Spacer */}
        <div className="h-16 lg:hidden"></div>

        <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6 lg:space-y-8 pb-16">

          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-2">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-black tracking-tight mb-1">Dashboard Overview</h1>
              <p className="text-gray-500 font-bold text-xs lg:text-sm">Welcome back! Here is what's happening.</p>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="w-full lg:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700 transition flex items-center justify-center gap-2">
              <span className="text-xl leading-none">+</span> Create New Event
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Events</p>
              <h2 className="text-4xl font-black text-black">{stats.total}</h2>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Upcoming</p>
              <h2 className="text-4xl font-black text-blue-600">{stats.upcoming}</h2>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Action Required</p>
              <h2 className="text-4xl font-black text-orange-500">{stats.action}</h2>
            </div>
          </div>

          {/* Events List Container */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
            <div className="p-4 lg:p-6 border-b border-gray-100 flex justify-between items-center bg-white">
              <h3 className="text-lg font-black text-black">Recent Events</h3>
              <button onClick={fetchEvents} className="text-xs font-bold text-blue-600 hover:underline uppercase tracking-wide">Refresh</button>
            </div>

            {/* Desktop Table - Hidden on Mobile */}
            <div className="hidden lg:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Event Code</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Client Details</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest w-1/4">Internal Notes</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={5} className="p-12 text-center text-gray-400 font-bold">Loading...</td></tr>
                  ) : events.length === 0 ? (
                    <tr><td colSpan={5} className="p-12 text-center text-gray-400 font-bold">No events found.</td></tr>
                  ) : (
                    events.map((event: any, index: number) => {
                      const isLastItem = index >= events.length - 2 && events.length > 2;
                      return (
                        <tr key={event.id} className="hover:bg-gray-50 transition group relative">
                          <td className="px-6 py-5">
                            <div className="font-bold text-gray-800 text-sm">{event.event_code}</div>
                            <div className="text-[10px] text-gray-400 font-bold mt-1">{new Date(event.event_date).toLocaleDateString('en-GB')}</div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="font-bold text-black text-sm">{event.clients?.entity_name || 'Unknown'}</div>
                            {event.clients?.contact_person && (
                              <div className="text-[10px] text-gray-500 font-medium mt-0.5">{event.clients?.contact_person}</div>
                            )}
                            {([event.venue_name, event.venue_address, event.city].filter(Boolean).length > 0) && (
                              <div className="text-[10px] text-amber-900 font-semibold mt-1 flex items-center gap-1" title={[event.venue_name, event.venue_address, event.city, event.state, event.venue_zipcode ? 'PIN: ' + event.venue_zipcode : ''].filter(Boolean).join(', ')}>
                                <span className="shrink-0">📍</span>
                                <span className="truncate max-w-[220px]">
                                  {[event.venue_name, event.venue_address, event.city, event.venue_zipcode ? 'PIN: ' + event.venue_zipcode : ''].filter(Boolean).join(', ')}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            {editingNoteId === event.id ? (
                              <input
                                autoFocus
                                className="w-full bg-white border border-blue-500 rounded px-2 py-1 text-xs font-bold text-black outline-none shadow-sm"
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                onBlur={() => saveNote(event.id)}
                                onKeyDown={(e) => e.key === 'Enter' && saveNote(event.id)}
                              />
                            ) : (
                              <div onClick={() => startEditingNote(event)} className="cursor-pointer flex items-center gap-2 group/note min-h-[20px]">
                                <span className={`text-xs font-bold truncate max-w-[200px] ${event.internal_notes ? 'text-gray-700' : 'text-gray-300 italic'}`}>
                                  {event.internal_notes || 'Add note...'}
                                </span>
                                <span className="opacity-0 group-hover/note:opacity-100 text-[10px] text-blue-500">✎</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-5">{getStatusBadge(event)}</td>
                          <td className="px-6 py-5 text-right relative">
                            <div className="flex items-center justify-end gap-3">
                              <button onClick={() => copyClientLink(event.id)} className="text-gray-400 hover:text-blue-600 transition" title="Copy Client Link">🔗</button>
                              <Link
                                href={`/client-menu/${event.id}?preview=true`}
                                className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition whitespace-nowrap"
                                title="Preview Menu"
                              >
                                👁️ Preview
                              </Link>
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === event.id ? null : event.id) }}
                                  className={`text-gray-400 hover:text-black transition ${activeMenuId === event.id ? 'text-black' : ''}`}
                                >
                                  ⚙️
                                </button>
                                {activeMenuId === event.id && (
                                  <div
                                    ref={menuRef}
                                    className={`absolute right-0 w-56 bg-white border border-gray-200 shadow-xl rounded-lg z-[9999] overflow-hidden text-left ${isLastItem ? 'bottom-full mb-2 origin-bottom-right' : 'top-8 origin-top-right'}`}
                                  >
                                    <div className="p-2 border-b bg-gray-50 text-[10px] font-black text-gray-400 uppercase">Manage</div>
                                    <Link href={`/client-menu/${event.id}`} target="_blank" className="block px-4 py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 border-b border-gray-50">👁️ Preview Menu</Link>
                                    <Link href={`/quotation/${event.id}?tab=settings`} className="block px-4 py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 border-b border-gray-50">✏️ Edit Details</Link>
                                    <button onClick={() => copyClientLink(event.id)} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 border-b border-gray-50">🔗 Copy Client Link</button>
                                    {(event.quote_status === 'edit_requested' || event.status === 'edit_requested') && (
                                      <button onClick={() => handleApproveEdit(event.id)} className="w-full text-left px-4 py-3 text-xs font-bold text-purple-700 hover:bg-purple-50 border-b border-gray-50">🔓 Approve Edit</button>
                                    )}
                                    <button onClick={() => handleStatusChange(event.id, 'confirmed')} className="w-full text-left px-4 py-3 text-xs font-bold text-green-700 hover:bg-green-50 border-b border-gray-50">✅ Confirm</button>
                                    <button onClick={() => handleStatusChange(event.id, 'cancelled')} className="w-full text-left px-4 py-3 text-xs font-bold text-red-700 hover:bg-red-50">⛔ Cancel</button>
                                  </div>
                                )}
                              </div>
                              <Link href={`/quotation/${event.id}`} className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-800 transition">Open Quote</Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards - Visible on Mobile */}
            <div className="lg:hidden divide-y divide-gray-100">
              {loading ? (
                <div className="p-8 text-center text-gray-400 font-bold">Loading events...</div>
              ) : events.length === 0 ? (
                <div className="p-8 text-center text-gray-400 font-bold">No events found.</div>
              ) : (
                events.map((event: any) => (
                  <div key={event.id} className="p-4 bg-white space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-800 text-sm">{event.clients?.entity_name || 'Unknown Client'}</div>
                        <div className="text-[10px] text-gray-400 font-bold mt-0.5">{event.event_code} • {new Date(event.event_date).toLocaleDateString()}</div>
                        {([event.venue_name, event.venue_address, event.city].filter(Boolean).length > 0) && (
                          <div className="text-[11px] text-amber-900 font-semibold mt-1 flex items-start gap-1">
                            <span className="shrink-0">📍</span>
                            <span>{[event.venue_name, event.venue_address, event.city, event.state, event.venue_zipcode ? 'PIN: ' + event.venue_zipcode : ''].filter(Boolean).join(', ')}</span>
                          </div>
                        )}
                      </div>
                      {getStatusBadge(event)}
                    </div>

                    <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 italic">
                      {event.internal_notes || 'No internal notes.'}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Link href={`/quotation/${event.id}`} className="bg-black text-white py-2 rounded-lg text-xs font-bold text-center">
                        Open Quote
                      </Link>
                      <Link href={`/client-menu/${event.id}?preview=true`} className="bg-blue-50 text-blue-600 py-2 rounded-lg text-xs font-bold text-center border border-blue-100">
                        Preview Menu
                      </Link>
                      <Link href={`/quotation/${event.id}?tab=settings`} className="bg-gray-100 text-gray-600 py-2 rounded-lg text-xs font-bold text-center border border-gray-200">
                        Edit Details
                      </Link>
                      <button onClick={() => copyClientLink(event.id)} className="bg-gray-100 text-gray-600 py-2 rounded-lg text-xs font-bold text-center border border-gray-200">
                        Copy Link
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* APP ACTIVITY & CHANGE LOG SECTION                                         */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header with Title & Controls */}
            <div className="p-5 lg:p-6 border-b border-gray-100 bg-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg">
                    📋
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-black">App Activity & Change Log</h3>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Live
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                      Audit trail of every change, revision, and action across quotes, menus, and events
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={fetchLogs}
                    className="text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition flex items-center gap-1.5"
                    title="Refresh activity logs"
                  >
                    <span>🔄</span> Refresh
                  </button>
                  <Link
                    href="/logs"
                    className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition flex items-center gap-1"
                  >
                    View All Logs →
                  </Link>
                </div>
              </div>

              {/* Filters and Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: 'All Changes' },
                    { id: 'quotes', label: 'Quotes & Versions' },
                    { id: 'menus', label: 'Menu Changes' },
                    { id: 'status', label: 'Status Updates' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setLogFilter(tab.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                        logFilter === tab.id
                          ? 'bg-black text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative sm:w-80">
                  <input
                    type="text"
                    placeholder="Search by who changed it, event, or reason..."
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    className="w-full bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 focus:border-black rounded-lg px-3 py-2 text-xs font-bold text-black outline-none transition"
                  />
                  {logSearch && (
                    <button
                      onClick={() => setLogSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Log Feed Items */}
            {logsLoading ? (
              <div className="p-12 text-center text-gray-400 font-bold text-sm">
                Loading activity logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-bold text-sm space-y-1">
                <p>No activity logs found {logSearch ? `matching "${logSearch}"` : ''}.</p>
                <p className="text-xs text-gray-400 font-normal">Changes made to quotes, events, or menus will automatically be logged here.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[550px] overflow-y-auto">
                {filteredLogs.map((log, idx) => {
                  const matchingEvent = (events as any[]).find(e => e.event_code === log.eventCode)
                  const targetEventId = log.eventId || matchingEvent?.id

                  const isQuoteAction = log.action.toLowerCase().includes('quote') || log.action.toLowerCase().includes('version') || log.action.toLowerCase().includes('revert')
                  const isMenuAction = log.action.toLowerCase().includes('menu')
                  const isPositive = log.action.toLowerCase().includes('accept') || log.action.toLowerCase().includes('confirm')
                  const isNegative = log.action.toLowerCase().includes('reject') || log.action.toLowerCase().includes('cancel')

                  return (
                    <div
                      key={log.id || idx}
                      className="p-4 lg:px-6 hover:bg-gray-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Actor Avatar Pill */}
                        <div className="shrink-0 mt-0.5">
                          {(() => {
                            const raw = log.actorName || 'System'
                            const match = raw.match(/^([^(]+)(?:\s*\(([^)]+)\))?$/)
                            const name = match ? match[1].trim() : raw
                            const email = match && match[2] ? match[2].trim() : ''

                            return (
                              <div className="flex flex-col gap-0.5 items-start">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black bg-blue-50 text-blue-800 border border-blue-200 shadow-xs">
                                  <span>👤</span>
                                  {name}
                                </span>
                                {email && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 max-w-[190px] truncate" title={email}>
                                    <span>✉️</span>
                                    {email}
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                        </div>

                        {/* Event Details and Action */}
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Action Badge */}
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wide border ${
                                isPositive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isNegative
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : isQuoteAction
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : isMenuAction
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {log.action}
                            </span>

                            {/* Client & Event Link */}
                            <span className="text-gray-400 font-normal">•</span>
                            <span className="font-bold text-gray-900 truncate">
                              {log.clientName || 'General'}
                            </span>

                            {log.eventCode && (
                              <>
                                <span className="text-gray-400 font-normal">•</span>
                                {targetEventId ? (
                                  <Link
                                    href={`/quotation/${targetEventId}`}
                                    className="font-mono font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 hover:underline px-1.5 py-0.5 rounded border border-blue-200"
                                    title="Open this quotation"
                                  >
                                    {log.eventCode} ↗
                                  </Link>
                                ) : (
                                  <span className="font-mono font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                                    {log.eventCode}
                                  </span>
                                )}
                              </>
                            )}

                            {log.districtState && (
                              <span className="text-gray-400 text-[11px] font-medium hidden sm:inline">
                                ({log.districtState})
                              </span>
                            )}
                          </div>

                          {/* Reason / Details Highlight */}
                          {log.details && (
                            <div className="bg-gray-50 border border-gray-200/70 rounded-md px-3 py-1.5 text-xs text-gray-700 font-medium mt-1 inline-block max-w-2xl">
                              <span className="font-black text-gray-500 uppercase text-[10px] tracking-wider mr-1.5">
                                Reason / Details:
                              </span>
                              <span>{log.details}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Timestamp & Relative Time */}
                      <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 text-right text-[11px] text-gray-400">
                        <span className="font-bold text-gray-600">{getRelativeTime(log.timestamp)}</span>
                        {log.timestamp && (
                          <span className="text-[10px]">
                            {new Date(log.timestamp).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </main>

      {isModalOpen && <NewEventModal onClose={() => setIsModalOpen(false)} onSuccess={fetchEvents} />}
    </div>
  )
}