'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Client } from '@/app/types'
import { useRouter } from 'next/navigation'
import AppSidebar from '@/app/components/AppSidebar'
import { INDIAN_STATES } from '@/app/lib/locations'
import ClientPrintModal from './ClientPrintModal'

export default function ClientManagerPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)

  useEffect(() => { fetchClients() }, [])
  async function fetchClients() {
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

    const { data } = await supabase.from('clients').select('*').order('entity_name'); 
    if (data) setClients(data as any); 
    setLoading(false) 
  }
  async function updateClient() {
    if (!editingClient) return;
    if (!editingClient.contact_person || editingClient.contact_person.trim() === '') {
      return alert("Contact Person is a mandatory field and cannot be empty.")
    }
    if (editingClient.gst_number && editingClient.gst_number.length !== 15) {
      return alert("GST Number must be exactly 15 characters, or left empty.")
    }
    await supabase.from('clients').update({ ...editingClient }).eq('id', editingClient.id);
    setEditingClient(null);
    fetchClients()
  }
  const filtered = clients.filter(c => (c.entity_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (c.contact_person || '').toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="flex h-screen bg-[#F3F4F6] font-sans overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto relative p-4 sm:p-6 lg:p-12">
        {/* Mobile Header Spacer */}
        <div className="h-16 lg:hidden"></div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Client Directory</h1>
            <p className="text-slate-500 mt-1 sm:mt-2 text-xs sm:text-sm font-medium">Manage client database and billing details.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-4 py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black rounded-xl font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
            >
              <span>🖨️</span> Print / Export
            </button>
            <div className="relative w-full sm:w-72">
              <input
                className="w-full border border-slate-200 bg-white p-3 pl-10 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition text-xs sm:text-sm font-medium"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <span className="absolute left-3.5 top-3 text-slate-400">🔍</span>
            </div>
          </div>
        </div>

        {/* Desktop Table (Hidden on Mobile/Tablet < lg; 100% untouched for Desktop lg:) */}
        <div className="hidden lg:block bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-8 py-5">Entity</th>
                  <th className="px-8 py-5">Contact</th>
                  <th className="px-8 py-5">Contact Details</th>
                  <th className="px-8 py-5">GSTIN</th>
                  <th className="px-8 py-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(client => (
                  <tr key={client.id} className="hover:bg-slate-50/80 transition duration-150">
                    <td className="px-8 py-5 font-bold text-slate-800">{client.entity_name}</td>
                    <td className="px-8 py-5 text-slate-600 font-medium">{client.contact_person}</td>
                    <td className="px-8 py-5">
                      <div className="text-sm text-slate-500 space-y-1">
                        <p>📞 {client.mobile}</p>
                        <p>✉️ {client.email}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5 font-mono text-xs text-slate-400">{client.gst_number || '—'}</td>
                    <td className="px-8 py-5 text-right">
                      <button onClick={() => setEditingClient(client)} className="text-blue-600 font-bold hover:bg-blue-50 px-4 py-2 rounded-lg transition text-sm cursor-pointer">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile & Tablet Cards (< lg) */}
        <div className="lg:hidden space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-400 font-bold bg-white rounded-2xl border border-slate-200">
              Loading clients...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-bold bg-white rounded-2xl border border-slate-200">
              No clients found matching "{searchTerm}".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(client => (
                <div key={client.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-base text-slate-900 leading-snug">
                          {client.entity_name}
                        </h3>
                        <p className="text-xs font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>👤</span> {client.contact_person}
                        </p>
                      </div>
                      {client.gst_number && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-600 border border-slate-200 shrink-0">
                          {client.gst_number}
                        </span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      {client.mobile && (
                        <a href={`tel:${client.mobile}`} className="flex items-center gap-1 hover:text-blue-600 transition font-medium">
                          <span>📞</span> {client.mobile}
                        </a>
                      )}
                      {client.email && (
                        <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-blue-600 transition font-medium truncate max-w-[200px]">
                          <span>✉️</span> {client.email}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => setEditingClient(client)}
                      className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-blue-50 text-blue-700 font-bold text-xs rounded-lg transition border border-slate-200 text-center cursor-pointer"
                    >
                      ✏️ Edit Client Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit Modal (Styled for all screen sizes) */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Edit Client Details</h2>
              <button onClick={() => setEditingClient(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 overflow-y-auto pr-1 flex-1">
              {['entity_name', 'contact_person', 'mobile', 'email', 'gst_number', 'city', 'state', 'address'].map(field => (
                <div key={field} className={field === 'address' || field === 'entity_name' ? 'md:col-span-2' : ''}>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{field.replace('_', ' ')}</label>
                  {field === 'address' ? (
                    <textarea
                      className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition text-sm font-medium"
                      rows={3}
                      value={(editingClient as any)[field] || ''}
                      onChange={e => setEditingClient({ ...editingClient, [field]: e.target.value })}
                    />
                  ) : field === 'gst_number' ? (
                    <div className="relative">
                      <input
                        className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition text-sm font-medium"
                        value={(editingClient as any)[field] || ''}
                        placeholder="15 Character GSTIN"
                        maxLength={15}
                        onChange={e => {
                          const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
                          setEditingClient({ ...editingClient, [field]: val })
                        }}
                      />
                      {editingClient.gst_number && editingClient.gst_number.length > 0 && (
                        <span className="absolute right-4 top-3.5 text-xs font-bold text-gray-400">
                          {editingClient.gst_number.length}/15
                        </span>
                      )}
                    </div>
                  ) : field === 'state' ? (
                    <select
                      className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition text-sm font-medium"
                      value={(editingClient as any)[field] || ''}
                      onChange={e => setEditingClient({ ...editingClient, state: e.target.value, city: '' })}
                    >
                      <option value="">Select State</option>
                      {Object.keys(INDIAN_STATES).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : field === 'city' ? (
                    <select
                      className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition text-sm font-medium"
                      value={(editingClient as any)[field] || ''}
                      onChange={e => setEditingClient({ ...editingClient, city: e.target.value })}
                      disabled={!editingClient.state}
                    >
                      <option value="">Select City</option>
                      {editingClient.state && INDIAN_STATES[editingClient.state]?.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition text-sm font-medium"
                      value={(editingClient as any)[field] || ''}
                      onChange={e => setEditingClient({ ...editingClient, [field]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setEditingClient(null)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition">Cancel</button>
              <button onClick={updateClient} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Client Master Print / Excel Export Modal */}
      <ClientPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        allClients={clients}
        filteredClients={filtered}
        searchTerm={searchTerm}
      />
    </div>
  )
}