'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { INDIAN_STATES } from '@/app/lib/locations'
import dynamic from 'next/dynamic'

// Load map dynamically
const EventMap = dynamic(() => import('@/app/components/EventMap'), {
  ssr: false,
  loading: () => <div className="h-64 bg-gray-200 animate-pulse rounded-xl flex items-center justify-center text-black font-bold">Loading Map...</div>
})

export default function NewRequestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [clientProfile, setClientProfile] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Event Schedule State
  const [eventDate, setEventDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [days, setDays] = useState(0)
  
  // Event Specifics
  const [paxCount, setPaxCount] = useState('100')
  const [eventType, setEventType] = useState<'B2B' | 'B2C'>('B2C')
  const [clientGst, setClientGst] = useState('')
  
  // POC Data
  const [sameAsClient, setSameAsClient] = useState(true)
  const [pocName, setPocName] = useState('')
  const [pocMobile, setPocMobile] = useState('')
  const [pocEmail, setPocEmail] = useState('')

  // Venue Data
  const [city, setCity] = useState('')
  const [state, setStateName] = useState('')
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [venueZipcode, setVenueZipcode] = useState('')
  const [googleMapsLink, setGoogleMapsLink] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/portal/login')
        return
      }

      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .single()
      
      if (clientData) {
        setClientProfile(clientData)
        // Set event type based on GST presence
        setEventType(clientData.gst_number ? 'B2B' : 'B2C')
        if (clientData.gst_number) setClientGst(clientData.gst_number)
      }
      setLoading(false)
    }
    init()
  }, [router])

  // Auto-fill POC
  useEffect(() => {
    if (sameAsClient && clientProfile) {
      setPocName(clientProfile.contact_person || '')
      setPocMobile(clientProfile.mobile || '')
      setPocEmail(clientProfile.email || '')
    }
  }, [sameAsClient, clientProfile])

  // Date Calc
  useEffect(() => {
    if (eventDate && endDate) {
      const s = new Date(eventDate); const e = new Date(endDate)
      const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1
      setDays(diff > 0 ? diff : 0)
    }
  }, [eventDate, endDate])

  // Map Handler
  const handleMapSelect = (loc: any) => {
    setVenueAddress(loc.display_name)
    setErrorMessage(null)

    const possibleState = loc.address.state || loc.address.region || ''
    const possibleCity = loc.address.city || loc.address.town || loc.address.village || loc.address.county || ''
    const possibleZip = loc.address.postcode || ''

    if (possibleZip) setVenueZipcode(possibleZip)

    // Try to match State loosely
    const stateMatch = Object.keys(INDIAN_STATES).find(s => s.toLowerCase() === possibleState.toLowerCase())
    if (stateMatch) {
      setStateName(stateMatch)
      // Try to match City within that state
      const cityMatch = INDIAN_STATES[stateMatch].find(c => c.toLowerCase() === possibleCity.toLowerCase())
      if (cityMatch) setCity(cityMatch)
      else setCity('') // Reset if exact match not found, user must select
    } else {
      // Reset if state not found in our list
      setStateName('')
      setCity('')
    }

    if (loc.address.amenity || loc.address.building) {
      setVenueName(loc.address.amenity || loc.address.building)
    }
    // Generate Google Maps Link
    setGoogleMapsLink(`https://www.google.com/maps?q=${loc.lat},${loc.lon}`)
  }

  const generateEventCode = () => {
    try {
      const stateCode = state ? state.substring(0, 2).toUpperCase() : "KA"
      const d = new Date(eventDate)
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      
      const entityName = clientProfile?.entity_name || clientProfile?.contact_person || 'CLIENT'
      const clientFirstWord = entityName.trim().split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      
      return `${stateCode}${day}${month}${clientFirstWord}`
    } catch (e) {
      return `REQ${Math.floor(Math.random() * 10000)}`
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!clientProfile?.id) {
      setErrorMessage("Client profile data is missing. Please try logging out and logging back in.")
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Validation
    if (!eventDate || !city || !state || !pocName || !pocMobile || !pocEmail) {
      setErrorMessage("Please fill in all required fields (Start Date, City, State, and POC Details).")
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (eventType === 'B2B' && clientGst.length !== 15) {
      setErrorMessage("GST Number must be exactly 15 characters.")
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)

    // Optional: Update client profile with GST if it was provided
    if (eventType === 'B2B' && clientGst && clientGst !== clientProfile.gst_number) {
      await supabase.from('clients').update({ gst_number: clientGst }).eq('id', clientProfile.id)
    }

    const newEvent = {
      event_code: generateEventCode(),
      client_id: clientProfile.id,
      event_date: eventDate,
      end_date: endDate || eventDate,
      pax_count: parseInt(paxCount) || 0,
      event_type: eventType,
      city: city,
      state: state,
      venue_name: venueName,
      venue_address: venueAddress,
      venue_zipcode: venueZipcode,
      google_maps_link: googleMapsLink,
      poc_name: pocName,
      poc_mobile: pocMobile,
      poc_email: pocEmail,
      status: 'draft',
      quote_status: 'draft'
    }

    const { data, error } = await supabase.from('events').insert([newEvent]).select().single()

    setSubmitting(false)

    if (error) {
      setErrorMessage("Error creating request: " + error.message)
      return
    }

    if (data) {
      // Redirect to the Menu Selection step
      router.push(`/client-menu/${data.id}`)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center font-bold text-gray-400">Loading...</div>

  const inputClass = "w-full border border-gray-200 bg-gray-50 p-3 rounded-xl font-bold text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 placeholder-gray-400 disabled:bg-gray-100 disabled:text-gray-400 transition-all"
  const labelClass = "block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wide"

  return (
    <div className="min-h-screen bg-[#F3F4F6] font-sans pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/dashboard" className="text-gray-400 hover:text-black font-bold text-xs uppercase tracking-widest transition">
              ← Dashboard
            </Link>
          </div>
          <div className="font-black tracking-tight text-lg">New Request</div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-8">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-gray-100">
          
          <div className="bg-blue-600 p-8 text-white">
            <h1 className="text-2xl font-black mb-2">Event Details</h1>
            <p className="text-blue-100 text-sm font-medium">Please provide all details about your event, location, and contacts.</p>
          </div>

          <div className="p-8">
            {errorMessage && (
              <div className="mb-8 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl flex items-start gap-4 shadow-sm">
                <span className="text-2xl shrink-0 mt-0.5">⚠️</span>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-widest mb-1">Validation Error</h4>
                  <p className="text-sm font-bold opacity-90">{errorMessage}</p>
                </div>
                <button onClick={() => setErrorMessage(null)} className="ml-auto hover:bg-red-100 rounded-lg p-1">✕</button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-10">
              
              {/* 1. Schedule & Basics */}
              <div className="space-y-4">
                <h3 className="font-black text-lg text-gray-900 border-b pb-2">1. Event Schedule & Category</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Event Start Date *</label>
                    <input type="date" required value={eventDate} onChange={e => { setEventDate(e.target.value); if (!endDate) setEndDate(e.target.value); }} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Event End Date (Optional)</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={eventDate} className={inputClass} />
                  </div>
                </div>
                
                {days > 0 && <div className="bg-gray-50 p-3 rounded-xl flex justify-between items-center border border-gray-200">
                  <span className="text-xs font-bold text-gray-500 uppercase">Duration</span>
                  <span className="text-lg font-black text-gray-800">{days} Days</span>
                </div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Event Type</label>
                    <select value={eventType} onChange={e => setEventType(e.target.value as any)} className={`${inputClass} appearance-none`}>
                      <option value="B2C">B2C</option>
                      <option value="B2B">Corporate / B2B</option>
                    </select>
                  </div>
                  {eventType === 'B2B' && (
                    <div className="md:col-span-2">
                      <label className={labelClass}>GST Number * {clientGst.length > 0 && `(${clientGst.length}/15)`}</label>
                      <input 
                        type="text" 
                        required 
                        value={clientGst} 
                        onChange={e => {
                          const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
                          setClientGst(val)
                        }} 
                        className={inputClass} 
                        placeholder="e.g. 29AAAAA0000A1Z5"
                        maxLength={15}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Venue Contact (POC) */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-black text-lg text-gray-900">2. Venue Contact (POC)</h3>
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-200">
                    <input type="checkbox" className="w-4 h-4 accent-black" checked={sameAsClient} onChange={e => setSameAsClient(e.target.checked)} />
                    <span className="text-xs font-bold text-gray-700">Same as My Profile</span>
                  </label>
                </div>
                
                <div className={`space-y-4 ${sameAsClient ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                  <div><label className={labelClass}>POC Name *</label><input className={inputClass} value={pocName} onChange={e => setPocName(e.target.value)} required={!sameAsClient} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Mobile *</label><input className={inputClass} value={pocMobile} onChange={e => setPocMobile(e.target.value)} required={!sameAsClient} /></div>
                    <div><label className={labelClass}>Emails *</label><input className={inputClass} value={pocEmail} onChange={e => setPocEmail(e.target.value)} required={!sameAsClient} /></div>
                  </div>
                </div>
              </div>

              {/* 3. Venue Location */}
              <div className="space-y-4">
                <h3 className="font-black text-lg text-gray-900 border-b pb-2">3. Venue Location</h3>
                
                <div className="mb-6">
                  <div className="flex justify-between items-end mb-2">
                    <label className={`${labelClass} !mb-0`}>Google Maps Link</label>
                    <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                      <span>🌍</span> Search on Google Maps
                    </a>
                  </div>
                  <input
                    className={`${inputClass} text-blue-600 underline`}
                    value={googleMapsLink}
                    onChange={e => {
                      const val = e.target.value
                      setGoogleMapsLink(val)
                      // Smart Auto-fill
                      try {
                        const normalizedUrl = decodeURIComponent(val).toLowerCase()
                        let foundState = ''
                        let foundCity = ''
                        const states = Object.keys(INDIAN_STATES)
                        for (const s of states) {
                          if (normalizedUrl.includes(s.toLowerCase())) {
                            foundState = s; break;
                          }
                        }
                        if (foundState) {
                          for (const c of INDIAN_STATES[foundState]) {
                            if (normalizedUrl.includes(c.toLowerCase())) { foundCity = c; break; }
                          }
                        } else {
                          for (const s of states) {
                            for (const c of INDIAN_STATES[s]) {
                              if (normalizedUrl.includes(c.toLowerCase())) { foundCity = c; foundState = s; break; }
                            }
                            if (foundCity) break;
                          }
                        }
                        if (foundState) setStateName(foundState)
                        if (foundCity) setCity(foundCity)
                      } catch (err) {}
                    }}
                    placeholder="Paste link here (e.g. https://maps.app.goo.gl/...)"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-bold">Paste full URL to auto-fill City & State.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>State *</label>
                    <select required className={inputClass} value={state} onChange={e => { setStateName(e.target.value); setCity(''); }}>
                      <option value="">Select State</option>
                      {Object.keys(INDIAN_STATES).map(s => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>City *</label>
                    <select required className={inputClass} value={city} onChange={e => setCity(e.target.value)} disabled={!state}>
                      <option value="">Select City</option>
                      {state && INDIAN_STATES[state]?.map(c => (<option key={c} value={c}>{c}</option>))}
                    </select>
                  </div>
                </div>

                <div className="mb-6 flex items-center gap-4 py-4">
                  <div className="h-px bg-gray-200 flex-1"></div>
                  <span className="text-xs font-black text-gray-400 uppercase whitespace-nowrap">OR SELECT ON MAP</span>
                  <div className="h-px bg-gray-200 flex-1"></div>
                </div>

                <div className="z-0 border border-gray-300 rounded-xl overflow-hidden shadow-inner">
                  <EventMap onLocationSelect={handleMapSelect} />
                </div>

                <div className="space-y-4 pt-4">
                  <div><label className={labelClass}>Venue Name</label><input className={inputClass} value={venueName} onChange={e => setVenueName(e.target.value)} placeholder="e.g. Shangri-La Hotel" /></div>
                  <div><label className={labelClass}>Full Address</label><textarea className={`${inputClass} h-24`} value={venueAddress} onChange={e => setVenueAddress(e.target.value)} /></div>
                  <div><label className={labelClass}>Zip Code / Pincode</label><input type="text" className={inputClass} value={venueZipcode} onChange={e => setVenueZipcode(e.target.value)} placeholder="e.g. 560001" /></div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">Step 1 of 2</span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-black text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? 'Creating...' : 'Continue to Menu Selection →'}
                </button>
              </div>
              
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
