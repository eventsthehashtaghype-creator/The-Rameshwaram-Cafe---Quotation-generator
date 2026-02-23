'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import AppSidebar from '../components/AppSidebar'

// --- TYPES ---
type Item = { id: string; name: string; station_id: string }
type Station = { id: string; name: string; selection_type: string; items: Item[]; category_id: string }
type Category = { id: string; title: string; default_price: number; stations: Station[] }

export default function MenuManager() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)

    // --- INPUT STATES ---
    const [newCatTitle, setNewCatTitle] = useState('')
    const [newStationName, setNewStationName] = useState<Record<string, string>>({})
    const [newItemName, setNewItemName] = useState<Record<string, string>>({})

    // --- FETCH DATA ---
    async function fetchMenu() {
        setLoading(true)
        const { data: cats } = await supabase.from('menu_categories').select('*').order('sort_order', { ascending: true })
        const { data: stations } = await supabase.from('menu_stations').select('*').order('sort_order', { ascending: true })
        const { data: items } = await supabase.from('menu_items').select('*').order('name', { ascending: true })

        if (cats && stations && items) {
            const fullMenu = cats.map(cat => ({
                ...cat,
                stations: stations
                    .filter(s => s.category_id === cat.id)
                    .map(st => ({
                        ...st,
                        items: items.filter(i => i.station_id === st.id)
                    }))
            }))
            setCategories(fullMenu)
        }
        setLoading(false)
    }

    useEffect(() => { fetchMenu() }, [])

    // --- ACTIONS ---
    const handleAddCategory = async () => {
        if (!newCatTitle.trim()) return
        const { error } = await supabase.from('menu_categories').insert({ title: newCatTitle, default_price: 0 })
        if (error) alert(error.message)
        else { setNewCatTitle(''); fetchMenu() }
    }

    const handleDeleteCategory = async (id: string) => {
        if (!confirm("⚠️ Delete this Category? All data inside will be lost.")) return

        // Use atomic PostgreSQL transaction RPC to prevent ghost states on network drops
        const { error } = await supabase.rpc('delete_menu_category', { category_uuid: id })
        if (error) {
            alert("Error deleting category: " + error.message)
            return
        }

        fetchMenu()
    }

    const handleUpdatePrice = async (id: string, price: string) => {
        const val = parseFloat(price) || 0
        await supabase.from('menu_categories').update({ default_price: val }).eq('id', id)
        setCategories(prev => prev.map(c => c.id === id ? { ...c, default_price: val } : c))
    }

    const handleAddStation = async (catId: string) => {
        const name = newStationName[catId]
        if (!name?.trim()) return
        const { error } = await supabase.from('menu_stations').insert({ category_id: catId, name: name, selection_type: 'multi_select' })
        if (error) alert(error.message)
        else { setNewStationName(prev => ({ ...prev, [catId]: '' })); fetchMenu() }
    }

    const handleDeleteStation = async (id: string) => {
        if (!confirm("Delete this station?")) return

        // Explicitly delete child items first
        await supabase.from('menu_items').delete().eq('station_id', id)

        await supabase.from('menu_stations').delete().eq('id', id)
        fetchMenu()
    }

    const toggleStationType = async (station: Station) => {
        const newType = station.selection_type === 'single_select' ? 'multi_select' : 'single_select'
        setCategories(prev => prev.map(c => ({
            ...c,
            stations: c.stations.map(s => s.id === station.id ? { ...s, selection_type: newType } : s)
        })))
        await supabase.from('menu_stations').update({ selection_type: newType }).eq('id', station.id)
    }

    const handleAddItem = async (stationId: string) => {
        const name = newItemName[stationId]
        if (!name?.trim()) return
        const { error } = await supabase.from('menu_items').insert({ station_id: stationId, name: name })
        if (error) alert(error.message)
        else { setNewItemName(prev => ({ ...prev, [stationId]: '' })); fetchMenu() }
    }

    const handleDeleteItem = async (itemId: string) => {
        await supabase.from('menu_items').delete().eq('id', itemId)
        fetchMenu()
    }

    return (
        <div className="flex h-screen bg-[#F3F4F6] font-sans text-black">
            <AppSidebar />

            <main className="flex-1 overflow-y-auto p-8">
                {/* Mobile Header Spacer */}
                <div className="h-16 lg:hidden"></div>

                <div className="max-w-6xl mx-auto">

                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8 border-b border-gray-200 pb-6">
                        <div>
                            <h1 className="text-3xl font-black text-black tracking-tight uppercase">Menu Manager</h1>
                            <p className="text-sm font-bold text-gray-500 mt-1">Configure your master menu database.</p>
                        </div>

                        {/* Add Category Widget */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                            <input
                                className="border-2 border-gray-300 bg-white p-2.5 rounded-lg text-sm font-bold outline-none focus:border-black transition w-full sm:w-64"
                                placeholder="New Category (e.g. Dinner)"
                                value={newCatTitle}
                                onChange={e => setNewCatTitle(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                            />
                            <button
                                onClick={handleAddCategory}
                                className="bg-black text-white px-6 py-2.5 rounded-lg font-bold hover:bg-gray-800 transition shadow-lg active:scale-95 w-full sm:w-auto whitespace-nowrap"
                            >
                                + Add Category
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-200 animate-pulse rounded-xl border border-gray-300"></div>)}
                        </div>
                    ) : categories.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
                            <div className="text-4xl mb-4">🍽️</div>
                            <p className="text-gray-400 font-bold mb-2">Your menu is empty.</p>
                            <p className="text-sm text-gray-500">Add a category above to get started.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-20">
                            {categories.map(cat => (
                                <div key={cat.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">

                                    {/* CATEGORY HEADER */}
                                    <div className="bg-gray-50 p-5 border-b border-gray-200 flex justify-between items-center">
                                        <div>
                                            <h2 className="text-lg font-black uppercase text-black">{cat.title}</h2>
                                            <div className="flex items-center mt-1">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Base Price: ₹</span>
                                                <input
                                                    type="number"
                                                    className="w-16 bg-transparent text-sm font-bold outline-none border-b border-dashed border-gray-300 focus:border-black"
                                                    value={cat.default_price}
                                                    onChange={(e) => handleUpdatePrice(cat.id, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteCategory(cat.id)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-100 text-gray-400 hover:text-red-600 font-bold text-lg transition">×</button>
                                    </div>

                                    {/* STATIONS LIST */}
                                    <div className="p-5 space-y-6 flex-1">
                                        {cat.stations.map(station => (
                                            <div key={station.id} className="bg-white border border-gray-100 rounded-lg p-3 hover:border-gray-300 transition shadow-sm">

                                                {/* STATION HEADER */}
                                                <div className="flex justify-between items-center mb-3 border-b border-gray-50 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-xs font-black text-black uppercase">{station.name}</h3>
                                                        <button
                                                            onClick={() => toggleStationType(station)}
                                                            className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase transition hover:opacity-80 ${station.selection_type === 'single_select' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}
                                                        >
                                                            {station.selection_type === 'single_select' ? 'Pick 1' : 'Pick Any'}
                                                        </button>
                                                    </div>
                                                    <button onClick={() => handleDeleteStation(station.id)} className="text-gray-300 hover:text-red-500 font-bold px-1">×</button>
                                                </div>

                                                {/* ITEMS */}
                                                <div className="flex flex-wrap gap-2">
                                                    {station.items.map(item => (
                                                        <div key={item.id} className="bg-gray-50 border border-gray-200 px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 group">
                                                            {item.name}
                                                            <button onClick={() => handleDeleteItem(item.id)} className="text-gray-300 hover:text-red-500 ml-1 opacity-0 group-hover:opacity-100 transition">×</button>
                                                        </div>
                                                    ))}

                                                    {/* Quick Add Input */}
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            className="bg-white border border-gray-300 rounded px-2 py-1 text-[11px] font-bold outline-none focus:border-black transition w-24 placeholder-gray-400"
                                                            placeholder="+ Item"
                                                            value={newItemName[station.id] || ''}
                                                            onChange={e => setNewItemName(prev => ({ ...prev, [station.id]: e.target.value }))}
                                                            onKeyDown={e => e.key === 'Enter' && handleAddItem(station.id)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* ADD STATION FOOTER */}
                                    <div className="p-4 bg-gray-50 border-t border-gray-200">
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-xs font-bold outline-none focus:border-black transition"
                                                placeholder="New Station (e.g. Live Counter)"
                                                value={newStationName[cat.id] || ''}
                                                onChange={e => setNewStationName(prev => ({ ...prev, [cat.id]: e.target.value }))}
                                                onKeyDown={e => e.key === 'Enter' && handleAddStation(cat.id)}
                                            />
                                            <button
                                                onClick={() => handleAddStation(cat.id)}
                                                className="bg-black text-white px-3 py-2 rounded text-xs font-bold hover:bg-gray-800 transition"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}