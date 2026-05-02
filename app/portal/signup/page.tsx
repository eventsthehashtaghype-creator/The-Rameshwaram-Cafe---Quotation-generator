'use client'
import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [entityName, setEntityName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [mobile, setMobile] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setErrorMsg(authError.message)
      setLoading(false)
      return
    }

    if (authData.user) {
      // Create the client record mapped to this user
      const { error: clientError } = await supabase.from('clients').insert([{
        auth_user_id: authData.user.id,
        email: email,
        entity_name: entityName,
        contact_person: contactPerson,
        mobile: mobile
      }])

      if (clientError) {
        setErrorMsg("Error creating client profile: " + clientError.message)
        setLoading(false)
        return
      }

      // Automatically sign in the user if email confirmation is disabled
      router.push('/portal/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4 font-sans py-12">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl shadow-slate-200/50 overflow-hidden">
        
        <div className="bg-[#0F172A] p-8 pb-10 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <h1 className="text-white text-2xl font-black tracking-tight">Client Portal Registration</h1>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-1">Quotation System</p>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl"></div>
        </div>

        <div className="p-8 pt-10">
          <form onSubmit={handleSignup} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Company/Entity Name</label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="Acme Corp"
                  value={entityName}
                  onChange={e => setEntityName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Contact Person</label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="John Doe"
                  value={contactPerson}
                  onChange={e => setContactPerson(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Mobile Number</label>
              <input
                type="tel"
                required
                className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="+91 98765 43210"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
              />
            </div>

            <hr className="border-gray-100 my-6" />

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Email Address (Login ID)</label>
              <input
                type="email"
                required
                className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="client@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Create Password</label>
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
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-xs font-bold leading-relaxed flex items-center gap-2">
                <span className="text-base shrink-0">⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? 'Creating Account...' : 'Register Account →'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-8 font-medium">
            Already have an account? <Link href="/portal/login" className="text-blue-600 hover:underline">Log in here</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
