'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PortalDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [clientProfile, setClientProfile] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    async function loadDashboard() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/portal/login')
        return
      }

      // Fetch client profile based on auth user
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .single()

      if (clientError || !clientData) {
        console.error("Could not load client profile", clientError)
        setLoading(false)
        return
      }

      setClientProfile(clientData)

      // Fetch events/requests for this client
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false })

      if (eventData) setEvents(eventData)
      setLoading(false)
    }

    loadDashboard()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/portal/login')
  }

  const handleRequestEdit = async (eventId: string) => {
    const { error } = await supabase
      .from('events')
      .update({ quote_status: 'edit_requested', status: 'edit_requested' })
      .eq('id', eventId)

    if (!error) {
      setEvents(events.map(e => e.id === eventId ? { ...e, quote_status: 'edit_requested', status: 'edit_requested' } : e))
      alert('Edit request sent successfully. Admin will review your request.')
    } else {
      alert('Failed to send edit request.')
      console.error(error)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6] text-gray-400 font-bold">Loading your dashboard...</div>
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] font-sans text-black">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-black text-xl tracking-tight">Client Portal</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-gray-600 hidden md:inline">{clientProfile?.entity_name}</span>
            <button onClick={handleLogout} className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight">Your Requests</h2>
            <p className="text-sm text-gray-500 font-medium mt-1">Manage your event quotation requests</p>
          </div>
          <Link 
            href="/portal/new-request" 
            className="w-full md:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            <span className="text-xl leading-none">+</span> New Request
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-xl font-black mb-2">No requests yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">You haven't submitted any quotation requests. Click the button above to get started.</p>
            <Link 
              href="/portal/new-request" 
              className="inline-block bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition"
            >
              Start New Request
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Provisional Event Code</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date & Size</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-5">
                      <div className="font-bold text-gray-800 text-sm">{event.event_code}</div>
                      <div className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{event.event_type || 'Event'}</div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-black text-sm">{new Date(event.event_date).toLocaleDateString('en-GB')}</div>
                      <div className="text-[10px] text-gray-400 font-medium mt-1">{event.pax_count} Pax</div>
                    </td>
                    <td className="px-6 py-5">
                      {event.status === 'draft' && event.quote_status !== 'edit_requested' && <span className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-black uppercase rounded tracking-wide border border-gray-200">Draft</span>}
                      {(event.status === 'pending_admin_approval' || (event.quote_status === 'client_submitted' && event.status !== 'edit_requested')) && <span className="px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase rounded tracking-wide border border-orange-100">Reviewing</span>}
                      {event.status === 'sent' && <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded tracking-wide border border-blue-100">Quote Ready</span>}
                      {event.status === 'confirmed' && <span className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black uppercase rounded tracking-wide border border-green-100">Confirmed</span>}
                      {event.status === 'cancelled' && <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded tracking-wide border border-red-100">Cancelled</span>}
                      {(event.status === 'edit_requested' || event.quote_status === 'edit_requested') && <span className="px-3 py-1 bg-purple-50 text-purple-600 text-[10px] font-black uppercase rounded tracking-wide border border-purple-100">Edit Requested</span>}
                    </td>
                    <td className="px-6 py-5 text-right">
                        <div className="relative inline-block text-left group">
                          <button className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-full transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                          </button>
                          
                          <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 flex flex-col overflow-hidden">
                            
                            <div className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100">
                              Menu
                            </div>
                            <Link 
                              href={`/client-menu/${event.id}?preview=true`} 
                              className="px-4 py-3 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-black transition"
                            >
                              📄 View / Download Menu
                            </Link>

                            {(event.quote_status === 'edit_requested' || event.status === 'edit_requested') ? (
                              <button disabled className="px-4 py-3 text-xs font-bold text-left text-purple-400 bg-purple-50/50 cursor-not-allowed border-t border-gray-100">
                                ⏳ Edit Requested
                              </button>
                            ) : (event.quote_status === 'client_submitted' || event.status === 'pending_admin_approval' || event.status === 'sent') ? (
                              <button 
                                onClick={() => handleRequestEdit(event.id)}
                                className="px-4 py-3 text-xs font-bold text-left text-orange-600 hover:bg-orange-50 transition border-t border-gray-100"
                              >
                                ✏️ Request Edit
                              </button>
                            ) : (
                              <Link 
                                href={`/client-menu/${event.id}`} 
                                className="px-4 py-3 text-xs font-bold text-blue-600 hover:bg-blue-50 transition border-t border-gray-100"
                              >
                                ✏️ Edit Selection
                              </Link>
                            )}

                            {/* Quotation Downloads */}
                            {(event.status === 'sent' || event.status === 'confirmed') && (
                              <>
                                <div className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 border-y border-gray-100">
                                  Quotation
                                </div>
                                <button
                                  onClick={() => window.open(`/quotation/${event.id}?client_preview=true`, '_blank')}
                                  className="px-4 py-3 text-xs font-bold text-left text-gray-700 hover:bg-gray-50 hover:text-black transition"
                                >
                                  📥 Download Quotation
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
