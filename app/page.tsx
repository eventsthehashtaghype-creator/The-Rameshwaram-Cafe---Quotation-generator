'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/app/lib/supabase'
import AppSidebar from './components/AppSidebar'
import NewEventModal from './components/NewEventModal'
import Link from 'next/link'

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

  // --- LOGIC ---
  async function fetchEvents() {
    setLoading(true)
    const { data } = await supabase.from('events').select(`*, clients(entity_name, contact_person)`).order('created_at', { ascending: false })
    if (data) { setEvents(data as any); calculateStats(data) }
    setLoading(false)
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
    if (newStatus === 'cancelled' && !window.confirm("Are you sure?")) return
    await supabase.from('events').update({ status: newStatus }).eq('id', id)
    fetchEvents()
  }

  const startEditingNote = (event: any) => { setEditingNoteId(event.id); setNoteText(event.internal_notes || '') }

  const saveNote = async (id: string) => {
    setSavingNote(true)
    await supabase.from('events').update({ internal_notes: noteText }).eq('id', id)
    setSavingNote(false); setEditingNoteId(null); fetchEvents()
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

  useEffect(() => { fetchEvents() }, [])

  // Helper: Status Badge Design
  const getStatusBadge = (event: any) => {
    const s = (event.status || 'draft').toLowerCase()

    if (s === 'cancelled') return <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded tracking-wide border border-red-100">● CANCELLED</span>
    if (s === 'confirmed') return <span className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black uppercase rounded tracking-wide border border-green-100">● CONFIRMED</span>

    if (event.quote_status === 'client_submitted')
      return <span className="px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase rounded tracking-wide border border-orange-100">● UPDATE RECVD</span>

    if (s === 'sent') return <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded tracking-wide border border-blue-100">● SENT</span>

    return <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-black uppercase rounded tracking-wide border border-gray-200">● DRAFT</span>
  }

  return (
    <div className="flex h-screen bg-[#F3F4F6] font-sans text-black">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto lg:ml-0">
        {/* Mobile Header Spacer */}
        <div className="h-16 lg:hidden"></div>

        <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6 lg:space-y-8">

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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
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
                            <div className="text-[10px] text-gray-400 font-medium mt-1">{event.clients?.contact_person}</div>
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
                                    <button onClick={() => handleStatusChange(event.id, 'confirmed')} className="w-full text-left px-4 py-3 text-xs font-bold text-green-700 hover:bg-green-50">✅ Confirm</button>
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
                      </div>
                      {getStatusBadge(event)}
                    </div>

                    {/* Internal Note (Mobile) */}
                    <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 italic">
                      {event.internal_notes || 'No internal notes.'}
                    </div>

                    {/* Actions Grid */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Link href={`/quotation/${event.id}`} className="bg-black text-white py-2 rounded-lg text-xs font-bold text-center">
                        Open Quote
                      </Link>
                      <Link href={`/client-menu/${event.id}?preview=true`} className="bg-blue-50 text-blue-600 py-2 rounded-lg text-xs font-bold text-center border border-blue-100">
                        Preview Menu
                      </Link>
                      <Link href={`/quotation/${event.id}?tab=settings`} className="bg-gray-100 text-gray-600 py-2 rounded-lg text-xs font-bold text-center border border-gray-200">
                        Settings
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
        </div>
      </main>

      {isModalOpen && <NewEventModal onClose={() => setIsModalOpen(false)} onSuccess={fetchEvents} />}
    </div>
  )
}
// Final Vercel Trigger Jan 19