'use client'
import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    } else {
      // Success! Go to Dashboard
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-200/50 overflow-hidden">

        {/* Header Graphic */}
        <div className="bg-[#0F172A] p-8 pb-10 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <img
              src="/logo.png"
              alt="The Rameshwaram Cafe"
              className="w-40 h-auto object-contain mb-4 drop-shadow-xl"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-1">Quotation System</p>
          </div>
          {/* Decorative Blur */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>
        </div>

        {/* Login Form */}
        <div className="p-8 pt-10">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Admin Email</label>
              <input
                type="email"
                required
                className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="admin@therameshwaramcafe.org"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Password</label>
              <input
                type="password"
                required
                className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrorMsg('') }}
              />
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-xs font-bold leading-relaxed flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <span className="text-base shrink-0">⚠️</span>
                <span>{errorMsg === 'Invalid login credentials' ? 'Incorrect email or password. Please try again.' : errorMsg}</span>
              </div>
            )}

            <button
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? 'Authenticating...' : 'Secure Login →'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-300 mt-8 font-medium">
            Authorized Personnel Only
          </p>
        </div>
      </div>
    </div>
  )
}