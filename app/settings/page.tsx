'use client'
import { useEffect, useState, FormEvent } from 'react'
import { supabase } from '@/app/lib/supabase'
import AppSidebar from '@/app/components/AppSidebar'
import { useRouter } from 'next/navigation'

type Permissions = {
  dashboard: boolean
  calendar: boolean
  clients: boolean
  quotations: boolean
  menu: boolean
  settings: boolean
}

type UserProfile = {
  id: string
  email: string
  full_name: string
  assigned_password?: string
  permissions: Permissions
}

const defaultPermissions: Permissions = {
  dashboard: false,
  calendar: false,
  clients: false,
  quotations: false,
  menu: false,
  settings: false
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('general')
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  // App Settings Fields
  const [reminderDays, setReminderDays] = useState(2)
  const [adminEmail, setAdminEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [defaultTandC, setDefaultTandC] = useState('')
  const [defaultValidity, setDefaultValidity] = useState(14)

  // User Management Fields
  const [users, setUsers] = useState<UserProfile[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  // Modal Form State
  const [modalEmail, setModalEmail] = useState('')
  const [modalPassword, setModalPassword] = useState('')
  const [modalName, setModalName] = useState('')
  const [modalPermissions, setModalPermissions] = useState<Permissions>(defaultPermissions)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function init() {
      // Get auth token for API calls
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessionToken(session.access_token)
      } else {
        router.push('/login')
        return
      }

      // Fetch settings
      const { data: s } = await supabase.from('app_settings').select('*').single()
      if (s) {
        setReminderDays(s.reminder_days || 2)
        setAdminEmail(s.admin_email || '')
        setCompanyName(s.company_name || '')
        setCompanyPhone(s.company_phone || '')
        setCompanyAddress(s.company_address || '')
        setDefaultTandC(s.default_t_and_c || '')
        setDefaultValidity(s.default_validity_days || 14)
      }

      // Fetch users
      fetchUsers()
      setLoading(false)
    }
    init()
  }, [])

  async function fetchUsers() {
    // Get token natively every time since the state might not be instantly available on first load
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    try {
      const res = await fetch('/api/users/list', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const data = await res.json()
      if (data.users) {
        setUsers(data.users)
      } else {
        console.error("Failed to fetch users:", data.error)
      }
    } catch (err) {
      console.error("Network error fetching users:", err)
    }
  }

  async function saveSettings() {
    await supabase.from('app_settings').upsert({
      id: 1,
      reminder_days: reminderDays,
      admin_email: adminEmail,
      company_name: companyName,
      company_phone: companyPhone,
      company_address: companyAddress,
      default_t_and_c: defaultTandC,
      default_validity_days: defaultValidity
    });
    alert("Settings Saved Successfully")
  }

  function openNewUserModal() {
    setEditingUserId(null)
    setModalEmail('')
    setModalPassword('')
    setModalName('')
    setModalPermissions({ ...defaultPermissions })
    setIsModalOpen(true)
  }

  function openEditUserModal(user: UserProfile) {
    setEditingUserId(user.id)
    setModalEmail(user.email)
    setModalPassword(user.assigned_password || '')
    setModalName(user.full_name)
    setModalPermissions(user.permissions || { ...defaultPermissions })
    setIsModalOpen(true)
  }

  async function handleUserSubmit(e: FormEvent) {
    e.preventDefault()
    if (!sessionToken) return
    setIsSubmitting(true)

    const payload = {
      email: modalEmail,
      password: modalPassword,
      fullName: modalName,
      permissions: modalPermissions,
      ...(editingUserId && { userId: editingUserId }) // Attach ID if editing
    }

    const endpoint = editingUserId ? '/api/users/update' : '/api/users/create'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to process request')

      await fetchUsers()
      setIsModalOpen(false)
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function deleteUser(id: string) {
    if (!confirm("Are you sure you want to permanently delete this user?")) return
    if (!sessionToken) return

    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ userId: id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')

      await fetchUsers()
    } catch (err: any) {
      alert("Error deleting user: " + err.message)
    }
  }

  function copyCredentials(user: UserProfile) {
    const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://yourdomain.com/login'
    const text = `Hi ${user.full_name},\n\nYour employee account has been created for The Rameshwaram Cafe.\n\nDashboard: ${loginUrl}\nEmail: ${user.email}\nPassword: ${user.assigned_password || '[Hidden - Please set via Forgot Password]'}\n\nPlease keep these credentials secure.`
    navigator.clipboard.writeText(text)
    alert('Login credentials copied to clipboard! You can now paste this into WhatsApp or Email.')
  }

  if (loading) return null

  return (
    <div className="flex h-screen bg-[#F3F4F6] font-sans overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto relative p-8 lg:p-12">
        {/* Mobile Header Spacer */}
        <div className="h-16 lg:hidden"></div>

        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-8">Settings & Access</h1>

        <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit mb-8">
          {['general', 'users'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2.5 rounded-lg text-sm font-bold capitalize transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}>
              {tab === 'users' ? 'User Management' : 'General Configuration'}
            </button>
          ))}
        </div>

        {activeTab === 'general' ? (
          <div className="max-w-4xl space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Company Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Company Name</label><input className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={companyName} onChange={e => setCompanyName(e.target.value)} /></div>
                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Support Phone</label><input className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} /></div>
                <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Registered Address</label><textarea rows={2} className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} /></div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Quotation Defaults</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Default Validity (Days)</label><input type="number" min="1" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={defaultValidity} onChange={e => setDefaultValidity(Math.max(1, parseInt(e.target.value) || 1))} /></div>
                <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Default Terms & Conditions</label><textarea rows={4} className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={defaultTandC} onChange={e => setDefaultTandC(e.target.value)} placeholder="These terms will automatically populate new quotations..." /></div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Automation Preferences</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Event Reminder (Days Before)</label><input type="number" min="0" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={reminderDays} onChange={e => setReminderDays(Math.max(0, parseInt(e.target.value) || 0))} /></div>
                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Admin Email</label><input className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} /></div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={saveSettings} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition">Save Changes</button>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-slate-900">Registered Users</h2>
              <button onClick={openNewUserModal} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold shadow hover:bg-slate-800 transition">
                + Add User
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                  <tr>
                    <th className="p-5">Name</th>
                    <th className="p-5">Email</th>
                    <th className="p-5">Password</th>
                    <th className="p-5 line-clamp-1 truncate">Permissions</th>
                    <th className="p-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map(u => {
                    const activePermsCount = Object.values(u.permissions || {}).filter(Boolean).length
                    const totalPerms = Object.keys(u.permissions || {}).length

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-5 font-bold text-slate-800">{u.full_name}</td>
                        <td className="p-5 font-medium text-slate-600">{u.email}</td>
                        <td className="p-5 font-mono text-xs text-slate-500">{u.assigned_password || '••••••••'}</td>
                        <td className="p-5">
                          <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg ${u.permissions?.settings ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {u.permissions?.settings ? 'Admin' : `${activePermsCount}/${totalPerms} Modules`}
                          </span>
                        </td>
                        <td className="p-5 text-right flex items-center justify-end gap-3">
                          <button onClick={() => copyCredentials(u)} className="text-sm font-bold text-emerald-600 hover:text-emerald-800 transition px-2 py-1 bg-emerald-50 rounded hover:bg-emerald-100 mr-2">Share</button>
                          <button onClick={() => openEditUserModal(u)} className="text-sm font-bold text-blue-600 hover:text-blue-800 transition">Edit</button>
                          <button onClick={() => deleteUser(u.id)} className="text-sm font-bold text-red-500 hover:text-red-700 transition">Revoke</button>
                        </td>
                      </tr>
                    )
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-500 font-medium">No users found. Please refresh or check database.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* User Management Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-[95vw] sm:w-full max-w-lg overflow-y-auto max-h-[90vh] relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-extrabold text-slate-800">{editingUserId ? 'Edit User & Permissions' : 'Create New User'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2">✕</button>
            </div>

            <form onSubmit={handleUserSubmit} className="p-4 sm:p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Full Name</label>
                  <input
                    required type="text"
                    className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    value={modalName} onChange={e => setModalName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Email Address</label>
                  <input
                    required type="email"
                    className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    value={modalEmail} onChange={e => setModalEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Assigned Password</label>
                  <input
                    required={!editingUserId} type="text"
                    className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-mono text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    value={modalPassword} onChange={e => setModalPassword(e.target.value)}
                    placeholder="Enter a secure password..."
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-3 ml-1">Module Access (Tick to Allow)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.keys(defaultPermissions).map((key) => (
                    <label key={key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${modalPermissions[key as keyof Permissions] ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        checked={modalPermissions[key as keyof Permissions]}
                        onChange={(e) => setModalPermissions({
                          ...modalPermissions,
                          [key]: e.target.checked
                        })}
                      />
                      <span className={`text-sm font-bold capitalize ${modalPermissions[key as keyof Permissions] ? 'text-blue-900' : 'text-slate-600'}`}>{key}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-3 ml-1">Note: Granting 'Settings' access effectively makes this user an Administrator who can also add/remove other users.</p>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting ? 'Processing...' : (editingUserId ? 'Save Changes' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}