'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Client } from '@/app/types'
import AppSidebar from '@/app/components/AppSidebar'
import { INDIAN_STATES } from '@/app/lib/locations'

export default function ClientManagerPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => { fetchClients() }, [])
  async function fetchClients() { const { data } = await supabase.from('clients').select('*').order('entity_name'); if (data) setClients(data as any); setLoading(false) }
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
      <main className="flex-1 overflow-y-auto relative p-8 lg:p-12">
        {/* Mobile Header Spacer */}
        <div className="h-16 lg:hidden"></div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div><h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Client Directory</h1><p className="text-slate-500 mt-2 text-sm font-medium">Manage client database and billing details.</p></div>
          <div className="relative w-full max-w-sm"><input className="w-full border border-slate-200 bg-white p-3.5 pl-11 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition text-sm font-medium" placeholder="Search clients..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /><span className="absolute left-4 top-3.5 text-slate-400">🔍</span></div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr><th className="px-8 py-5">Entity</th><th className="px-8 py-5">Contact</th><th className="px-8 py-5">Contact Details</th><th className="px-8 py-5">GSTIN</th><th className="px-8 py-5 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(client => (
                  <tr key={client.id} className="hover:bg-slate-50/80 transition duration-150">
                    <td className="px-8 py-5 font-bold text-slate-800">{client.entity_name}</td>
                    <td className="px-8 py-5 text-slate-600 font-medium">{client.contact_person}</td>
                    <td className="px-8 py-5"><div className="text-sm text-slate-500 space-y-1"><p>📞 {client.mobile}</p><p>✉️ {client.email}</p></div></td>
                    <td className="px-8 py-5 font-mono text-xs text-slate-400">{client.gst_number || '—'}</td>
                    <td className="px-8 py-5 text-right"><button onClick={() => setEditingClient(client)} className="text-blue-600 font-bold hover:bg-blue-50 px-4 py-2 rounded-lg transition text-sm">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Edit Modal (Styled) */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Edit Client Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
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
    </div>
  )
}