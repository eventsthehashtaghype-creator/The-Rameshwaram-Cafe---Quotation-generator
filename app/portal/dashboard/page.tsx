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
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Event Code</th>
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
                      {event.status === 'draft' && <span className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-black uppercase rounded tracking-wide border border-gray-200">Draft</span>}
                      {event.status === 'pending_admin_approval' && <span className="px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase rounded tracking-wide border border-orange-100">Reviewing</span>}
                      {event.status === 'sent' && <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded tracking-wide border border-blue-100">Quote Ready</span>}
                      {event.status === 'confirmed' && <span className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black uppercase rounded tracking-wide border border-green-100">Confirmed</span>}
                      {event.status === 'cancelled' && <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded tracking-wide border border-red-100">Cancelled</span>}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link 
                        href={`/portal/request/${event.id}`} 
                        className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
