'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Client } from '@/app/types'
import { INDIAN_STATES } from '@/app/lib/locations'
import dynamic from 'next/dynamic'

// Load map dynamically
const EventMap = dynamic(() => import('./EventMap'), {
  ssr: false,
  loading: () => <div className="h-64 bg-gray-200 animate-pulse rounded flex items-center justify-center text-black font-bold">Loading Map...</div>
})

export default function NewEventModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])

  // Search & Selection State
  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [isNewClientMode, setIsNewClientMode] = useState(false)

  // Form Data
  const [clientName, setClientName] = useState('')
  const [clientGst, setClientGst] = useState('')
  const [clientContact, setClientContact] = useState('')
  const [clientMobile, setClientMobile] = useState('')
  const [clientEmail, setClientEmail] = useState('')

  const [sameAsClient, setSameAsClient] = useState(true)
  const [pocName, setPocName] = useState('')
  const [pocMobile, setPocMobile] = useState('')
  const [pocEmail, setPocEmail] = useState('')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [days, setDays] = useState(0)

  const [venueName, setVenueName] = useState('')
  const [fullAddress, setFullAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [googleMapsLink, setGoogleMapsLink] = useState('')

  // New Fields
  const [eventType, setEventType] = useState<'B2B' | 'B2C'>('B2C') // Default B2C
  const [eventSize, setEventSize] = useState<'Small' | 'Large'>('Small') // Default Small

  // Validation State
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('entity_name')
    if (data) setClients(data as any)
  }

  // Handle Selection
  const handleClientSelect = (client: any) => {
    setSelectedClientId(client.id.toString())
    setClientName(client.entity_name)
    setClientGst(client.gst_number || '')
    setEventType(client.gst_number ? 'B2B' : 'B2C') // Auto-set B2B/B2C based on GST
    setClientContact(client.contact_person)
    setClientMobile(client.mobile)
    setClientEmail(client.email)
    setErrorMessage(null) // clear errors

    setClientSearchTerm(client.entity_name)
    setShowClientDropdown(false)
    setIsNewClientMode(false)
  }

  const handleNewClientMode = () => {
    setSelectedClientId('NEW')
    setIsNewClientMode(true)
    setClientName(clientSearchTerm)
    setClientGst('')
    setClientContact('')
    setClientMobile('')
    setClientEmail('')
    setErrorMessage(null)
    setShowClientDropdown(false)
  }

  const clearClientSelection = () => {
    setSelectedClientId(null)
    setIsNewClientMode(false)
    setClientSearchTerm('')
    setClientName('')
    setClientGst('')
    setClientContact('')
    setClientMobile('')
    setClientEmail('')
    setErrorMessage(null)
  }

  // Auto-fill POC
  useEffect(() => {
    if (sameAsClient) {
      setPocName(clientContact)
      setPocMobile(clientMobile)
      setPocEmail(clientEmail)
    }
  }, [sameAsClient, clientContact, clientMobile, clientEmail])

  // Date Calc
  useEffect(() => {
    if (startDate && endDate) {
      const s = new Date(startDate); const e = new Date(endDate)
      const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1
      setDays(diff > 0 ? diff : 0)
    }
  }, [startDate, endDate])

  // Map Handler
  const handleMapSelect = (loc: any) => {
    setFullAddress(loc.display_name)
    setErrorMessage(null)

    // Attempt to parse city/state from the location object directly if possible, or leave blank for manual selection
    // Given the new requirements, we'll try to map the location details to our INDIAN_STATES list if possible
    // But OpenStreetMap data might not match perfectly. For now, we'll fill what we can.

    const possibleState = loc.address.state || loc.address.region || ''
    const possibleCity = loc.address.city || loc.address.town || loc.address.village || loc.address.county || ''

    // Try to match State loosely
    const stateMatch = Object.keys(INDIAN_STATES).find(s => s.toLowerCase() === possibleState.toLowerCase())
    if (stateMatch) {
      setState(stateMatch)
      // Try to match City within that state
      const cityMatch = INDIAN_STATES[stateMatch].find(c => c.toLowerCase() === possibleCity.toLowerCase())
      if (cityMatch) setCity(cityMatch)
      else setCity('') // Reset if exact match not found, user must select
    } else {
      // Reset if state not found in our list
      setState('')
      setCity('')
    }

    if (loc.address.amenity || loc.address.building) {
      setVenueName(loc.address.amenity || loc.address.building)
    }
    // Generate Google Maps Link
    setGoogleMapsLink(`https://www.google.com/maps?q=${loc.lat},${loc.lon}`)
  }

  const handleSubmit = async () => {
    // Clear previous errors
    setErrorMessage(null)

    // Check all necessary fields
    if (!clientName || !clientEmail || !clientContact || !clientMobile || !startDate || !endDate || !city || !state || !venueName || !fullAddress || !pocName || !pocMobile || !pocEmail) {
      setErrorMessage("Please fill in all required fields (Client Name, Email, Contact, Start/End Date, Venue Details, and POC).")
      // Scroll to top of modal to see error
      document.querySelector('.max-h-\\[95vh\\]')?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Strict GST Validation
    if (clientGst && clientGst.trim().length !== 15) {
      setErrorMessage("GST Number must be exactly 15 characters, or left empty.")
      document.querySelector('.max-h-\\[95vh\\]')?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setLoading(true)

    let finalClientId = selectedClientId

    // If they typed a name but didn't explicitly select an existing client, treat as a new client
    if (!finalClientId || isNewClientMode || finalClientId === 'NEW') {
      const { data: newC, error } = await supabase.from('clients').insert([{
        entity_name: clientName,
        gst_number: clientGst,
        contact_person: clientContact,
        mobile: clientMobile,
        email: clientEmail,
        city: city || 'Bangalore'
      }]).select().single()

      if (error) {
        alert("Error saving new client: " + error.message);
        setLoading(false);
        return
      }
      finalClientId = newC.id
    }

    const stateCode = state ? state.substring(0, 2).toUpperCase() : "KA"
    const d = new Date(startDate)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const clientFirstWord = clientName.trim().split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const code = `${stateCode}${day}${month}${clientFirstWord}`

    const { error: eventError } = await supabase.from('events').insert([{
      client_id: finalClientId,
      event_date: startDate, end_date: endDate || startDate,
      event_code: code, status: 'draft',
      venue_name: venueName, venue_address: fullAddress, city, state,
      google_maps_link: googleMapsLink,
      event_type: eventType, event_size: eventSize,
      poc_name: pocName, poc_mobile: pocMobile, poc_email: pocEmail,
      pax_count: 0
    }])

    setLoading(false)
    if (eventError) {
      alert("Error creating event: " + eventError.message)
    } else {
      onSuccess()
      onClose()
    }
  }

  const filteredClients = clients.filter(c =>
    c.entity_name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  )

  const inputClass = "w-full border border-gray-400 bg-white p-2.5 rounded-lg text-sm font-bold text-black outline-none focus:border-black focus:ring-1 focus:ring-black placeholder-gray-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
  const labelClass = "block text-[11px] font-extrabold text-gray-800 uppercase mb-1 tracking-wide"
  const sectionTitleClass = "text-sm font-black text-black uppercase tracking-widest mb-4"

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-gray-400">

        {/* Header */}
        <div className="bg-white p-6 border-b border-gray-300 flex justify-between items-center shrink-0">
          <div><h2 className="text-2xl font-black text-black tracking-tight uppercase">New Event Project</h2></div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-black hover:bg-red-100 hover:text-red-600 transition font-bold text-xl border border-gray-300">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-gray-50 relative">

          {errorMessage && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl flex items-start gap-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
              <span className="text-2xl shrink-0 mt-0.5">⚠️</span>
              <div>
                <h4 className="font-black text-sm uppercase tracking-widest mb-1">Validation Error</h4>
                <p className="text-sm font-bold opacity-90">{errorMessage}</p>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-100 transition shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* LEFT COLUMN */}
            <div className="lg:col-span-5 space-y-6">

              {/* 1. Client Search */}
              <div className="bg-white p-6 rounded border border-gray-300 shadow-sm">
                <h3 className={sectionTitleClass}>1. Client Details</h3>

                <div className="relative mb-4">
                  <label className={labelClass}>Search Client</label>
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      placeholder="Type client name..."
                      value={clientSearchTerm}
                      onChange={e => {
                        setClientSearchTerm(e.target.value)
                        setShowClientDropdown(true)
                        if (selectedClientId) clearClientSelection()
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                    />
                    {selectedClientId && (
                      <button onClick={clearClientSelection} className="px-3 bg-gray-200 text-black font-bold rounded hover:bg-gray-300 border border-gray-300">Clear</button>
                    )}
                  </div>

                  {/* Search Results */}
                  {showClientDropdown && clientSearchTerm && !selectedClientId && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-black shadow-xl max-h-60 overflow-y-auto z-50 mt-1">
                      {filteredClients.map(c => (
                        <button
                          key={c.id}
                          onClick={() => handleClientSelect(c)}
                          className="w-full text-left p-3 hover:bg-blue-50 border-b border-gray-100 text-black font-medium text-sm"
                        >
                          {c.entity_name}
                        </button>
                      ))}
                      <button
                        onClick={handleNewClientMode}
                        className="w-full text-left p-3 bg-blue-50 text-blue-800 font-bold hover:bg-blue-100 border-t border-blue-200 text-sm"
                      >
                        + Create New Client: "{clientSearchTerm}"
                      </button>
                    </div>
                  )}
                </div>

                <div className={`space-y-4 ${!selectedClientId ? 'opacity-50 grayscale' : 'opacity-100'}`}>
                  <div><label className={labelClass}>Company Name</label><input className={inputClass} value={clientName} onChange={e => setClientName(e.target.value)} disabled={!isNewClientMode} /></div>
                  <div>
                    <label className={labelClass}>GST Number {clientGst.length > 0 && `(${clientGst.length}/15)`}</label>
                    <input
                      className={inputClass}
                      value={clientGst}
                      onChange={e => {
                        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) // Limit to 15 chars, alphanumeric
                        setClientGst(val)
                        setEventType(val.length === 15 ? 'B2B' : 'B2C') // Auto-switch logic
                      }}
                      disabled={!isNewClientMode && selectedClientId !== 'NEW' && selectedClientId !== null}
                      placeholder="e.g. 29AAAAA0000A1Z5"
                      maxLength={15}
                    />
                  </div>

                  {/* NEW: Event Type & Size */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-blue-50 p-3 rounded border border-blue-100">
                    <div>
                      <label className={labelClass}>Event Type (Auto)</label>
                      <div className="font-bold text-sm text-black">{eventType}</div>
                    </div>
                    <div>
                      <label className={labelClass}>Event Size (Select)</label>
                      <select
                        className={inputClass}
                        value={eventSize}
                        onChange={e => setEventSize(e.target.value as 'Small' | 'Large')}
                      >
                        <option value="Small">Small</option>
                        <option value="Large">Large</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className={labelClass}>Contact Person</label><input className={inputClass} value={clientContact} onChange={e => setClientContact(e.target.value)} disabled={!isNewClientMode && selectedClientId !== 'NEW'} /></div>
                    <div><label className={labelClass}>Mobile</label><input className={inputClass} value={clientMobile} onChange={e => setClientMobile(e.target.value)} disabled={!isNewClientMode && selectedClientId !== 'NEW'} /></div>
                  </div>
                  <div><label className={labelClass}>Emails (Comma separate)</label><input className={inputClass} value={clientEmail} onChange={e => setClientEmail(e.target.value)} disabled={!isNewClientMode && selectedClientId !== 'NEW'} /></div>
                </div>
              </div>

              {/* 2. Schedule */}
              <div className="bg-white p-6 rounded border border-gray-300 shadow-sm">
                <h3 className={sectionTitleClass}>2. Event Schedule</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>Start Date</label><input type="date" className={inputClass} value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }} /></div>
                  <div><label className={labelClass}>End Date</label><input type="date" className={inputClass} value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} /></div>
                </div>
                {days > 0 && <div className="mt-4 bg-gray-100 p-3 rounded flex justify-between items-center border border-gray-300">
                  <span className="text-xs font-bold text-black uppercase">Duration</span>
                  <span className="text-lg font-black text-black">{days} Days</span>
                </div>}
              </div>

              {/* 3. POC */}
              <div className="bg-white p-6 rounded border border-gray-300 shadow-sm">
                <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-2">
                  <h3 className={`${sectionTitleClass} !mb-0`}>3. Venue Contact</h3>
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-gray-100 px-2 py-1 rounded border border-gray-200 hover:bg-gray-200">
                    <input type="checkbox" className="w-4 h-4 accent-black" checked={sameAsClient} onChange={e => setSameAsClient(e.target.checked)} />
                    <span className="text-xs font-bold text-black">Same as Client</span>
                  </label>
                </div>

                <div className={`space-y-4 ${sameAsClient ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                  <div><label className={labelClass}>POC Name</label><input className={inputClass} value={pocName} onChange={e => setPocName(e.target.value)} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className={labelClass}>Mobile</label><input className={inputClass} value={pocMobile} onChange={e => setPocMobile(e.target.value)} /></div>
                    <div><label className={labelClass}>Emails</label><input className={inputClass} value={pocEmail} onChange={e => setPocEmail(e.target.value)} /></div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-7 flex flex-col h-full">
              <div className="bg-white p-6 rounded border border-gray-300 shadow-sm flex flex-col h-full">
                <h3 className={`${sectionTitleClass} mb-4`}>4. Venue Location</h3>

                {/* Google Maps Link - NOW FIRST */}
                <div className="mb-6">
                  <label className={labelClass}>Google Maps Link</label>
                  <div className="flex gap-2">
                    <input
                      className={`${inputClass} text-blue-600 underline`}
                      value={googleMapsLink}
                      onChange={e => {
                        const val = e.target.value
                        setGoogleMapsLink(val)

                        // Smart Auto-fill logic
                        try {
                          // Normalize URL for easier searching (decode + lowercase)
                          const normalizedUrl = decodeURIComponent(val).toLowerCase()

                          let foundState = ''
                          let foundCity = ''

                          // 1. Search for State
                          const states = Object.keys(INDIAN_STATES)
                          for (const s of states) {
                            if (normalizedUrl.includes(s.toLowerCase())) {
                              foundState = s;
                              break;
                            }
                          }

                          // 2. Search for City (prefer within found State, otherwise global search)
                          if (foundState) {
                            const cities = INDIAN_STATES[foundState]
                            for (const c of cities) {
                              if (normalizedUrl.includes(c.toLowerCase())) {
                                foundCity = c;
                                break;
                              }
                            }
                          } else {
                            // Global city search if state not found explicitly
                            for (const s of states) {
                              for (const c of INDIAN_STATES[s]) {
                                if (normalizedUrl.includes(c.toLowerCase())) {
                                  foundCity = c;
                                  foundState = s; // Infer state from city
                                  break;
                                }
                              }
                              if (foundCity) break;
                            }
                          }

                          if (foundState) setState(foundState)
                          if (foundCity) setCity(foundCity)

                        } catch (err) {
                          console.log("Could not auto-fill location", err)
                        }
                      }}
                      placeholder="Paste link here (e.g. https://maps.app.goo.gl/...)"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 font-bold">Paste full URL to auto-fill City & State.</p>
                </div>

                {/* City & State - Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className={labelClass}>State</label>
                    <select
                      className={inputClass}
                      value={state}
                      onChange={e => {
                        setState(e.target.value)
                        setCity('') // Reset city when state changes
                      }}
                    >
                      <option value="">Select State</option>
                      {Object.keys(INDIAN_STATES).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <select
                      className={inputClass}
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      disabled={!state}
                    >
                      <option value="">Select City</option>
                      {state && INDIAN_STATES[state]?.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-6 flex items-center gap-4">
                  <div className="h-px bg-gray-200 flex-1"></div>
                  <span className="text-xs font-black text-gray-400 uppercase whitespace-nowrap">OR SELECT ON MAP</span>
                  <div className="h-px bg-gray-200 flex-1"></div>
                </div>

                <div className="mb-6 z-0 border border-gray-300 rounded overflow-hidden">
                  <EventMap onLocationSelect={handleMapSelect} />
                </div>

                <div className="space-y-4 mt-auto">
                  <div><label className={labelClass}>Venue Name</label><input className={`${inputClass} text-lg bg-gray-50`} value={venueName} onChange={e => setVenueName(e.target.value)} placeholder="e.g. Shangri-La Hotel" /></div>
                  <div><label className={labelClass}>Full Address</label><textarea className={`${inputClass} h-24 font-medium`} value={fullAddress} onChange={e => setFullAddress(e.target.value)} /></div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 lg:p-6 border-t border-gray-300 bg-white shrink-0 flex flex-col-reverse lg:flex-row justify-end gap-3 z-10">
          <button onClick={onClose} className="w-full lg:w-auto px-6 py-3 font-bold text-black hover:bg-gray-100 border border-gray-300 rounded transition">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="w-full lg:w-auto px-8 py-3 bg-black text-white rounded font-bold hover:bg-gray-900 shadow-lg transition active:scale-95 disabled:opacity-50">
            {loading ? 'Processing...' : 'Create Event Project'}
          </button>
        </div>
      </div>
    </div>
  )
}