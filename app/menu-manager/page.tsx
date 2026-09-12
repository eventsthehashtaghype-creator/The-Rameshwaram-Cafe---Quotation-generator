'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/app/lib/supabase'
import AppSidebar from '../components/AppSidebar'
import { useRouter } from 'next/navigation'
import { MenuPreset, fetchAllPresets, savePreset, deletePreset } from '@/app/lib/presets'

// --- TYPES ---
type Item = { id: string; name: string; station_id: string }
type Station = { id: string; name: string; selection_type: string; items: Item[]; category_id: string }
type Category = { id: string; title: string; default_price: number; stations: Station[] }

export default function MenuManager() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<'catalog' | 'presets'>('catalog')

    // Master Menu Catalog State
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)

    // Master Menu Inputs
    const [newCatTitle, setNewCatTitle] = useState('')
    const [newStationName, setNewStationName] = useState<Record<string, string>>({})
    const [newItemName, setNewItemName] = useState<Record<string, string>>({})

    // One-Click Menu Presets State
    const [presets, setPresets] = useState<MenuPreset[]>([])
    const [loadingPresets, setLoadingPresets] = useState(false)
    const [presetSearch, setPresetSearch] = useState('')
    const [presetCategoryFilter, setPresetCategoryFilter] = useState<string>('ALL')

    // Preset Edit / Create Modal State
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false)
    const [editingPreset, setEditingPreset] = useState<MenuPreset | null>(null)
    const [presetFormName, setPresetFormName] = useState('')
    const [presetFormDesc, setPresetFormDesc] = useState('')
    const [presetFormCategory, setPresetFormCategory] = useState<MenuPreset['mealCategory']>('ALL')
    const [presetFormItems, setPresetFormItems] = useState<string[]>([])
    const [itemSearchQuery, setItemSearchQuery] = useState('')
    const [savingPreset, setSavingPreset] = useState(false)
    const [toastMessage, setToastMessage] = useState<string | null>(null)

    const showToast = (msg: string) => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(null), 3500)
    }

    // All dishes available across all categories & stations
    const allDishes = useMemo(() => {
        const list: { id: string; name: string; stationName: string; categoryTitle: string }[] = []
        categories.forEach(cat => {
            cat.stations.forEach(st => {
                st.items.forEach(item => {
                    list.push({
                        id: item.id,
                        name: item.name,
                        stationName: st.name,
                        categoryTitle: cat.title,
                    })
                })
            })
        })
        return list
    }, [categories])

    // --- FETCH DATA ---
    async function fetchMenu() {
        setLoading(true)

        // Auth & Role check
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/login')
            return
        }
        
        const { data: clientUser } = await supabase.from('clients').select('id').eq('auth_user_id', session.user.id).single()
        if (clientUser) {
            router.replace('/portal/dashboard')
            return
        }

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

    async function loadPresets() {
        setLoadingPresets(true)
        try {
            const data = await fetchAllPresets()
            setPresets(data)
        } catch (e) {
            console.error('Error loading presets:', e)
        } finally {
            setLoadingPresets(false)
        }
    }

    useEffect(() => {
        fetchMenu()
        loadPresets()
    }, [])

    // --- CATALOG ACTIONS ---
    const handleAddCategory = async () => {
        if (!newCatTitle.trim()) return
        const { error } = await supabase.from('menu_categories').insert({ title: newCatTitle, default_price: 0 })
        if (error) alert(error.message)
        else { setNewCatTitle(''); fetchMenu() }
    }

    const handleDeleteCategory = async (id: string) => {
        if (!confirm("⚠️ Delete this Category? All data inside will be lost.")) return

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

    // --- PRESETS ACTIONS ---
    const openCreatePresetModal = () => {
        setEditingPreset(null)
        setPresetFormName('')
        setPresetFormDesc('')
        setPresetFormCategory('ALL')
        setPresetFormItems([])
        setItemSearchQuery('')
        setIsPresetModalOpen(true)
    }

    const openEditPresetModal = (preset: MenuPreset) => {
        setEditingPreset(preset)
        setPresetFormName(preset.name)
        setPresetFormDesc(preset.description || '')
        setPresetFormCategory(preset.mealCategory || 'ALL')
        setPresetFormItems([...preset.items])
        setItemSearchQuery('')
        setIsPresetModalOpen(true)
    }

    const handleToggleItemInPreset = (itemName: string) => {
        setPresetFormItems(prev => 
            prev.includes(itemName)
                ? prev.filter(i => i !== itemName)
                : [...prev, itemName]
        )
    }

    const handleSelectAllInStation = (items: Item[]) => {
        const itemNames = items.map(i => i.name)
        const allIncluded = itemNames.every(name => presetFormItems.includes(name))

        if (allIncluded) {
            // Uncheck all in this station
            setPresetFormItems(prev => prev.filter(i => !itemNames.includes(i)))
        } else {
            // Check all in this station
            setPresetFormItems(prev => Array.from(new Set([...prev, ...itemNames])))
        }
    }

    const handleSavePreset = async () => {
        if (!presetFormName.trim()) {
            alert('Please enter a package name for this preset.')
            return
        }
        if (presetFormItems.length === 0) {
            alert('Please select at least 1 menu item for this preset package.')
            return
        }

        setSavingPreset(true)
        try {
            await savePreset({
                id: editingPreset?.id,
                name: presetFormName.trim(),
                description: presetFormDesc.trim(),
                mealCategory: presetFormCategory,
                items: presetFormItems,
                isCustom: editingPreset ? editingPreset.isCustom : true,
                sortOrder: editingPreset ? editingPreset.sortOrder : presets.length + 1,
            })
            await loadPresets()
            setIsPresetModalOpen(false)
            showToast(`Preset "${presetFormName.trim()}" saved successfully!`)
        } catch (e: any) {
            alert('Failed to save preset: ' + (e.message || 'Unknown error'))
        } finally {
            setSavingPreset(false)
        }
    }

    const handleDeletePreset = async (preset: MenuPreset) => {
        if (!confirm(`Are you sure you want to delete preset "${preset.name}"? Customers will no longer be able to 1-click import it.`)) return
        try {
            await deletePreset(preset.id)
            await loadPresets()
            showToast(`Deleted preset "${preset.name}"`)
        } catch (e: any) {
            alert('Failed to delete preset: ' + (e.message || 'Unknown error'))
        }
    }

    // Filtered presets for display
    const filteredPresets = useMemo(() => {
        return presets.filter(p => {
            const matchesCat = presetCategoryFilter === 'ALL' || p.mealCategory === presetCategoryFilter
            const matchesSearch = !presetSearch.trim() || 
                p.name.toLowerCase().includes(presetSearch.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(presetSearch.toLowerCase())) ||
                p.items.some(i => i.toLowerCase().includes(presetSearch.toLowerCase()))
            return matchesCat && matchesSearch
        })
    }, [presets, presetCategoryFilter, presetSearch])

    return (
        <div className="flex h-screen bg-[#F3F4F6] font-sans text-black">
            <AppSidebar />

            <main className="flex-1 overflow-y-auto p-4 sm:p-8">
                {/* Mobile Header Spacer */}
                <div className="h-16 lg:hidden"></div>

                <div className="max-w-6xl mx-auto">

                    {/* Page Header */}
                    <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6 border-b border-gray-200 pb-6">
                        <div>
                            <h1 className="text-3xl font-black text-black tracking-tight uppercase">Menu Manager</h1>
                            <p className="text-sm font-bold text-gray-500 mt-1">
                                Master catalog configuration and client one-click preset packages.
                            </p>
                        </div>

                        {/* Top Action Buttons based on active tab */}
                        {activeTab === 'catalog' ? (
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
                                    className="bg-black text-white px-6 py-2.5 rounded-lg font-bold hover:bg-gray-800 transition shadow-lg active:scale-95 w-full sm:w-auto whitespace-nowrap cursor-pointer"
                                >
                                    + Add Category
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={openCreatePresetModal}
                                className="bg-amber-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-black text-sm tracking-wide transition shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span className="text-amber-400">⚡</span> + Create Preset Package
                            </button>
                        )}
                    </div>

                    {/* TAB SWITCHER */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-8 bg-gray-200/80 p-1.5 rounded-2xl w-full sm:w-fit border border-gray-300/60 shadow-inner">
                        <button
                            type="button"
                            onClick={() => setActiveTab('catalog')}
                            className={`px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'catalog'
                                    ? 'bg-white text-black shadow-md'
                                    : 'text-gray-600 hover:text-black hover:bg-white/50'
                            }`}
                        >
                            <span>🍽️</span> Master Menu Catalog
                            <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-bold ml-1">
                                {categories.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('presets')}
                            className={`px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'presets'
                                    ? 'bg-amber-900 text-white shadow-md'
                                    : 'text-gray-600 hover:text-black hover:bg-white/50'
                            }`}
                        >
                            <span>⚡</span> One-Click Menu Presets
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 ${
                                activeTab === 'presets' ? 'bg-amber-800 text-amber-200' : 'bg-gray-100 text-gray-700'
                            }`}>
                                {presets.length}
                            </span>
                        </button>
                    </div>

                    {/* TAB 1: MASTER MENU CATALOG */}
                    {activeTab === 'catalog' && (
                        <>
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
                                                <button onClick={() => handleDeleteCategory(cat.id)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-100 text-gray-400 hover:text-red-600 font-bold text-lg transition cursor-pointer">×</button>
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
                                                                    className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase transition hover:opacity-80 cursor-pointer ${station.selection_type === 'single_select' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}
                                                                >
                                                                    {station.selection_type === 'single_select' ? 'Pick 1' : 'Pick Any'}
                                                                </button>
                                                            </div>
                                                            <button onClick={() => handleDeleteStation(station.id)} className="text-gray-300 hover:text-red-500 font-bold px-1 cursor-pointer">×</button>
                                                        </div>

                                                        {/* ITEMS */}
                                                        <div className="flex flex-wrap gap-2">
                                                            {station.items.map(item => (
                                                                <div key={item.id} className="bg-gray-50 border border-gray-200 px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 group">
                                                                    {item.name}
                                                                    <button onClick={() => handleDeleteItem(item.id)} className="text-gray-300 hover:text-red-500 ml-1 opacity-0 group-hover:opacity-100 transition cursor-pointer">×</button>
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
                                                        className="bg-black text-white px-3 py-2 rounded text-xs font-bold hover:bg-gray-800 transition cursor-pointer"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            </div>

                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* TAB 2: ONE-CLICK MENU PRESETS (ADMIN CONFIG) */}
                    {activeTab === 'presets' && (
                        <div className="space-y-6 pb-20">
                            {/* Explanatory Banner */}
                            <div className="bg-gradient-to-r from-amber-900 via-amber-950 to-stone-900 text-white p-6 rounded-2xl shadow-lg border border-amber-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1 max-w-2xl">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">⚡</span>
                                        <h3 className="text-base font-black uppercase tracking-wider text-amber-300">
                                            Admin-Managed 1-Click Menu Packages
                                        </h3>
                                    </div>
                                    <p className="text-xs text-amber-100/90 leading-relaxed font-medium">
                                        Customers will see these packages inside their Client Menu Selection wizard. When a customer clicks a preset, all the pre-selected items below are instantly chosen for their session with 1 click. You have full control over the dishes and packages offered.
                                    </p>
                                </div>

                                <button
                                    onClick={openCreatePresetModal}
                                    className="bg-amber-400 hover:bg-amber-300 text-amber-950 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md whitespace-nowrap self-start md:self-auto cursor-pointer"
                                >
                                    + Add New Package
                                </button>
                            </div>

                            {/* Search & Category Filter Bar */}
                            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 shrink-0">Filter:</span>
                                    {(['ALL', 'BREAKFAST', 'LUNCH', 'HI-TEA', 'DINNER', 'MEALS'] as const).map(cat => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setPresetCategoryFilter(cat)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition shrink-0 cursor-pointer ${
                                                presetCategoryFilter === cat
                                                    ? 'bg-black text-white'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>

                                <div className="relative w-full sm:w-64">
                                    <input
                                        type="text"
                                        placeholder="Search preset or dish..."
                                        value={presetSearch}
                                        onChange={e => setPresetSearch(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-800 outline-none focus:border-black transition"
                                    />
                                    {presetSearch && (
                                        <button
                                            onClick={() => setPresetSearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black text-xs font-bold"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Presets Grid */}
                            {loadingPresets ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[1, 2, 3, 4, 5, 6].map(i => (
                                        <div key={i} className="h-60 bg-gray-200 animate-pulse rounded-2xl border border-gray-300"></div>
                                    ))}
                                </div>
                            ) : filteredPresets.length === 0 ? (
                                <div className="text-center py-20 border-2 border-dashed border-gray-300 rounded-2xl bg-white">
                                    <div className="text-4xl mb-3">⚡</div>
                                    <h4 className="text-base font-black text-gray-700 uppercase">No Preset Packages Found</h4>
                                    <p className="text-xs text-gray-400 mt-1 font-medium">
                                        {presetSearch ? 'Try a different search query or filter.' : 'Click "+ Create Preset Package" to add your first 1-click import template.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredPresets.map(preset => (
                                        <div
                                            key={preset.id}
                                            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between group"
                                        >
                                            <div>
                                                {/* Header */}
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div>
                                                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 mb-1 border border-amber-200">
                                                            {preset.mealCategory}
                                                        </span>
                                                        <h3 className="text-base font-black text-gray-900 leading-tight">
                                                            {preset.name}
                                                        </h3>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={() => openEditPresetModal(preset)}
                                                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-black font-bold text-xs transition cursor-pointer"
                                                            title="Edit Preset Package"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePreset(preset)}
                                                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 font-bold text-xs transition cursor-pointer"
                                                            title="Delete Preset Package"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Description */}
                                                {preset.description && (
                                                    <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                                                        {preset.description}
                                                    </p>
                                                )}

                                                {/* Items Preview */}
                                                <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
                                                    <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                                        <span>Included Dishes</span>
                                                        <span className="text-amber-900 font-black">{preset.items.length} items</span>
                                                    </div>

                                                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto no-scrollbar py-1">
                                                        {preset.items.map((item, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="bg-amber-50/80 border border-amber-200/60 text-amber-950 px-2 py-0.5 rounded-md text-[11px] font-bold"
                                                            >
                                                                {item}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Card Footer */}
                                            <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-gray-400">
                                                    Available for customer 1-click import
                                                </span>
                                                <button
                                                    onClick={() => openEditPresetModal(preset)}
                                                    className="text-xs font-black text-amber-900 hover:text-black underline cursor-pointer"
                                                >
                                                    Edit Items →
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </main>

            {/* CREATE / EDIT PRESET MODAL */}
            {isPresetModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-gray-200 max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden">

                        {/* Modal Header */}
                        <div className="p-4 sm:p-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-xl sm:text-2xl bg-amber-100 p-2 rounded-xl text-amber-900">⚡</span>
                                <div>
                                    <h3 className="text-base sm:text-lg font-black uppercase text-gray-900">
                                        {editingPreset ? 'Edit Preset Package' : 'Create One-Click Preset Package'}
                                    </h3>
                                    <p className="text-xs text-gray-500 font-medium line-clamp-1 sm:line-clamp-none">
                                        Select the dishes that will be automatically imported when customers choose this preset.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPresetModalOpen(false)}
                                className="w-8 h-8 rounded-full hover:bg-gray-200 text-gray-500 font-bold flex items-center justify-center transition cursor-pointer shrink-0"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {/* Basic Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1">
                                        Package / Preset Name *
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full border-2 border-gray-300 rounded-xl p-2.5 text-sm font-bold text-gray-900 outline-none focus:border-black transition"
                                        placeholder="e.g., South Indian Meals, Royal Breakfast, Hi-Tea Crunch"
                                        value={presetFormName}
                                        onChange={e => setPresetFormName(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1">
                                        Meal Category
                                    </label>
                                    <select
                                        className="w-full border-2 border-gray-300 rounded-xl p-2.5 text-sm font-bold text-gray-900 outline-none focus:border-black transition cursor-pointer bg-white"
                                        value={presetFormCategory}
                                        onChange={e => setPresetFormCategory(e.target.value as any)}
                                    >
                                        <option value="ALL">ALL (Any Session)</option>
                                        <option value="BREAKFAST">BREAKFAST</option>
                                        <option value="LUNCH">LUNCH</option>
                                        <option value="HI-TEA">HI-TEA</option>
                                        <option value="DINNER">DINNER</option>
                                        <option value="MEALS">MEALS</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1">
                                    Description (Shown to Customer)
                                </label>
                                <input
                                    type="text"
                                    className="w-full border-2 border-gray-300 rounded-xl p-2.5 text-xs font-semibold text-gray-700 outline-none focus:border-black transition"
                                    placeholder="e.g., Authentic traditional spread with sambar, rasam, specials & sweet."
                                    value={presetFormDesc}
                                    onChange={e => setPresetFormDesc(e.target.value)}
                                />
                            </div>

                            {/* ITEM SELECTION SECTION */}
                            <div className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-50/50">
                                {/* Search and Selection Header */}
                                <div className="p-4 bg-white border-b border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black uppercase tracking-wider text-gray-900">
                                            Select Preset Dishes
                                        </span>
                                        <span className="bg-amber-900 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                                            {presetFormItems.length} Selected
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="Search dishes..."
                                            value={itemSearchQuery}
                                            onChange={e => setItemSearchQuery(e.target.value)}
                                            className="bg-gray-100 border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 outline-none focus:border-black transition w-full sm:w-48"
                                        />
                                        {presetFormItems.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setPresetFormItems([])}
                                                className="text-[11px] font-bold text-red-600 hover:text-red-800 px-2 py-1 whitespace-nowrap cursor-pointer"
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Dishes Picker Tree */}
                                <div className="p-4 max-h-[380px] overflow-y-auto space-y-6">
                                    {categories.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400 text-xs font-bold">
                                            No menu items found. Please add categories and dishes in the Master Menu Catalog tab first.
                                        </div>
                                    ) : (
                                        categories.map(cat => {
                                            // Filter stations & items based on search query
                                            const matchingStations = cat.stations.filter(st => {
                                                if (!itemSearchQuery.trim()) return true
                                                const q = itemSearchQuery.toLowerCase()
                                                return st.name.toLowerCase().includes(q) || st.items.some(i => i.name.toLowerCase().includes(q))
                                            })

                                            if (matchingStations.length === 0) return null

                                            return (
                                                <div key={cat.id} className="space-y-3">
                                                    <div className="flex items-center gap-2 border-b border-gray-200 pb-1.5">
                                                        <span className="text-xs font-black uppercase text-gray-700 tracking-wider">
                                                            📁 {cat.title}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-3 pl-2">
                                                        {matchingStations.map(st => {
                                                            const filteredItems = st.items.filter(i => 
                                                                !itemSearchQuery.trim() || i.name.toLowerCase().includes(itemSearchQuery.toLowerCase())
                                                            )
                                                            if (filteredItems.length === 0) return null

                                                            const allStationSelected = filteredItems.length > 0 && filteredItems.every(i => presetFormItems.includes(i.name))
                                                            const someStationSelected = filteredItems.some(i => presetFormItems.includes(i.name))

                                                            return (
                                                                <div key={st.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[11px] font-black uppercase text-gray-800">
                                                                                {st.name}
                                                                            </span>
                                                                            <span className="text-[9px] font-bold text-gray-400">
                                                                                ({filteredItems.length} items)
                                                                            </span>
                                                                        </div>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleSelectAllInStation(filteredItems)}
                                                                            className="text-[10px] font-black uppercase tracking-wider text-amber-900 hover:text-black underline cursor-pointer"
                                                                        >
                                                                            {allStationSelected ? 'Deselect Station' : 'Select All'}
                                                                        </button>
                                                                    </div>

                                                                    <div className="flex flex-wrap gap-2">
                                                                        {filteredItems.map(item => {
                                                                            const isSelected = presetFormItems.includes(item.name)
                                                                            return (
                                                                                <button
                                                                                    key={item.id}
                                                                                    type="button"
                                                                                    onClick={() => handleToggleItemInPreset(item.name)}
                                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                                                                        isSelected
                                                                                            ? 'bg-amber-900 text-white shadow-xs'
                                                                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                                                                                    }`}
                                                                                >
                                                                                    <span>{isSelected ? '✓' : '+'}</span>
                                                                                    <span>{item.name}</span>
                                                                                </button>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 sm:p-5 border-t border-gray-200 bg-gray-50 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs font-bold text-gray-600 text-center sm:text-left">
                                <span className="font-black text-amber-900">{presetFormItems.length}</span> dishes will be imported by customer on 1-click
                            </div>

                            <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setIsPresetModalOpen(false)}
                                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-xs text-gray-600 hover:bg-gray-200 transition cursor-pointer text-center"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSavePreset}
                                    disabled={savingPreset}
                                    className="flex-1 sm:flex-none bg-amber-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                                >
                                    {savingPreset ? 'Saving...' : (editingPreset ? 'Update Preset' : 'Save Preset')}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* FLOATING TOAST NOTIFICATION */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-black text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-700 animate-in slide-in-from-bottom-5 duration-300">
                    <span className="text-amber-400 text-lg">⚡</span>
                    <span className="text-xs font-bold">{toastMessage}</span>
                    <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-white text-xs ml-2 cursor-pointer">✕</button>
                </div>
            )}
        </div>
    )
}