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

  // Financial Details Fields
  const [bankName, setBankName] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [bankAccountNo, setBankAccountNo] = useState('')
  const [bankIfsc, setBankIfsc] = useState('')
  const [bankBranch, setBankBranch] = useState('')

  // Email & WhatsApp Pending Activities Reminders Fields
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [whatsappWebhookUrl, setWhatsappWebhookUrl] = useState('')
  const [enableEmailReminders, setEnableEmailReminders] = useState(true)
  const [enableWhatsappReminders, setEnableWhatsappReminders] = useState(true)

  // Interactive Reminder Runner State
  const [isRunningReminders, setIsRunningReminders] = useState(false)
  const [reminderResult, setReminderResult] = useState<any>(null)
  const [copiedWaMessage, setCopiedWaMessage] = useState(false)

  // State for Global Save bar
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

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
        // Role Check
        const { data: clientUser } = await supabase.from('clients').select('id').eq('auth_user_id', session.user.id).single()
        if (clientUser) {
          router.replace('/portal/dashboard')
          return
        }
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

        // Load Financial Details
        setBankName(s.bank_name || '')
        setBankAccountName(s.bank_account_name || '')
        setBankAccountNo(s.bank_account_no || '')
        setBankIfsc(s.bank_ifsc || '')
        setBankBranch(s.bank_branch || '')

        // Load WhatsApp & Reminders Settings
        setWhatsappPhone(s.whatsapp_phone || '')
        setWhatsappWebhookUrl(s.whatsapp_webhook_url || '')
        setEnableEmailReminders(s.enable_email_reminders !== false)
        setEnableWhatsappReminders(s.enable_whatsapp_reminders !== false)
      }

      // Fetch users
      fetchUsers()
      setLoading(false)
    }
    init()
  }, [])

  // UNSAVED CHANGES GUARD
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

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
    setSaving(true)
    await supabase.from('app_settings').upsert({
      id: 1,
      reminder_days: reminderDays,
      admin_email: adminEmail,
      company_name: companyName,
      company_phone: companyPhone,
      company_address: companyAddress,
      default_t_and_c: defaultTandC,
      default_validity_days: defaultValidity,
      bank_name: bankName,
      bank_account_name: bankAccountName,
      bank_account_no: bankAccountNo,
      bank_ifsc: bankIfsc,
      bank_branch: bankBranch,
      whatsapp_phone: whatsappPhone,
      whatsapp_webhook_url: whatsappWebhookUrl,
      enable_email_reminders: enableEmailReminders,
      enable_whatsapp_reminders: enableWhatsappReminders
    });
    setSaving(false)
    setHasUnsavedChanges(false)
    alert("Settings Saved Successfully")
  }

  async function runPendingActivitiesReminders() {
    setIsRunningReminders(true)
    setReminderResult(null)
    try {
      const res = await fetch('/api/cron/reminders', { method: 'POST' })
      const data = await res.json()
      setReminderResult(data)
    } catch (err: any) {
      alert("Error triggering reminders: " + err.message)
    } finally {
      setIsRunningReminders(false)
    }
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

        <div className="flex flex-wrap gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit mb-8">
          {[
            { id: 'general', label: 'General Configuration' },
            { id: 'reminders', label: 'Reminders (Email & WhatsApp)' },
            { id: 'users', label: 'User Management' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab.id ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'general' && (
          <div className="max-w-4xl space-y-8 pb-32">

            {/* COMPANY PROFILE */}
            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-blue-500">🏢</span> Company Identity
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Company Name</label>
                  <input className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" value={companyName} onChange={e => { setCompanyName(e.target.value); setHasUnsavedChanges(true); }} placeholder="e.g. The Rameshwaram Cafe" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Support Phone / Contact</label>
                  <input className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" value={companyPhone} onChange={e => { setCompanyPhone(e.target.value); setHasUnsavedChanges(true); }} placeholder="e.g. +91 99999 99999" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Registered Address</label>
                  <textarea rows={2} className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" value={companyAddress} onChange={e => { setCompanyAddress(e.target.value); setHasUnsavedChanges(true); }} placeholder="Full registered address of the venue..." />
                </div>
              </div>
            </div>

            {/* FINANCIAL DETAILS */}
            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-emerald-500">🏦</span> Financial & Bank Details
              </h2>
              <p className="text-xs font-bold text-slate-500 mb-6">These details are dynamically injected into PDF and Word Document Quotations.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Account Name (Beneficiary)</label>
                  <input className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" value={bankAccountName} onChange={e => { setBankAccountName(e.target.value); setHasUnsavedChanges(true); }} placeholder="e.g. THE RAMESHWARAM CAFE" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Bank Name</label>
                  <input className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" value={bankName} onChange={e => { setBankName(e.target.value); setHasUnsavedChanges(true); }} placeholder="e.g. HDFC BANK LTD" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Account Number</label>
                  <input className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-mono text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" value={bankAccountNo} onChange={e => { setBankAccountNo(e.target.value); setHasUnsavedChanges(true); }} placeholder="Account No" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">IFSC Code</label>
                  <input className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-mono uppercase text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" value={bankIfsc} onChange={e => { setBankIfsc(e.target.value.toUpperCase()); setHasUnsavedChanges(true); }} placeholder="IFSC Code" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Branch</label>
                  <input className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" value={bankBranch} onChange={e => { setBankBranch(e.target.value); setHasUnsavedChanges(true); }} placeholder="Branch Name" />
                </div>
              </div>
            </div>

            {/* QUOTATION DEFAULTS */}
            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-purple-500">📄</span> Quotation Defaults
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Default Validity (Days)</label>
                  <input type="number" min="1" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" value={defaultValidity} onChange={e => { setDefaultValidity(Math.max(1, parseInt(e.target.value) || 1)); setHasUnsavedChanges(true); }} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Default Terms & Conditions</label>
                  <textarea rows={4} className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" value={defaultTandC} onChange={e => { setDefaultTandC(e.target.value); setHasUnsavedChanges(true); }} placeholder="These terms will automatically populate new quotations..." />
                </div>
              </div>
            </div>

            {/* AUTOMATION PREFERENCES */}
            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-amber-500">⚙️</span> Automation Preferences
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Event Reminder (Days Before)</label>
                  <input type="number" min="0" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" value={reminderDays} onChange={e => { setReminderDays(Math.max(0, parseInt(e.target.value) || 0)); setHasUnsavedChanges(true); }} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Admin Email</label>
                  <input className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" value={adminEmail} onChange={e => { setAdminEmail(e.target.value); setHasUnsavedChanges(true); }} />
                </div>
              </div>
            </div>

            {/* FLOATING SAVE BAR */}
            {hasUnsavedChanges && (
              <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-yellow-400 text-black p-4 z-50 flex flex-col sm:flex-row justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom-full duration-300">
                <div className="font-black mb-3 sm:mb-0 text-sm sm:text-base flex items-center gap-2">
                  <span>⚠️</span> You have unsaved changes to your general configuration!
                </div>
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="w-full sm:w-auto bg-black text-white px-8 py-3 rounded-xl font-black uppercase tracking-wider hover:bg-gray-800 transition shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* EMAIL & WHATSAPP INTEGRATION (PENDING ACTIVITIES REMINDERS EVERY 3 DAYS) */}
        {/* ========================================================================= */}
        {activeTab === 'reminders' && (
          <div className="max-w-4xl space-y-8 pb-32">
            {/* OVERVIEW BANNER */}
            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🔔</span>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      5. Email & WhatsApp Integration (Pending Activities)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Automated digest dispatched every <strong>3 days</strong> to remind stakeholders of pending tasks and events.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Cycle: Every 3 Days
                  </span>
                </div>
              </div>

              {/* 5 RULES SPECIFICATION CARDS */}
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  The 5 Active Reminder Rules
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Rule A */}
                  <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black text-blue-900">&gt;&gt; A. Upcoming Event notification</span>
                        <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          Every week
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        Alerts team about confirmed and active events taking place within the next 7 days.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-bold text-blue-700 flex items-center gap-1">
                      <span>📅</span> Next 7 days horizon
                    </div>
                  </div>

                  {/* Rule B */}
                  <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black text-amber-900">&gt;&gt; B. New Requests</span>
                        <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                          Every day
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        Daily notification for events pending admin review or submitted by client.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-bold text-amber-700 flex items-center gap-1">
                      <span>⚡</span> Status: Pending Approval / Submitted
                    </div>
                  </div>

                  {/* Rule C */}
                  <div className="p-4 rounded-xl border border-red-100 bg-red-50/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black text-red-900">&gt;&gt; C. Rejected Event</span>
                        <span className="text-[10px] font-black uppercase bg-red-100 text-red-800 px-2 py-0.5 rounded">
                          Every week
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        Weekly summary of rejected / cancelled events for management tracking.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-bold text-red-700 flex items-center gap-1">
                      <span>❌</span> Status: Cancelled
                    </div>
                  </div>

                  {/* Rule D */}
                  <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black text-purple-900">&gt;&gt; D. Menu Locking</span>
                        <span className="text-[10px] font-black uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                          &le; 4 Days Before
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        Urgent reminder if client or admin has NOT locked the food menu 4 days prior to event.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-bold text-purple-700 flex items-center gap-1">
                      <span>🔒</span> Trigger: Menu unlocked &amp; Date &le; 4 days
                    </div>
                  </div>

                  {/* Rule E */}
                  <div className="md:col-span-2 p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black text-indigo-900">&gt;&gt; E. Quotation Locking</span>
                        <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                          &le; 4 Days Before
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        Urgent reminder if quotation has NOT been submitted / locked by admin 4 days prior to event.
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-bold text-indigo-700 flex items-center gap-1">
                      <span>📝</span> Trigger: Quote not locked/sent &amp; Date &le; 4 days
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CHANNELS CONFIGURATION CARD */}
            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-blue-500">📲</span> Notification Recipients &amp; Channels
              </h3>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* WhatsApp Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      WhatsApp Phone Number (with Country Code)
                    </label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                      value={whatsappPhone}
                      onChange={e => { setWhatsappPhone(e.target.value); setHasUnsavedChanges(true); }}
                      placeholder="e.g. +91 99999 99999 or 919876543210"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Recipient phone number to receive WhatsApp reminders and 1-click dispatch.</p>
                  </div>

                  {/* Admin Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      Admin Email for Activity Digest
                    </label>
                    <input
                      type="email"
                      className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                      value={adminEmail}
                      onChange={e => { setAdminEmail(e.target.value); setHasUnsavedChanges(true); }}
                      placeholder="e.g. admin@therameshwaramcafe.org"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Receives automated HTML email digest with event details.</p>
                  </div>

                  {/* WhatsApp Webhook URL */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      WhatsApp Webhook URL (Optional for Automated APIs)
                    </label>
                    <input
                      type="url"
                      className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-mono text-xs text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                      value={whatsappWebhookUrl}
                      onChange={e => { setWhatsappWebhookUrl(e.target.value); setHasUnsavedChanges(true); }}
                      placeholder="https://api.ultramsg.com/... or https://your-webhook-endpoint.com/send"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">If specified, the 3-day reminder will automatically HTTP POST the formatted WhatsApp message.</p>
                  </div>
                </div>

                {/* Channel Toggles */}
                <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableEmailReminders}
                      onChange={e => { setEnableEmailReminders(e.target.checked); setHasUnsavedChanges(true); }}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700">Enable Email Reminders (Resend)</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableWhatsappReminders}
                      onChange={e => { setEnableWhatsappReminders(e.target.checked); setHasUnsavedChanges(true); }}
                      className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-slate-700">Enable WhatsApp Notifications &amp; Digest</span>
                  </label>
                </div>
              </div>
            </div>

            {/* LIVE TEST & DISPATCH BAR */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-2xl text-white shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
                    <span>⚡</span> Run 3-Day Reminders Cycle
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Test the 5 rules right now, generate the WhatsApp text, and trigger notifications.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={runPendingActivitiesReminders}
                    disabled={isRunningReminders}
                    className="bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-2.5 rounded-xl text-xs font-black shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <span>▶</span>
                    {isRunningReminders ? 'Evaluating 5 Rules...' : 'Run 3-Day Reminders Now'}
                  </button>

                  {reminderResult?.whatsappUrl && (
                    <a
                      href={reminderResult.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-2.5 rounded-xl text-xs font-bold shadow transition flex items-center gap-2"
                    >
                      <span>📲</span> Open in WhatsApp
                    </a>
                  )}
                </div>
              </div>

              {/* RESULTS PREVIEW */}
              {reminderResult && (
                <div className="bg-black/40 border border-white/10 rounded-xl p-5 space-y-4 animate-in fade-in duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <span>✓</span> Evaluation Completed Successfully
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>

                  {/* 5 Rules Metric Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                      <span className="block text-[10px] font-black uppercase text-slate-400">Rule A: Upcoming</span>
                      <span className="text-xl font-black text-blue-400">{reminderResult.summaryReport?.upcomingEventsCount ?? 0}</span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                      <span className="block text-[10px] font-black uppercase text-slate-400">Rule B: Requests</span>
                      <span className="text-xl font-black text-amber-400">{reminderResult.summaryReport?.newRequestsCount ?? 0}</span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                      <span className="block text-[10px] font-black uppercase text-slate-400">Rule C: Rejected</span>
                      <span className="text-xl font-black text-red-400">{reminderResult.summaryReport?.rejectedEventsCount ?? 0}</span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                      <span className="block text-[10px] font-black uppercase text-slate-400">Rule D: Menu Lock</span>
                      <span className="text-xl font-black text-purple-400">{reminderResult.summaryReport?.menuLockingWarningCount ?? 0}</span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                      <span className="block text-[10px] font-black uppercase text-slate-400">Rule E: Quote Lock</span>
                      <span className="text-xl font-black text-indigo-400">{reminderResult.summaryReport?.quotationLockingWarningCount ?? 0}</span>
                    </div>
                  </div>

                  {/* Delivery Status */}
                  <div className="flex flex-wrap gap-4 text-xs pt-1">
                    <span className={`px-2.5 py-1 rounded font-bold ${reminderResult.emailSent ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
                      Email: {reminderResult.emailSent ? 'Dispatched' : (reminderResult.emailError ? `Error: ${reminderResult.emailError}` : 'Resend API Key not configured')}
                    </span>
                    <span className={`px-2.5 py-1 rounded font-bold ${reminderResult.whatsappSent ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
                      WhatsApp Webhook: {reminderResult.whatsappSent ? 'Posted' : (reminderResult.whatsappError ? reminderResult.whatsappError : 'No webhook URL configured (Use 1-Click Open)')}
                    </span>
                  </div>

                  {/* Generated WhatsApp Message Preview */}
                  {reminderResult.whatsappMessage && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                          Formatted WhatsApp Digest Preview:
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(reminderResult.whatsappMessage)
                            setCopiedWaMessage(true)
                            setTimeout(() => setCopiedWaMessage(false), 2000)
                          }}
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-bold"
                        >
                          {copiedWaMessage ? '✓ Copied to Clipboard!' : '📋 Copy WhatsApp Text'}
                        </button>
                      </div>
                      <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-emerald-300 border border-white/10 whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {reminderResult.whatsappMessage}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* FLOATING SAVE BAR */}
            {hasUnsavedChanges && (
              <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-yellow-400 text-black p-4 z-50 flex flex-col sm:flex-row justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom-full duration-300">
                <div className="font-black mb-3 sm:mb-0 text-sm sm:text-base flex items-center gap-2">
                  <span>⚠️</span> You have unsaved changes to your notification settings!
                </div>
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="w-full sm:w-auto bg-black text-white px-8 py-3 rounded-xl font-black uppercase tracking-wider hover:bg-gray-800 transition shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* USER MANAGEMENT TAB */}
        {/* ========================================================================= */}
        {activeTab === 'users' && (
          <div className="max-w-5xl pb-32">
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
                      <tr key={u.id} className="hover:bg-slate-50/50 transition font-medium">
                        <td className="p-5">
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <span>👤</span>
                            {u.full_name}
                          </div>
                        </td>
                        <td className="p-5 text-slate-600 font-mono text-xs">{u.email}</td>
                        <td className="p-5">
                          {u.assigned_password ? (
                            <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200">
                              {u.assigned_password}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Hidden</span>
                          )}
                        </td>
                        <td className="p-5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${activePermsCount === totalPerms ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                            {activePermsCount === totalPerms ? 'Full Access' : `${activePermsCount} Modules`}
                          </span>
                        </td>
                        <td className="p-5 text-right space-x-2">
                          <button onClick={() => copyCredentials(u)} className="p-2 text-slate-400 hover:text-slate-800 transition" title="Copy Login Credentials">
                            📋
                          </button>
                          <button onClick={() => openEditUserModal(u)} className="p-2 text-slate-400 hover:text-blue-600 transition" title="Edit Permissions">
                            ✏️
                          </button>
                          <button onClick={() => deleteUser(u.id)} className="p-2 text-slate-400 hover:text-red-600 transition" title="Delete User">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
              <span>{editingUserId ? '✏️' : '✨'}</span>
              {editingUserId ? 'Edit User Credentials' : 'Create New User Profile'}
            </h3>

            <form onSubmit={handleUserSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Full Name</label>
                <input required className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={modalName} onChange={e => setModalName(e.target.value)} placeholder="e.g. Anand" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Email Address</label>
                <input required type="email" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={modalEmail} onChange={e => setModalEmail(e.target.value)} placeholder="anand@therameshwaramcafe.org" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Password {editingUserId && '(Leave blank to retain current)'}</label>
                <input required={!editingUserId} type="text" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-mono text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={modalPassword} onChange={e => setModalPassword(e.target.value)} placeholder="Min 6 characters..." />
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