'use client'
import AppSidebar from '@/app/components/AppSidebar'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'

export default function GettingStartedPage() {
    const router = useRouter()
    const [activeSection, setActiveSection] = useState('overview')
    const [searchQuery, setSearchQuery] = useState('')

    const sections = [
        { id: 'overview', title: '1. Platform Overview & Workflow', icon: '🌟' },
        { id: 'dashboard', title: '2. Dashboard & Event Management', icon: '📊' },
        { id: 'quotation-builder', title: '3. Quotation Builder (All Tabs)', icon: '🏗️' },
        { id: 'annexure-c', title: '4. Annexure C & PDF/Word Exports', icon: '📄' },
        { id: 'client-menu', title: '5. Client Menu Wizard & Locking', icon: '📱' },
        { id: 'calendar', title: '6. Calendar & Filtered Export', icon: '📅' },
        { id: 'clients', title: '7. Client Directory & Excel Export', icon: '👥' },
        { id: 'menu-manager', title: '8. Menu Master Library', icon: '🍽️' },
        { id: 'settings', title: '9. Settings, Bank & Permissions', icon: '⚙️' },
        { id: 'versions-audit', title: '10. Version Control & Audit Trail', icon: '📜' },
        { id: 'faq', title: '11. Quick Reference & FAQ', icon: '💡' },
    ]

    useEffect(() => {
        async function checkRole() {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }
            const { data: clientUser } = await supabase.from('clients').select('id').eq('auth_user_id', session.user.id).single()
            if (clientUser) {
                router.replace('/portal/dashboard')
            }
        }
        checkRole()
    }, [router])

    // Intersection Observer to highlight active sidebar link based on scroll
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id)
                }
            })
        }, { rootMargin: '-15% 0px -65% 0px' })

        sections.forEach(sec => {
            const el = document.getElementById(sec.id)
            if (el) observer.observe(el)
        })

        return () => observer.disconnect()
    }, [])

    const handleScrollTo = (id: string) => {
        const el = document.getElementById(id)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' })
            setActiveSection(id)
        }
    }

    return (
        <div className="flex h-screen bg-[#F8F9FA] font-sans overflow-hidden text-stone-800">
            <AppSidebar />

            <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

                {/* MOBILE TOC DROPDOWN */}
                <div className="lg:hidden bg-white border-b border-stone-200 p-4 sticky top-0 z-20 shrink-0 mt-14 shadow-sm">
                    <select
                        className="w-full bg-stone-50 border border-stone-300 p-3 rounded-xl text-sm font-bold text-stone-900 outline-none focus:ring-2 focus:ring-amber-500"
                        value={activeSection}
                        onChange={(e) => handleScrollTo(e.target.value)}
                    >
                        {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.icon} {s.title}</option>
                        ))}
                    </select>
                </div>

                {/* MAIN CONTENT AREA */}
                <div className="flex-1 overflow-y-auto w-full scroll-smooth" id="scroll-container">
                    <div className="max-w-5xl mx-auto p-5 sm:p-8 lg:p-12 pb-36">

                        {/* HERO BANNER */}
                        <div className="mb-10 lg:mb-14 mt-4 lg:mt-0 bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 text-white p-8 sm:p-10 rounded-3xl shadow-xl relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
                            
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className="bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-amber-500/30">
                                    The Rameshwaram Cafe Quotation System
                                </span>
                                <span className="text-stone-400 text-xs font-semibold">Interactive Software Documentation</span>
                            </div>

                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4 text-balance">
                                Complete User & Administrator Guide
                            </h1>
                            <p className="text-stone-300 text-sm sm:text-base lg:text-lg max-w-2xl leading-relaxed">
                                Welcome! Whether you are a newly joined staff member or an administrator, this guide explains every page, tab, button, toggle, and automated workflow in detail. Keep this page open whenever you have a doubt.
                            </p>

                            {/* SEARCH BOX */}
                            <div className="mt-6 max-w-xl">
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                                        🔍
                                    </span>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Quick Jump: Type 'Annexure C', 'Menu Lock', 'PDF', 'Excel', 'Rollback'..."
                                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 backdrop-blur-sm transition"
                                    />
                                </div>
                                {searchQuery.trim() && (
                                    <div className="mt-2 bg-white text-stone-900 rounded-xl p-3 shadow-2xl border border-stone-200 text-xs space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                        <p className="font-bold text-stone-500 uppercase tracking-wider text-[10px]">Suggested Sections:</p>
                                        {sections
                                            .filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.includes(searchQuery.toLowerCase()))
                                            .map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => {
                                                        handleScrollTo(s.id)
                                                        setSearchQuery('')
                                                    }}
                                                    className="w-full text-left p-2 hover:bg-amber-50 rounded-lg flex items-center justify-between text-stone-800 font-semibold"
                                                >
                                                    <span>{s.icon} {s.title}</span>
                                                    <span className="text-amber-700 font-bold">Go to section ➔</span>
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CONTENT BLOCKS */}
                        <div className="space-y-14 sm:space-y-20">

                            {/* SECTION 1: OVERVIEW */}
                            <section id="overview" className="scroll-mt-24 lg:scroll-mt-8">
                                <div className="flex items-center gap-3.5 mb-5">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl shadow-inner shrink-0">🌟</div>
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">1. Platform Overview & The 4-Step Golden Flow</h2>
                                        <p className="text-xs sm:text-sm text-stone-500">How the entire catering lifecycle flows from first inquiry to finalized PDF.</p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200/80 space-y-6">
                                    <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
                                        The Rameshwaram Cafe Quotation System is designed to eliminate tedious Excel spreadsheets and manual email back-and-forths. Instead of guessing prices, you send clients a live interactive menu link. Once the client picks their dishes, the system calculates plate totals, taxes, and automatically formats both <strong>Word (.docx)</strong> and <strong>PDF</strong> quotation documents.
                                    </p>

                                    {/* 4-STEP PIPELINE CARDS */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                                        <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 flex flex-col justify-between hover:border-amber-400 transition-colors shadow-sm">
                                            <div>
                                                <div className="inline-block bg-stone-200 text-stone-800 font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md mb-2">Step 1</div>
                                                <h4 className="font-bold text-stone-900 text-base mb-1">Create Event</h4>
                                                <p className="text-xs text-stone-600 leading-relaxed">Admin registers event date, pax headcount, venue, and client contact details.</p>
                                            </div>
                                            <span className="text-xs text-amber-700 font-bold mt-4">Dashboard ➔</span>
                                        </div>

                                        <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200 flex flex-col justify-between hover:border-amber-400 transition-colors shadow-sm">
                                            <div>
                                                <div className="inline-block bg-amber-200 text-amber-900 font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md mb-2">Step 2</div>
                                                <h4 className="font-bold text-stone-900 text-base mb-1">Client Picks Dishes</h4>
                                                <p className="text-xs text-stone-600 leading-relaxed">Client opens a mobile-friendly link, chooses desired items, and submits.</p>
                                            </div>
                                            <span className="text-xs text-amber-800 font-bold mt-4">Client Menu Link ➔</span>
                                        </div>

                                        <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 flex flex-col justify-between hover:border-amber-400 transition-colors shadow-sm">
                                            <div>
                                                <div className="inline-block bg-stone-200 text-stone-800 font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md mb-2">Step 3</div>
                                                <h4 className="font-bold text-stone-900 text-base mb-1">Pricing & Terms</h4>
                                                <p className="text-xs text-stone-600 leading-relaxed">Admin enters Pax & Price Per Plate; customizes Terms & Conditions and Annexure C.</p>
                                            </div>
                                            <span className="text-xs text-amber-700 font-bold mt-4">Quotation Builder ➔</span>
                                        </div>

                                        <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 flex flex-col justify-between hover:border-emerald-400 transition-colors shadow-sm">
                                            <div>
                                                <div className="inline-block bg-emerald-200 text-emerald-900 font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md mb-2">Step 4</div>
                                                <h4 className="font-bold text-stone-900 text-base mb-1">Export PDF / Word</h4>
                                                <p className="text-xs text-stone-600 leading-relaxed">Download cleanly paginated documents ready to share via WhatsApp or Email.</p>
                                            </div>
                                            <span className="text-xs text-emerald-700 font-bold mt-4">Word & PDF Output ➔</span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 2: DASHBOARD */}
                            <section id="dashboard" className="scroll-mt-24 lg:scroll-mt-8">
                                <div className="flex items-center gap-3.5 mb-5">
                                    <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center text-xl shadow-inner shrink-0">📊</div>
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">2. Dashboard & Event Management</h2>
                                        <p className="text-xs sm:text-sm text-stone-500">Your central command center for tracking events, statuses, and quick actions.</p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200/80 space-y-6">
                                    <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-2">Key Metric Cards & Filters</h3>
                                    <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
                                        The top of the dashboard provides high-level business metrics: Total Events Count, Confirmed Revenue, Active Drafts, and Events Happening Today. You can filter the table below by status: <strong>All, Draft, Confirmed, Event is Today, Event Closed, Cancelled</strong>.
                                    </p>

                                    {/* STATUS AUTOMATION BOX */}
                                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-5 rounded-2xl border border-amber-200">
                                        <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2 mb-2">
                                            <span>⚡</span> Automated Temporal Statuses
                                        </h4>
                                        <ul className="text-xs sm:text-sm text-stone-700 space-y-2 leading-relaxed">
                                            <li>• <strong className="text-amber-900">"Event is Today"</strong>: When the current calendar date matches the event start or end date (and the event is confirmed), the status automatically updates to a vibrant pulsing badge.</li>
                                            <li>• <strong className="text-stone-900">"Event Closed"</strong>: As soon as the event dates have passed, the status automatically switches to Closed. Both the quotation and the menu selection are automatically locked down to protect historical data.</li>
                                        </ul>
                                    </div>

                                    <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-2 pt-4">Action Buttons & Controls</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <span className="bg-stone-900 text-white text-xs font-bold px-3 py-1 rounded-lg inline-block mb-2">+ Create New Event</span>
                                            <p className="text-xs text-stone-600 leading-relaxed">
                                                Opens the Event Creation Modal. Type the client organization name; existing clients auto-populate their phone, email, and GSTIN. Specify event date range and venue.
                                            </p>
                                        </div>

                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <span className="bg-amber-700 text-white text-xs font-bold px-3 py-1 rounded-lg inline-block mb-2">Open Quote</span>
                                            <p className="text-xs text-stone-600 leading-relaxed">
                                                The primary button on each row. Directs you immediately to the 3-tab Quotation Builder for that specific event.
                                            </p>
                                        </div>

                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <span className="bg-stone-200 text-stone-800 text-xs font-bold px-3 py-1 rounded-lg inline-block mb-2">Action Menu (⋮)</span>
                                            <p className="text-xs text-stone-600 leading-relaxed">
                                                Contains secondary shortcuts: Preview Menu (opens client view), Edit Details, Copy Shareable Link, Confirm/Cancel status, and Delete.
                                            </p>
                                        </div>

                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-lg inline-block mb-2">🔒 Menu Lock Toggle</span>
                                            <p className="text-xs text-stone-600 leading-relaxed">
                                                Instantly locks or unlocks client editing rights. When locked, the client will see a "Menu is Locked" badge on their phone and cannot modify items.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 3: QUOTATION BUILDER */}
                            <section id="quotation-builder" className="scroll-mt-24 lg:scroll-mt-8">
                                <div className="flex items-center gap-3.5 mb-5">
                                    <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center text-xl shadow-inner shrink-0">🏗️</div>
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">3. Quotation Builder (Deep Dive into All 3 Tabs)</h2>
                                        <p className="text-xs sm:text-sm text-stone-500">The heart of pricing, venue mapping, meal sequencing, and terms customization.</p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200/80 space-y-8">
                                    {/* TOP ACTION BAR */}
                                    <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200">
                                        <h4 className="font-black text-xs uppercase tracking-wider text-stone-500 mb-3">Top Action Bar (Present on all tabs)</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-stone-700">
                                            <div className="p-3 bg-white rounded-xl border border-stone-200">
                                                <strong className="block text-stone-900 mb-1">🔗 Copy Link</strong>
                                                Copies the client-facing interactive menu URL to clipboard for WhatsApp or Email.
                                            </div>
                                            <div className="p-3 bg-white rounded-xl border border-stone-200">
                                                <strong className="block text-stone-900 mb-1">👁️ Client Preview Toggle</strong>
                                                Allows admin to switch the preview to client mode (hiding admin checkboxes, delete icons, and edit fields).
                                            </div>
                                            <div className="p-3 bg-white rounded-xl border border-stone-200">
                                                <strong className="block text-stone-900 mb-1">🔒 Menu Lock Switch</strong>
                                                Toggle switch to lock or unlock client dish modification in real time.
                                            </div>
                                            <div className="p-3 bg-white rounded-xl border border-stone-200">
                                                <strong className="block text-stone-900 mb-1">💾 Save Quotation</strong>
                                                Prompts for a revision note and actor name; records a version snapshot and updates the database.
                                            </div>
                                            <div className="p-3 bg-white rounded-xl border border-stone-200">
                                                <strong className="block text-stone-900 mb-1">📜 Version History</strong>
                                                Shows a drawer of all previous revisions, change notes, and offers one-click Rollback.
                                            </div>
                                            <div className="p-3 bg-white rounded-xl border border-stone-200">
                                                <strong className="block text-stone-900 mb-1">📄 Word & PDF Buttons</strong>
                                                Triggers clean instant downloads of the quotation document.
                                            </div>
                                        </div>
                                    </div>

                                    {/* TAB 1: SETTINGS */}
                                    <div className="border-l-4 border-blue-500 pl-4 py-1 space-y-3">
                                        <span className="bg-blue-100 text-blue-800 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded">Tab 1: Settings (Event Logistics & Client CRM)</span>
                                        <p className="text-sm text-stone-700 leading-relaxed">
                                            Here you manage all venue coordinates, event dates, point of contact, and client invoicing details:
                                        </p>
                                        <ul className="text-xs sm:text-sm text-stone-600 space-y-2 pl-4 list-disc">
                                            <li><strong>Interactive Map Search (Leaflet/OpenStreetMap)</strong>: Type any hotel, hall, or landmark name. Selecting it automatically fills the Full Address, City, State, Pin Code, and generates a clickable Google Maps link!</li>
                                            <li><strong>Event Date & Duration</strong>: Changing the start or end date automatically recalculates the total number of event days.</li>
                                            <li><strong>Client Profile & GSTIN</strong>: Entity name, GST number, contact person, mobile, and email. Updates sync directly to the client directory.</li>
                                        </ul>
                                    </div>

                                    {/* TAB 2: SESSIONS */}
                                    <div className="border-l-4 border-purple-500 pl-4 py-1 space-y-3">
                                        <span className="bg-purple-100 text-purple-800 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded">Tab 2: Sessions (Meal Sessions & Food Categorization)</span>
                                        <p className="text-sm text-stone-700 leading-relaxed">
                                            Where client choices or admin meal sessions are organized into days and meals:
                                        </p>
                                        <ul className="text-xs sm:text-sm text-stone-600 space-y-2 pl-4 list-disc">
                                            <li><strong>Meal Sessions</strong>: Represents each meal (e.g. Day 1 Breakfast, Day 1 Lunch, Day 2 High Tea).</li>
                                            <li><strong>Station Grouping</strong>: Items are smartly clustered by station (e.g., Assorted Dosa, Idli, Sambar, Chutneys, Desserts, Custom Requests).</li>
                                            <li><strong>Move Up / Move Down (▲/▼)</strong>: Allows you to re-order the chronological sequence of meals anytime.</li>
                                            <li><strong>+ Add Session</strong>: Insert custom meal sessions or day combinations.</li>
                                            <li><strong>Assign Selected Items Button</strong>: Transfers the selected food items into the Tab 3 pricing calculator.</li>
                                        </ul>
                                    </div>

                                    {/* TAB 3: QUOTE */}
                                    <div className="border-l-4 border-amber-600 pl-4 py-1 space-y-3">
                                        <span className="bg-amber-100 text-amber-900 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded">Tab 3: Quote (Live Document Math & Customization)</span>
                                        <p className="text-sm text-stone-700 leading-relaxed">
                                            The finalized document view that matches the generated PDF and Word document:
                                        </p>
                                        <ul className="text-xs sm:text-sm text-stone-600 space-y-2 pl-4 list-disc">
                                            <li><strong>Headcount (PAX) & Price Per Plate</strong>: Inline number boxes next to each session. Subtotal updates dynamically: <code>Pax × Price Per Plate</code>.</li>
                                            <li><strong>Financial Summary</strong>: Automatically computes Grand Total, 18% GST (CGST/SGST or IGST), and Final Payable Amount.</li>
                                            <li><strong>Terms & Conditions Customizer</strong>: Checkboxes to turn individual clauses on/off, click any sentence to edit inline, <code>+ Add Condition</code> button, and <code>✕</code> to delete.</li>
                                            <li><strong>Bank Details Card</strong>: Displays the official Rameshwaram Cafe bank account details configured in Settings.</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 4: ANNEXURE C & EXPORTS */}
                            <section id="annexure-c" className="scroll-mt-24 lg:scroll-mt-8">
                                <div className="flex items-center gap-3.5 mb-5">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl shadow-inner shrink-0">📄</div>
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">4. Annexure C & PDF / Word Document Exports</h2>
                                        <p className="text-xs sm:text-sm text-stone-500">Everything about meal extension charges, export options, and clean PDF pagination.</p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200/80 space-y-6">
                                    <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-2">Annexure C - Event Timings & Extension Charges</h3>
                                    <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
                                        Annexure C specifies standard meal serving durations and hourly extension fees (e.g. Breakfast 7–11 AM @ ₹50,000/hr). You now have 100% control over this section:
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <strong className="block text-stone-900 font-bold text-sm mb-1">🔘 Include / Exclude Toggle</strong>
                                            <p className="text-xs text-stone-600 leading-relaxed">
                                                Switch between <em>Included in Quote</em> and <em>Excluded from Quote</em>. When turned off, Annexure C is completely omitted from both the PDF, the Word document, and the client preview.
                                            </p>
                                        </div>

                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <strong className="block text-stone-900 font-bold text-sm mb-1">✏️ Inline Table Editing</strong>
                                            <p className="text-xs text-stone-600 leading-relaxed">
                                                Click any cell to edit Meal Type (e.g. Breakfast), Timings (e.g. 8:00 AM - 12:00 PM), or Extension Charges (₹/Hour).
                                            </p>
                                        </div>

                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <strong className="block text-stone-900 font-bold text-sm mb-1">➕ Add Custom Meal Row</strong>
                                            <p className="text-xs text-stone-600 leading-relaxed">
                                                Click <code>+ Add Row</code> to append extra sessions like "Midnight Snacks" or "Cocktail Hour" with specific extension charges.
                                            </p>
                                        </div>

                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <strong className="block text-stone-900 font-bold text-sm mb-1">🔄 Reset Defaults</strong>
                                            <p className="text-xs text-stone-600 leading-relaxed">
                                                Accidentally changed rows? Click "Reset Defaults" to restore the standard 4 meal slots (Breakfast, Lunch, High Tea, Dinner) in 1 click.
                                            </p>
                                        </div>
                                    </div>

                                    {/* HOW PDF EXTRA PAGES WERE FIXED */}
                                    <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-3">
                                        <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                                            <span>🖨️</span> PDF Auto-Pagination & Clean Spacing
                                        </h4>
                                        <p className="text-xs text-stone-600 leading-relaxed">
                                            The PDF generator utilizes native <code>jsPDF</code> and <code>jspdf-autotable</code> with pre-flight height detection. It automatically checks remaining vertical space before rendering each session. If a session table cannot fit on the current page, the system breaks to a new page <em>before</em> drawing the header, guaranteeing that <strong>session headers are never orphaned alone at the bottom of a blank page</strong>.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 5: CLIENT MENU */}
                            <section id="client-menu" className="scroll-mt-24 lg:scroll-mt-8">
                                <div className="flex items-center gap-3.5 mb-5">
                                    <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center text-xl shadow-inner shrink-0">📱</div>
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">5. Client Menu Wizard & Locking Mechanism</h2>
                                        <p className="text-xs sm:text-sm text-stone-500">The mobile-friendly portal where clients pick their catering menu.</p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200/80 space-y-6">
                                    <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
                                        When you click <strong>"🔗 Copy Link"</strong> on any event, you get a unique shareable link (e.g. <code>/client-menu/[id]</code>). The client opens this link on their mobile or computer to select their food items.
                                    </p>

                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
                                            <div className="text-xs sm:text-sm text-stone-700">
                                                <strong>Category & Station Hierarchy</strong>: Clients browse through Clean Accordion sections (Welcome Drinks, Live Dosas, South Indian Rice Meals, Desserts).
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
                                            <div className="text-xs sm:text-sm text-stone-700">
                                                <strong>Auto-Save Local Storage Cache</strong>: If the client accidentally closes their mobile browser or loses network connection, their selections are cached and restored automatically upon reopening.
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</span>
                                            <div className="text-xs sm:text-sm text-stone-700">
                                                <strong>Confirm Final Menu Button</strong>: Located at the bottom. When pressed, choices sync to the cloud and lock the wizard so no accidental changes occur.
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                                            <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">4</span>
                                            <div className="text-xs sm:text-sm text-amber-950">
                                                <strong>⚡ One-Click Menu Import for Customers</strong>: Customers can choose an Admin-curated package (e.g. <em>"Traditional South Indian Breakfast"</em> or <em>"South Indian Meals"</em>) with 1 click to auto-populate all dishes for that meal session. All dishes remain 100% customizable if the client wants to tweak anything.
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <span className="w-6 h-6 rounded-full bg-stone-200 text-stone-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">5</span>
                                            <div className="text-xs sm:text-sm text-stone-700">
                                                <strong>Admin Menu Lock Override</strong>: Admins can toggle the <em>"Menu Lock"</em> switch anytime from the Dashboard or Quotation Builder to allow edits again or immediately freeze changes.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 6: CALENDAR */}
                            <section id="calendar" className="scroll-mt-24 lg:scroll-mt-8">
                                <div className="flex items-center gap-3.5 mb-5">
                                    <div className="w-10 h-10 rounded-2xl bg-yellow-100 text-yellow-700 flex items-center justify-center text-xl shadow-inner shrink-0">📅</div>
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">6. Calendar & Filtered Print / Export Center</h2>
                                        <p className="text-xs sm:text-sm text-stone-500">Visual monthly calendar with multi-criteria export to Word (.docx) and PDF.</p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200/80 space-y-6">
                                    <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
                                        The Calendar page provides a monthly birds-eye view of all bookings, catering dates, and overlapping schedules with color-coded event bars:
                                        <span className="inline-flex items-center gap-1.5 ml-2 mr-2 font-bold text-xs"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Confirmed</span>
                                        <span className="inline-flex items-center gap-1.5 mr-2 font-bold text-xs"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Draft</span>
                                        <span className="inline-flex items-center gap-1.5 font-bold text-xs"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Cancelled</span>.
                                    </p>

                                    {/* PRINT / EXPORT FEATURE EXPLAINED */}
                                    <div className="p-5 bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-2xl shadow-md space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-black text-sm uppercase tracking-wider text-amber-400">🖨️ "Print / Export" Modal Features</h4>
                                            <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30">New Feature</span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                                            Click the <strong>"🖨️ Print / Export"</strong> button in the calendar header to open the filtered report generator:
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                            <div className="p-3 bg-white/10 rounded-xl border border-white/10">
                                                <strong className="block text-amber-300 mb-1">📅 Date Range Filter</strong>
                                                Select custom From & To dates, or click quick buttons: <em>"This Month"</em> or <em>"Next 30 Days"</em>.
                                            </div>
                                            <div className="p-3 bg-white/10 rounded-xl border border-white/10">
                                                <strong className="block text-amber-300 mb-1">📊 Status Filter</strong>
                                                Filter by <em>All</em>, <em>Confirmed Only</em>, or <em>Pending / Draft</em>.
                                            </div>
                                            <div className="p-3 bg-white/10 rounded-xl border border-white/10">
                                                <strong className="block text-amber-300 mb-1">👤 Client Filter</strong>
                                                Filter across <em>All Clients</em> or isolate events for a specific corporate account.
                                            </div>
                                            <div className="p-3 bg-white/10 rounded-xl border border-white/10">
                                                <strong className="block text-amber-300 mb-1">📄 Word & PDF Export</strong>
                                                Generates clean branded table documents (.docx or .pdf) with live print preview.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 7: CLIENT DIRECTORY */}
                            <section id="clients" className="scroll-mt-24 lg:scroll-mt-8">
                                <div className="flex items-center gap-3.5 mb-5">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl shadow-inner shrink-0">👥</div>
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">7. Client Directory & Excel (.xlsx) Export</h2>
                                        <p className="text-xs sm:text-sm text-stone-500">Managing client records, GST compliance, and exporting to spreadsheets.</p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200/80 space-y-6">
                                    <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
                                        The Client Directory stores client organizations, invoicing addresses, phone numbers, and GSTIN records.
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                                            <strong className="block text-stone-900 font-bold text-sm">📊 Export to Excel (.xlsx)</strong>
                                            <p className="text-xs text-stone-600 leading-relaxed">
                                                Click the <strong>"🖨️ Print / Export"</strong> button in the clients list. You can select exactly which columns to export (Entity Name, GSTIN, Contact Person, Mobile, Email, Address, City/State) and download a true Microsoft Excel spreadsheet.
                                            </p>
                                        </div>

                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                                            <strong className="block text-stone-900 font-bold text-sm">🏛️ Automatic GST Classification</strong>
                                            <p className="text-xs text-stone-600 leading-relaxed">
                                                If the client's state is Karnataka, the system calculates <strong>CGST 9% + SGST 9%</strong>. If the client is outside Karnataka, it automatically applies <strong>IGST 18%</strong>.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 8: MENU MANAGER */}
                            <section id="menu-manager" className="scroll-mt-24 lg:scroll-mt-8">
                                <div className="flex items-center gap-3.5 mb-5">
                                    <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-xl shadow-inner shrink-0">🍽️</div>
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">8. Menu Master Library</h2>
                                        <p className="text-xs sm:text-sm text-stone-500">The 3-tier master database powering all quotation menus.</p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200/80 space-y-6">
                                    <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
                                        Every dish in the platform follows a strict 3-tier hierarchy:
                                    </p>

                                    <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left text-xs sm:text-sm">
                                        <div className="p-3 bg-stone-100 rounded-xl border border-stone-300 font-bold text-stone-900 flex-1 w-full">
                                            1. Category (e.g. Breakfast, High Tea)
                                        </div>
                                        <span className="text-stone-400 font-bold">➔</span>
                                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 font-bold text-amber-900 flex-1 w-full">
                                            2. Station (e.g. Live Dosa Counter)
                                        </div>
                                        <span className="text-stone-400 font-bold">➔</span>
                                        <div className="p-3 bg-stone-100 rounded-xl border border-stone-300 font-bold text-stone-900 flex-1 w-full">
                                            3. Item (e.g. Ghee Pudi Masala Dosa)
                                        </div>
                                    </div>

                                    <ul className="text-xs sm:text-sm text-stone-600 space-y-2 list-disc pl-4 leading-relaxed">
                                        <li><strong>+ Add Category / Station / Item</strong>: Simple buttons to expand the culinary repertoire.</li>
                                        <li><strong>Sort Order Reordering</strong>: Adjust order indices so high-priority dishes appear first in client menus.</li>
                                        <li><strong>Deletion Safety</strong>: Always exercise caution before deleting items that may already be selected in past quotations.</li>
                                    </ul>

                                    {/* ADMIN ONE-CLICK PRESET PACKAGES */}
                                    <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-black text-sm uppercase tracking-wider text-amber-950 flex items-center gap-2">
                                                <span>⚡</span> Tab 2: One-Click Menu Presets (Customer Import Packages)
                                            </h4>
                                            <span className="bg-amber-200 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded border border-amber-300">Admin Control</span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-amber-950/80 leading-relaxed">
                                            Admins have dedicated controls to create and manage the 1-click preset packages that customers see in the client menu selection portal:
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                            <div className="p-3 bg-white rounded-xl border border-amber-200/80">
                                                <strong className="block text-amber-950 mb-1">📦 Curate Dishes Multi-Picker</strong>
                                                Multi-select exact dishes from the master menu library grouped by Category & Station, with <em>"Select All"</em> per counter.
                                            </div>
                                            <div className="p-3 bg-white rounded-xl border border-amber-200/80">
                                                <strong className="block text-amber-950 mb-1">🏷️ Meal Category Tagging</strong>
                                                Tag presets as <em>BREAKFAST, LUNCH, HI-TEA, DINNER, MEALS, or ALL</em> so the client wizard prioritizes relevant packages for each session.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 9: SETTINGS */}
                            <section id="settings" className="scroll-mt-24 lg:scroll-mt-8">
                                <div className="flex items-center gap-3.5 mb-5">
                                    <div className="w-10 h-10 rounded-2xl bg-stone-200 text-stone-700 flex items-center justify-center text-xl shadow-inner shrink-0">⚙️</div>
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">9. Settings, Bank Details & Role Permissions</h2>
                                        <p className="text-xs sm:text-sm text-stone-500">Configuring brand details, bank accounts, automated reminders, and user access.</p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200/80 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <h4 className="font-bold text-stone-900 text-sm mb-1">🏦 General & Bank Info</h4>
                                            <p className="text-xs text-stone-600 leading-relaxed">
                                                Account Holder, Bank Name, A/C Number, IFSC Code, and Branch. This data directly populates the Bank Details table in all PDF and Word quotations.
                                            </p>
                                        </div>

                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <h4 className="font-bold text-stone-900 text-sm mb-1">⏰ Automated Reminders</h4>
                                            <p className="text-xs text-stone-600 leading-relaxed">
                                                Turn Email & WhatsApp reminder automation on/off and configure how many days prior to an event client notifications should trigger.
                                            </p>
                                        </div>

                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                            <h4 className="font-bold text-stone-900 text-sm mb-1">🛡️ User Roles & Permissions</h4>
                                            <p className="text-xs text-stone-600 leading-relaxed">
                                                Admins can create staff accounts and toggle granular checkboxes (Access Dashboard, Menu, Clients, Calendar, Settings, Quotations).
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 10: VERSIONS & AUDIT */}
                            <section id="versions-audit" className="scroll-mt-24 lg:scroll-mt-8">
                                <div className="flex items-center gap-3.5 mb-5">
                                    <div className="w-10 h-10 rounded-2xl bg-cyan-100 text-cyan-800 flex items-center justify-center text-xl shadow-inner shrink-0">📜</div>
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">10. Quotation Version Control & Audit Trail</h2>
                                        <p className="text-xs sm:text-sm text-stone-500">Tracking every price change, author reason, and instant rollback safety.</p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200/80 space-y-6">
                                    <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
                                        Whenever you click <strong>Save Quotation</strong>, the system requires a <em>Reason for Revision</em> (e.g., "Client increased PAX from 100 to 150"). It then saves an immutable snapshot of all selections, prices, terms, and Annexure C settings.
                                    </p>

                                    <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                                        <strong className="block text-stone-900 font-bold text-sm">⏮️ How Rollback / Version Restore Works</strong>
                                        <p className="text-xs text-stone-600 leading-relaxed">
                                            Click the <strong>"📜 Version History"</strong> button in any quotation. You will see a chronological timeline of every version (v1, v2, v3...). If a client changes their mind and wants an older menu configuration, click <strong>"Restore this Version"</strong>. The system instantly rolls back the items, headcount, prices, and Annexure C rows, while recording a clear audit log entry.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 11: FAQ & QUICK REFERENCE */}
                            <section id="faq" className="scroll-mt-24 lg:scroll-mt-8">
                                <div className="flex items-center gap-3.5 mb-5">
                                    <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center text-xl shadow-inner shrink-0">💡</div>
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">11. Frequently Asked Questions & Pro-Tips</h2>
                                        <p className="text-xs sm:text-sm text-stone-500">Quick answers to common questions and edge cases.</p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200/80 space-y-4">
                                    <details className="p-4 bg-stone-50 rounded-2xl border border-stone-200 group cursor-pointer">
                                        <summary className="font-bold text-stone-900 text-sm flex items-center justify-between">
                                            <span>How do I remove Annexure C if the client doesn't need extension charges?</span>
                                            <span className="text-stone-400 group-open:rotate-180 transition-transform">▼</span>
                                        </summary>
                                        <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                                            Go to the Quotation Builder ➔ <strong>Quote tab</strong> ➔ Scroll to Annexure C. Uncheck the <strong>"Included in Quote"</strong> toggle switch. It will now say "Excluded from Quote" and will be completely removed from the PDF, Word document, and client preview.
                                        </p>
                                    </details>

                                    <details className="p-4 bg-stone-50 rounded-2xl border border-stone-200 group cursor-pointer">
                                        <summary className="font-bold text-stone-900 text-sm flex items-center justify-between">
                                            <span>Why does the client say their menu link is locked?</span>
                                            <span className="text-stone-400 group-open:rotate-180 transition-transform">▼</span>
                                        </summary>
                                        <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                                            A menu locks automatically once the client clicks "Confirm Final Menu", or when an admin flips the <strong>Menu Lock</strong> switch on the dashboard. To allow the client to edit again, simply toggle the <strong>Menu Lock</strong> switch to OFF in the dashboard or quotation top bar.
                                        </p>
                                    </details>

                                    <details className="p-4 bg-stone-50 rounded-2xl border border-stone-200 group cursor-pointer">
                                        <summary className="font-bold text-stone-900 text-sm flex items-center justify-between">
                                            <span>How do I export this month's confirmed events to Word or PDF?</span>
                                            <span className="text-stone-400 group-open:rotate-180 transition-transform">▼</span>
                                        </summary>
                                        <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                                            Go to <strong>Calendar</strong> ➔ Click <strong>"🖨️ Print / Export"</strong> in the header ➔ Choose <em>"This Month"</em> ➔ Under Status, select <em>"Confirmed"</em> ➔ Click <strong>"📄 Export to Word"</strong> or <strong>"🖨️ Print / PDF"</strong>.
                                        </p>
                                    </details>

                                    <details className="p-4 bg-stone-50 rounded-2xl border border-stone-200 group cursor-pointer">
                                        <summary className="font-bold text-stone-900 text-sm flex items-center justify-between">
                                            <span>Why did the PDF generate without extra blank pages?</span>
                                            <span className="text-stone-400 group-open:rotate-180 transition-transform">▼</span>
                                        </summary>
                                        <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                                            We optimized the PDF generator with compact brand typography, 38 mm logo sizing, and intelligent pre-flight height detection. The system checks page height before rendering each session, guaranteeing session titles never get orphaned alone at the bottom of a page.
                                        </p>
                                    </details>
                                </div>
                            </section>

                        </div>

                    </div>
                </div>

                {/* DESKTOP SIDEBAR TABLE OF CONTENTS */}
                <div className="hidden lg:block w-72 xl:w-80 bg-white border-l border-stone-200 shadow-[-5px_0_25px_rgba(0,0,0,0.02)] shrink-0 z-10">
                    <div className="p-6 sticky top-0 max-h-screen overflow-y-auto">
                        <div className="flex items-center justify-between mb-4 border-b border-stone-100 pb-3">
                            <h3 className="text-[11px] font-black text-stone-400 uppercase tracking-widest">Table of Contents</h3>
                            <span className="text-[10px] bg-stone-100 text-stone-600 font-bold px-2 py-0.5 rounded">11 Sections</span>
                        </div>
                        <nav className="space-y-1">
                            {sections.map(sec => (
                                <button
                                    key={sec.id}
                                    onClick={() => handleScrollTo(sec.id)}
                                    className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all duration-150 font-bold text-xs flex items-center gap-2.5 ${activeSection === sec.id
                                        ? 'bg-amber-100/70 text-amber-950 shadow-sm border border-amber-300/60'
                                        : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900 border border-transparent'
                                        }`}
                                >
                                    <span className="text-sm shrink-0">{sec.icon}</span>
                                    <span className="truncate">{sec.title}</span>
                                </button>
                            ))}
                        </nav>

                        {/* QUICK HELP WIDGET */}
                        <div className="mt-8 p-4 bg-stone-50 rounded-2xl border border-stone-200 text-xs space-y-2">
                            <span className="font-bold text-stone-900 block">Need assistance?</span>
                            <p className="text-stone-500 text-[11px] leading-relaxed">
                                For administrative inquiries or urgent permission resets, contact your system administrator.
                            </p>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    )
}
