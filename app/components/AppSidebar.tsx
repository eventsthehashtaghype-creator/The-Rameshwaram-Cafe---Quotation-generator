'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { useState, useEffect } from 'react'

export default function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUserAccess() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: userProfile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (userProfile) {
        setProfile(userProfile)

        // Strict Protection: If they are on a protected URL without the checkbox permission, kick them out
        const perms = userProfile.permissions || {}
        if (pathname.includes('/calendar') && !perms.calendar) router.push('/')
        if (pathname.includes('/clients') && !perms.clients) router.push('/')
        if (pathname.includes('/quotation') && !perms.quotations) router.push('/')
        if (pathname.includes('/menu-manager') && !perms.menu) router.push('/')
        if (pathname.includes('/settings') && !perms.settings) router.push('/')
      } else {
        console.error("Failed to load user profile. Make sure rbac_profiles.sql and grant_admin.sql were executed:", profileError)
      }
      setLoading(false)
    }
    fetchUserAccess()
  }, [pathname])

  // Logout Handler
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (path: string) => pathname === path || (path !== '/' && pathname.startsWith(path))
    ? 'bg-blue-600 text-white shadow-md'
    : 'text-gray-400 hover:text-white hover:bg-white/10'

  if (loading) return null // Wait for permissions

  const perms = profile?.permissions || {}
  const activeRoleBadge = perms.settings ? 'Admin Access' : 'Staff Access'
  const initials = profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'US'

  const NavContent = () => (
    <>
      <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-slate-900">
        <div className="flex flex-col items-center w-full">
          <img
            src="/logo.png"
            alt="The Rameshwaram Cafe"
            className="w-48 object-contain mb-3"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mt-1 text-center">Quotation System</p>
        </div>
        {/* Mobile Close Button */}
        <button onClick={() => setIsOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <div className="mb-6">
          {perms.dashboard !== false && (
            <Link href="/" onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${isActive('/')}`}>
              <span>📊</span> Dashboard
            </Link>
          )}
          {perms.calendar && (
            <Link href="/calendar" onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${isActive('/calendar')}`}>
              <span>📅</span> Calendar
            </Link>
          )}
        </div>

        <div className="mb-6">
          {perms.menu && (
            <Link href="/menu-manager" onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${isActive('/menu-manager')}`}>
              <span>🍽️</span> Menu Manager
            </Link>
          )}
          {perms.clients && (
            <Link href="/clients" onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${isActive('/clients')}`}>
              <span>👥</span> Clients
            </Link>
          )}
        </div>

        <div>
          <Link href="/getting-started" onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${isActive('/getting-started')}`}>
            <span>📚</span> Getting Started
          </Link>
          {perms.settings && (
            <Link href="/settings" onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${isActive('/settings')}`}>
              <span>⚙️</span> Settings
            </Link>
          )}
        </div>
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gray-900/50 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${perms.settings ? 'bg-purple-600' : 'bg-blue-600'}`}>
              {initials}
            </div>
            <div>
              <p className="text-xs font-bold text-white max-w-[120px] truncate">{profile?.full_name}</p>
              <p className="text-[10px] text-gray-400">{activeRoleBadge}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-500 transition-colors p-1" title="Log Out">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="lg:hidden fixed top-4 left-4 z-50 bg-black text-white p-2 rounded-lg shadow-lg hover:bg-gray-800 transition">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      <aside className="hidden lg:flex w-64 bg-[#0F172A] text-white flex-col h-screen shrink-0 font-sans border-r border-gray-800 sticky top-0">
        <NavContent />
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-80 bg-[#0F172A] text-white flex flex-col h-full shadow-2xl animate-in slide-in-from-left duration-300">
            <NavContent />
          </aside>
        </div>
      )}
    </>
  )
}