'use client'
import AppSidebar from '@/app/components/AppSidebar'
import { useState, useEffect } from 'react'

export default function GettingStartedPage() {
    const [activeSection, setActiveSection] = useState('welcome')

    const sections = [
        { id: 'welcome', title: '1. The Big Picture', icon: '🌟' },
        { id: 'dashboard', title: '2. Dashboard Overview', icon: '📊' },
        { id: 'new-event', title: '3. Creating an Event', icon: '➕' },
        { id: 'client-menu', title: '4. Client Menu Wizard', icon: '📝' },
        { id: 'builder', title: '5. Quotation Builder', icon: '🏗️' },
        { id: 'menu-manager', title: '6. Menu Manager', icon: '🍽️' },
        { id: 'clients', title: '7. Client Directory', icon: '👥' },
        { id: 'calendar', title: '8. Calendar', icon: '📅' },
        { id: 'settings', title: '9. Settings & Roles', icon: '⚙️' },
    ]

    // Intersection Observer to highlight active sidebar link based on scroll
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id)
                }
            })
        }, { rootMargin: '-20% 0px -60% 0px' })

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
        <div className="flex h-screen bg-[#F3F4F6] font-sans overflow-hidden">
            <AppSidebar />

            <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

                {/* MOBILE TOC DROPDOWN */}
                <div className="lg:hidden bg-white border-b border-gray-200 p-4 sticky top-0 z-20 shrink-0 mt-16 shadow-sm">
                    <select
                        className="w-full bg-gray-50 border border-gray-200 p-3 rounded-lg text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
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
                    <div className="max-w-5xl mx-auto p-5 sm:p-8 lg:p-12 xl:p-16 pb-32">

                        {/* HEADER */}
                        <div className="mb-12 sm:mb-16 mt-6 sm:mt-8 lg:mt-0">
                            <h1 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tight mb-4 text-balance">
                                Official Software Manual
                            </h1>
                            <p className="text-lg sm:text-xl text-gray-500 font-medium leading-relaxed max-w-2xl text-balance">
                                The comprehensive guide explaining exactly every button and workflow inside the Quotation System app.
                            </p>
                        </div>

                        {/* CONTENT BLOCKS */}
                        <div className="space-y-16 lg:space-y-24">

                            {/* SECTION 1: WELCOME */}
                            <section id="welcome" className="scroll-mt-24 lg:scroll-mt-10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl sm:text-2xl shadow-inner shrink-0">🌟</div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900">1. The Big Picture</h2>
                                </div>
                                <div className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl shadow-slate-200/50 border border-gray-100 feature-card">
                                    <h3 className="text-sm border-b border-slate-100 pb-2 font-black text-indigo-600 uppercase tracking-widest mb-4">The Correct Workflow:</h3>
                                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-8 text-balance">
                                        Understanding the core sequence of operations is vital to utilizing the platform correctly. The system expects you to gather client input <strong>before</strong> generating the final math.
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                                        <div className="bg-slate-50 px-4 py-5 rounded-xl border border-slate-200 text-center relative overflow-hidden flex flex-col items-center justify-center shadow-sm">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Step 1</div>
                                            <div className="font-bold text-slate-700 text-sm xl:text-base leading-snug">Create Event</div>
                                        </div>
                                        <div className="bg-blue-50 px-4 py-5 rounded-xl border border-blue-200 text-center relative overflow-hidden flex flex-col items-center justify-center shadow-sm">
                                            <div className="hidden lg:flex absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full items-center justify-center text-blue-300 font-bold border border-blue-100 z-10 text-[10px]">➔</div>
                                            <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Step 2</div>
                                            <div className="font-bold text-blue-700 text-sm xl:text-base leading-snug">Client Selects Menu</div>
                                        </div>
                                        <div className="bg-slate-50 px-4 py-5 rounded-xl border border-slate-200 text-center relative overflow-hidden flex flex-col items-center justify-center shadow-sm">
                                            <div className="hidden lg:flex absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full items-center justify-center text-slate-300 font-bold border border-slate-200 z-10 text-[10px]">➔</div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Step 3</div>
                                            <div className="font-bold text-slate-700 text-sm xl:text-base leading-snug">Quote Built</div>
                                        </div>
                                        <div className="bg-emerald-50 px-4 py-5 rounded-xl border border-emerald-200 text-center relative overflow-hidden flex flex-col items-center justify-center shadow-sm">
                                            <div className="hidden lg:flex absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full items-center justify-center text-emerald-300 font-bold border border-emerald-100 z-10 text-[10px]">➔</div>
                                            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5">Step 4</div>
                                            <div className="font-bold text-emerald-700 text-sm xl:text-base leading-snug">Generate PDF</div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 2: DASHBOARD */}
                            <section id="dashboard" className="scroll-mt-24 lg:scroll-mt-10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center text-xl sm:text-2xl shadow-inner shrink-0">📊</div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900">2. Dashboard Overview</h2>
                                </div>
                                <div className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl shadow-slate-200/50 border border-gray-100 feature-card">
                                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-8">
                                        The Dashboard is your main landing page. It displays metric cards (Total Events, Confirmed Revenue) and a sortable table of your recent events.
                                    </p>
                                    <h3 className="text-sm border-b border-slate-100 pb-2 font-black text-slate-400 uppercase tracking-widest mb-6">Action & Button Explanations</h3>

                                    <ul className="space-y-4 mb-8 text-[15px]">
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100 transition hover:bg-white hover:border-blue-100 hover:shadow-sm">
                                            <div className="font-black text-blue-600 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">+ Create New Event</div>
                                            <div className="text-gray-600 leading-relaxed text-sm sm:text-base">Opens the modal to initialize a brand new drafted event and insert it into the database.</div>
                                        </li>
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100 transition hover:bg-white hover:border-blue-100 hover:shadow-sm">
                                            <div className="font-black text-gray-900 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">Open Quote</div>
                                            <div className="text-gray-600 leading-relaxed text-sm sm:text-base">The primary blue button on each table row. Clicking this launches the Quotation Builder for that specific event.</div>
                                        </li>
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-4 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100 transition hover:bg-white hover:border-blue-100 hover:shadow-sm">
                                            <div className="font-black text-gray-900 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">Action Menu (⋮)</div>
                                            <div className="text-gray-600 flex flex-col gap-4 leading-relaxed text-sm sm:text-base">
                                                <div className="grid grid-cols-[140px_1fr] md:grid-cols-[160px_1fr] gap-3 sm:gap-4 items-start border-b border-gray-100/50 pb-3">
                                                    <strong className="text-gray-900 flex items-center gap-2"><span className="text-lg">👁️</span> Preview Menu:</strong>
                                                    <span>Navigates you to the public-facing Client Wizard to see what the client sees.</span>
                                                </div>
                                                <div className="grid grid-cols-[140px_1fr] md:grid-cols-[160px_1fr] gap-3 sm:gap-4 items-start border-b border-gray-100/50 pb-3">
                                                    <strong className="text-gray-900 flex items-center gap-2"><span className="text-lg">✏️</span> Edit Details:</strong>
                                                    <span>Transports you directly into the Quote Builder's <em>Settings</em> tab.</span>
                                                </div>
                                                <div className="grid grid-cols-[140px_1fr] md:grid-cols-[160px_1fr] gap-3 sm:gap-4 items-start">
                                                    <strong className="text-emerald-600 flex items-center gap-2"><span className="text-lg">✅</span> Confirm / ⛔:</strong>
                                                    <span>Hard-toggles the lifecycle status of the quotation mapping.</span>
                                                </div>
                                            </div>
                                        </li>
                                    </ul>
                                    <div className="w-full mt-8 rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                                        <img src="/docs_dashboard.png" alt="Dashboard View" className="w-full h-auto object-cover" />
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 3: CREATING EVENT */}
                            <section id="new-event" className="scroll-mt-24 lg:scroll-mt-10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl sm:text-2xl shadow-inner shrink-0">➕</div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900">3. Creating a New Event</h2>
                                </div>
                                <div className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl shadow-slate-200/50 border border-gray-100 feature-card">
                                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-8">
                                        Triggered by the Dashboard button, this modal collects the absolute minimum requirements to register an event in the system.
                                    </p>
                                    <h3 className="text-sm border-b border-slate-100 pb-2 font-black text-slate-400 uppercase tracking-widest mb-6">Input Explanations</h3>

                                    <ul className="space-y-4 mb-8 text-[15px]">
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                                            <div className="font-bold text-gray-900 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">Client Search</div>
                                            <div className="text-gray-600 leading-relaxed text-sm sm:text-base">You can type to search existing clients. Selecting one auto-fills the Name, Email, and Phone fields to prevent duplication.</div>
                                        </li>
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                                            <div className="font-bold text-gray-900 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">Email Fields</div>
                                            <div className="text-gray-600 leading-relaxed text-sm sm:text-base">Both the Client Email and POC (Point of Contact) Email are rigorously required parameters.</div>
                                        </li>
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-blue-50/50 border-blue-100 rounded-2xl border">
                                            <div className="font-bold text-blue-700 border-b border-blue-200 pb-2 sm:border-none sm:pb-0">Save Event</div>
                                            <div className="text-blue-900/80 leading-relaxed text-sm sm:text-base">Validates the form. If everything is filled out, this button commits the event to the database and teleports you into the Quote Builder. If data is missing, a red error banner will stop submission.</div>
                                        </li>
                                    </ul>
                                    <div className="w-full mt-8 rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                                        <img src="/docs_create_modal.png" alt="Create Event Modal" className="w-full h-auto object-cover" />
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 4: CLIENT MENU WIZARD */}
                            <section id="client-menu" className="scroll-mt-24 lg:scroll-mt-10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-xl sm:text-2xl shadow-inner shrink-0">📝</div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900">4. Client Menu Wizard</h2>
                                </div>
                                <div className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl shadow-slate-200/50 border border-gray-100 feature-card relative overflow-hidden">
                                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-orange-50 rounded-full blur-3xl opacity-50 pointer-events-none hidden sm:block"></div>

                                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-8 relative z-10">
                                        This is the core differentiator of the platform. Instead of emailing spreadsheets back and forth, you generate an interactive URL that clients use to digitally select their desired food items.
                                    </p>

                                    <h3 className="text-sm border-b border-slate-100 pb-2 font-black text-slate-400 uppercase tracking-widest mb-6 relative z-10">How It Works</h3>
                                    <ul className="space-y-4 mb-8 text-[15px] relative z-10 text-gray-700">
                                        <li className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                                            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm shrink-0 border border-orange-200">1</div>
                                            <span className="leading-relaxed text-sm sm:text-base mt-1">The client opens the shared link on their mobile or desktop device. The UI lists Category blocks (like "Welcome Drink") grouping various Stations and Items.</span>
                                        </li>
                                        <li className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                                            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm shrink-0 border border-orange-200">2</div>
                                            <span className="leading-relaxed text-sm sm:text-base mt-1">Clicking an item highlights it securely. The system leverages browser local storage caching—so if the client accidentally refreshes their phone, their selections are restored automatically.</span>
                                        </li>
                                        <li className="flex items-start gap-4 p-4 border border-emerald-100 rounded-xl bg-emerald-50/30">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200">3</div>
                                            <span className="leading-relaxed text-sm sm:text-base mt-1"><strong className="text-emerald-800 block mb-1">Confirm Final Menu</strong> Found at the very bottom. Once clicked, their choices upload to the Cloud, and the entire page locks down protecting against further modifications.</span>
                                        </li>
                                    </ul>
                                    <div className="w-full max-w-sm mx-auto mt-10 rounded-[2rem] overflow-hidden shadow-2xl border-[12px] border-slate-900 relative z-10">
                                        <img src="/docs_client_menu.png" alt="Client Menu Mobile View" className="w-full h-auto object-cover" />
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 5: QUOTATION BUILDER */}
                            <section id="builder" className="scroll-mt-24 lg:scroll-mt-10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center text-xl sm:text-2xl shadow-inner shrink-0">🏗️</div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900">5. Quotation Builder</h2>
                                </div>
                                <div className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl shadow-slate-200/50 border border-gray-100 feature-card">
                                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-8">
                                        This is your mission control for finalizing event math and generating documents. It is divided into Three distinctive Tabs.
                                    </p>

                                    <div className="space-y-6">
                                        <div className="p-5 sm:p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                                            <h4 className="font-black text-gray-900 mb-4 uppercase tracking-wider text-xs border-b border-gray-200 pb-3">Top Action Bar (Always Visible)</h4>
                                            <ul className="space-y-4 text-[15px] text-gray-700">
                                                <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2 sm:gap-6 items-start sm:items-center">
                                                    <div><strong className="text-black bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm text-sm whitespace-nowrap">📝 Copy Link</strong></div>
                                                    <div className="text-sm sm:text-base leading-relaxed">Copies the custom URL layout into your clipboard so you can manually paste it into WhatsApp or Email.</div>
                                                </li>
                                                <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2 sm:gap-6 items-start sm:items-center pt-2 sm:pt-0">
                                                    <div><strong className="text-black bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm text-sm whitespace-nowrap">Word 📄 / PDF 🖨️</strong></div>
                                                    <div className="text-sm sm:text-base leading-relaxed">Generates beautifully paginated print documents. Do NOT press these until you have clicked "Update Quote Categories" in Tab 3.</div>
                                                </li>
                                            </ul>
                                        </div>

                                        <div className="p-5 sm:p-6 bg-blue-50 border border-blue-200 rounded-2xl">
                                            <h4 className="font-black text-blue-900 mb-1">Tab 1: Settings</h4>
                                            <p className="text-sm text-blue-700 font-medium mb-4 pb-3 border-b border-blue-200/50">Manages Logistics and GST.</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] md:grid-cols-[200px_1fr] gap-2 sm:gap-6 font-medium text-[15px] text-blue-900/80 items-start sm:items-center">
                                                <strong className="text-blue-900 border-b border-blue-200/50 pb-2 sm:border-none sm:pb-0">Save Configuration:</strong>
                                                <span className="text-sm sm:text-base leading-relaxed">Commits your inputted Google Maps URL and selected Transport/Lodging costs securely to the database.</span>
                                            </div>
                                        </div>

                                        <div className="p-5 sm:p-6 bg-purple-50 border border-purple-200 rounded-2xl">
                                            <h4 className="font-black text-purple-900 mb-1">Tab 2: Sessions</h4>
                                            <p className="text-sm text-purple-700 font-medium mb-4 pb-3 border-b border-purple-200/50">Where you witness what the client selected via their Link.</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] md:grid-cols-[200px_1fr] gap-2 sm:gap-6 font-medium text-[15px] text-purple-900/80 items-start sm:items-center">
                                                <strong className="text-purple-900 border-b border-purple-200/50 pb-2 sm:border-none sm:pb-0">Assign Selected Items:</strong>
                                                <span className="text-sm sm:text-base leading-relaxed">This is a critical button. It scrapes the current selections out of this Session view and syncs them directly into the mathematical pipeline in Tab 3. You MUST press this.</span>
                                            </div>
                                        </div>

                                        <div className="p-5 sm:p-6 bg-orange-50 border border-orange-200 rounded-2xl">
                                            <h4 className="font-black text-orange-900 mb-1">Tab 3: Quote</h4>
                                            <p className="text-sm text-orange-700 font-medium mb-5 pb-3 border-b border-orange-200/50">The final math processing layer.</p>
                                            <div className="space-y-4 text-[15px] text-orange-900/80">
                                                <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] md:grid-cols-[200px_1fr] gap-1 sm:gap-6 items-start sm:items-center">
                                                    <strong className="text-orange-900 border-b border-orange-200/50 pb-1 sm:border-none sm:pb-0">The Grid:</strong>
                                                    <span className="text-sm sm:text-base">You enter headcount (PAX) and the negotiated Price Per Plate on the far right inputs alongside the table.</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] md:grid-cols-[200px_1fr] gap-1 sm:gap-6 items-start sm:items-center mt-3 sm:mt-0">
                                                    <strong className="text-orange-900 border-b border-orange-200/50 pb-1 sm:border-none sm:pb-0">Calculate Subtotals:</strong>
                                                    <span className="text-sm sm:text-base">Computes the visual subtotal of (Pax * Price) without saving.</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] md:grid-cols-[200px_1fr] gap-1 sm:gap-6 items-start sm:items-center mt-3 sm:mt-0">
                                                    <strong className="text-orange-900 border-b border-orange-200/50 pb-1 sm:border-none sm:pb-0">Update Math block:</strong>
                                                    <span className="text-sm sm:text-base leading-relaxed">Saves the massive math payload strictly into the remote Postgres database. Doing this unlocks the proper layout rendering for your eventual PDF/Word exports.</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full mt-8 rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                                        <img src="/docs_builder.png" alt="Quotation Builder View" className="w-full h-auto object-cover" />
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 6: MENU MANAGER */}
                            <section id="menu-manager" className="scroll-mt-24 lg:scroll-mt-10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-xl sm:text-2xl shadow-inner shrink-0">🍽️</div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900">6. Menu Manager</h2>
                                </div>
                                <div className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl shadow-slate-200/50 border border-gray-100 feature-card">
                                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-8">
                                        This is the structural backbone of your food library. It employs a 3-tier hierarchy: Category → Station → Item. Every new quotation draws from this master list.
                                    </p>
                                    <h3 className="text-sm border-b border-slate-100 pb-2 font-black text-slate-400 uppercase tracking-widest mb-6">Button Explanations</h3>

                                    <ul className="space-y-4 mb-8 text-[15px]">
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white transition items-center">
                                            <div className="font-bold text-gray-900 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">+ Add Category</div>
                                            <div className="text-gray-600 leading-relaxed text-sm sm:text-base">Creates top-level domains like "Lunch" or "Appetizers" utilizing a modal dropdown.</div>
                                        </li>
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white transition items-center">
                                            <div className="font-bold text-gray-900 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">+ Add Station</div>
                                            <div className="text-gray-600 leading-relaxed text-sm sm:text-base">Added underneath a category. Example: "Live Dosa Counter".</div>
                                        </li>
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white transition items-center">
                                            <div className="font-bold text-gray-900 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">+ Add Item</div>
                                            <div className="text-gray-600 leading-relaxed text-sm sm:text-base">The granular standalone dish: "Masala Dosa".</div>
                                        </li>
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-red-50/50 border-red-100 rounded-2xl border text-red-900/80 items-center">
                                            <div className="font-bold text-red-700 border-b border-red-200 pb-2 sm:border-none sm:pb-0">Trash Iterators</div>
                                            <div className="leading-relaxed text-sm sm:text-base">Triggers an atomic SQL transaction to safely remove items. <em>Warning: Deleting heavily used internal menu items could compromise historical PDFs.</em></div>
                                        </li>
                                    </ul>
                                </div>
                            </section>

                            {/* SECTION 7: CLIENT DIRECTORY */}
                            <section id="clients" className="scroll-mt-24 lg:scroll-mt-10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl sm:text-2xl shadow-inner shrink-0">👥</div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900">7. Client Directory</h2>
                                </div>
                                <div className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl shadow-slate-200/50 border border-gray-100 feature-card">
                                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-8">
                                        The global roll or CRM listing of every single corporate and personal client.
                                    </p>
                                    <h3 className="text-sm border-b border-slate-100 pb-2 font-black text-slate-400 uppercase tracking-widest mb-6">Action & Buttons</h3>

                                    <ul className="space-y-4 mb-8 text-[15px]">
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                                            <div className="font-bold text-gray-900 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">Edit (Pencil)</div>
                                            <div className="text-gray-600 leading-relaxed text-sm sm:text-base">Opens a dedicated right-side panel permitting updates to critical long-term variables including: State drop-downs, GST verification (auto-calculated as CGST+SGST or IGST depending on Karnataka state boundaries), and Contacts.</div>
                                        </li>
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-blue-50/50 rounded-2xl border border-blue-100 items-center">
                                            <div className="font-bold text-blue-700 border-b border-blue-200 pb-2 sm:border-none sm:pb-0">Save Changes</div>
                                            <div className="text-blue-900/80 leading-relaxed text-sm sm:text-base">Flushes the mutated client profile back to the cloud. Note: Updating a client here automatically updates their details across all generated PDF future-prints.</div>
                                        </li>
                                    </ul>
                                </div>
                            </section>

                            {/* SECTION 8: CALENDAR */}
                            <section id="calendar" className="scroll-mt-24 lg:scroll-mt-10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-yellow-100 text-yellow-600 flex items-center justify-center text-xl sm:text-2xl shadow-inner shrink-0">📅</div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900">8. Calendar View</h2>
                                </div>
                                <div className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl shadow-slate-200/50 border border-gray-100 feature-card">
                                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-8">
                                        Visual Gantt chart displaying overlapping event lifespans. Color-coded natively by status.
                                    </p>
                                    <h3 className="text-sm border-b border-slate-100 pb-2 font-black text-slate-400 uppercase tracking-widest mb-6">Interaction Guide</h3>

                                    <ul className="space-y-4 mb-8 text-[15px]">
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100 items-center">
                                            <div className="font-bold text-gray-900 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">Color Chips</div>
                                            <div className="text-gray-600 leading-relaxed text-sm sm:text-base">Green: Confirmed Booking. Yellow: Draft Quotation. Red: Cancelled Status.</div>
                                        </li>
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100 items-center">
                                            <div className="font-bold text-gray-900 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">Event Bar Click</div>
                                            <div className="text-gray-600 leading-relaxed text-sm sm:text-base">If you click the colored pill itself, it routes explicitly to the Builder tool for that exact event.</div>
                                        </li>
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100 items-center">
                                            <div className="font-bold text-gray-900 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">+ X More (Badge)</div>
                                            <div className="text-gray-600 leading-relaxed text-sm sm:text-base">Because heavily booked wedding days can overlap out of CSS rendering bounds, clicking this overflow badge triggers a neat pop-up modal displaying a cleanly scrollable list of all events on that specific day.</div>
                                        </li>
                                    </ul>
                                </div>
                            </section>

                            {/* SECTION 9: SETTINGS & ROLES */}
                            <section id="settings" className="scroll-mt-24 lg:scroll-mt-10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center text-xl sm:text-2xl shadow-inner shrink-0">⚙️</div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900">9. Settings & Roles</h2>
                                </div>
                                <div className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl shadow-slate-200/50 border border-gray-100 feature-card">
                                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-8">
                                        The security infrastructure for your personnel management. Because not every employee should see sensitive quotation math.
                                    </p>
                                    <h3 className="text-sm border-b border-slate-100 pb-2 font-black text-slate-400 uppercase tracking-widest mb-6">Administrative Buttons</h3>

                                    <ul className="space-y-4 mb-8 text-[15px]">
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                                            <div className="font-bold text-gray-900 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">+ Add User</div>
                                            <div className="text-gray-600 flex items-center leading-relaxed text-sm sm:text-base">Triggers a modal assigning an email & password combination for a staff member. Simultaneously provisions a JSON Row-Level Security profile mapping what pages they are authenticated to visit.</div>
                                        </li>
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                                            <div className="font-bold text-gray-900 border-b border-gray-200 pb-2 sm:border-none sm:pb-0">Access Toggles</div>
                                            <div className="text-gray-600 flex items-center leading-relaxed text-sm sm:text-base">Inside the User Edit view, these checkbox buttons directly mutate the database permission block. If a toggle is off, that user's Sidebar completely hides the route, and any attempt to brute-force navigation yields an unauthorized flag.</div>
                                        </li>
                                        <li className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] gap-2 sm:gap-6 p-5 bg-blue-50/50 rounded-2xl border border-blue-100 items-center">
                                            <div className="font-bold text-blue-700 border-b border-blue-200 pb-2 sm:border-none sm:pb-0">Share Button</div>
                                            <div className="text-blue-900/80 leading-relaxed flex items-center text-sm sm:text-base">Securely copies the specific user's temporary login package to your clipboard so you can rapidly onboard them via instant-message.</div>
                                        </li>
                                    </ul>
                                </div>
                            </section>

                        </div>

                    </div>
                </div>

                {/* DESKTOP SIDEBAR NAVIGATION */}
                <div className="hidden lg:block w-[300px] bg-white border-l border-gray-200 shadow-[-10px_0_20px_rgba(0,0,0,0.02)] shrink-0 z-10">
                    <div className="p-8 sticky top-0 max-h-screen overflow-y-auto">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-100 pb-3">Table of Contents</h3>
                        <nav className="space-y-1.5">
                            {sections.map(sec => (
                                <button
                                    key={sec.id}
                                    onClick={() => handleScrollTo(sec.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 font-bold text-[13px] flex items-center gap-3 ${activeSection === sec.id
                                        ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                                        }`}
                                >
                                    <span className="text-base opacity-90 shrink-0">{sec.icon}</span>
                                    <span className="truncate">{sec.title}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

            </main>
        </div>
    )
}
