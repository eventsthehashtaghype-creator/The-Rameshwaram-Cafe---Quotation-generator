import { supabase } from './supabase'

export interface MenuPreset {
  id: string
  name: string
  description: string
  mealCategory: 'ALL' | 'BREAKFAST' | 'LUNCH' | 'HI-TEA' | 'DINNER' | 'MEALS'
  items: string[]
  isCustom?: boolean
  sortOrder?: number
  createdAt?: string
}

export const DEFAULT_PRESETS: MenuPreset[] = [
  {
    id: 'preset_south_indian_meals',
    name: 'South Indian Meals',
    description: 'Authentic traditional South Indian feast with sambar, rasam, curd rice, specials & sweet.',
    mealCategory: 'LUNCH',
    items: [
      'Steam Rice with Rasam/Sambar/Pappu',
      'Bisi Bele bath',
      'Curd Rice',
      'Vegetable Sambar',
      'Rasam',
      'Dryfruit Payasam',
      'Aloo Bonda',
      'Coconut',
      'Pickle & Podi',
      'Appalam / Papad'
    ],
    isCustom: false,
    sortOrder: 1,
  },
  {
    id: 'preset_traditional_breakfast',
    name: 'Traditional South Indian Breakfast',
    description: 'Iconic Rameshwaram Cafe morning spread with crispy dosas, soft idlis, vada & filter coffee.',
    mealCategory: 'BREAKFAST',
    items: [
      'Ghee Pudi Masala Dosa',
      'Bangalore Idli',
      'Medu Vada',
      'Vegetable Sambar',
      'Coconut',
      'Tomato',
      'Filter Coffee',
      'Saffron Kesari bath'
    ],
    isCustom: false,
    sortOrder: 2,
  },
  {
    id: 'preset_royal_breakfast',
    name: 'Royal Executive Breakfast',
    description: 'Grand morning feast with ghee button idlis, benne masala dosa, ven pongal & badam milk.',
    mealCategory: 'BREAKFAST',
    items: [
      'Benne Masala Dosa',
      'Ghee Sambar Button Idli',
      'Pongal (Ven Pongal)',
      'Dahi Vada / Thayir Vada',
      'Vegetable Sambar',
      'Coconut',
      'Mint',
      'Filter Coffee',
      'Badam Milk',
      'Pheni with Badam Milk'
    ],
    isCustom: false,
    sortOrder: 3,
  },
  {
    id: 'preset_classic_hitea',
    name: 'Classic Hi-Tea & Snacks',
    description: 'Piping hot filter coffee & masala chai with assorted crunchy bajjis, maddur vada & sweets.',
    mealCategory: 'HI-TEA',
    items: [
      'Filter Coffee',
      'Masala Tea',
      "Assorted Bajji's",
      'Maddur Vada',
      'Mysore Bonda',
      'Kharabath',
      'Saffron Kesari bath',
      'Coconut'
    ],
    isCustom: false,
    sortOrder: 4,
  },
  {
    id: 'preset_festive_dinner',
    name: 'Grand Festive Dinner',
    description: 'South-style veg biriyani, akki roti with tomato gojju, bisi bele bath & rich carrot halwa.',
    mealCategory: 'DINNER',
    items: [
      'Veg Biriyani (south style)',
      'Akki Roti with Tomato Gojju',
      'Bisi Bele bath',
      'Curd Rice',
      'Carrot Halwa',
      'Gulab Jamun',
      'Vegetable Sambar',
      'Badam Milk'
    ],
    isCustom: false,
    sortOrder: 5,
  },
  {
    id: 'preset_banana_leaf_meals',
    name: 'Traditional Banana Leaf Sappadu',
    description: 'Full course traditional leaf meal with rice varieties, sambar, rasam, kootu, payasam & accompaniments.',
    mealCategory: 'MEALS',
    items: [
      'Steam Rice with Rasam/Sambar/Pappu',
      'Vegetable Sambar',
      'Rasam',
      'Curd Rice',
      'Bisi Bele bath',
      'Dryfruit Payasam',
      'Sakkari Pongal(signature dish)',
      'Medu Vada',
      'Appalam / Papad',
      'Pickle & Ghee Podi'
    ],
    isCustom: false,
    sortOrder: 6,
  }
]

const LOCAL_STORAGE_KEY = 'trc_custom_menu_presets'

// Map database row to MenuPreset
export function mapRowToPreset(row: any): MenuPreset {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    mealCategory: (row.meal_category || 'ALL') as MenuPreset['mealCategory'],
    items: Array.isArray(row.items) ? row.items : (typeof row.items === 'string' ? JSON.parse(row.items) : []),
    isCustom: row.is_custom !== undefined ? row.is_custom : true,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at,
  }
}

// Map MenuPreset to database row format
export function mapPresetToRow(preset: Partial<MenuPreset> & { name: string; items: string[] }) {
  return {
    id: preset.id || `preset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: preset.name.trim(),
    description: (preset.description || '').trim(),
    meal_category: preset.mealCategory || 'ALL',
    items: preset.items,
    is_custom: preset.isCustom ?? true,
    sort_order: preset.sortOrder ?? 0,
  }
}

// Fetch all presets from Supabase (with fallback to DEFAULT_PRESETS)
export async function fetchAllPresets(): Promise<MenuPreset[]> {
  try {
    const { data, error } = await supabase
      .from('menu_presets')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error || !data || data.length === 0) {
      console.warn('Could not fetch from menu_presets, falling back to local/default:', error?.message)
      return getAllPresets()
    }

    return data.map(mapRowToPreset)
  } catch (e) {
    console.error('Failed to fetch presets from Supabase:', e)
    return getAllPresets()
  }
}

// Synchronous helper for initial render / fallback
export function getAllPresets(): MenuPreset[] {
  let customPresets: MenuPreset[] = []
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        customPresets = JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to parse custom presets from localStorage', e)
    }
  }
  return [...DEFAULT_PRESETS, ...customPresets]
}

// Admin save (Create or Update) preset in Supabase
export async function savePreset(preset: {
  id?: string
  name: string
  description?: string
  mealCategory?: MenuPreset['mealCategory']
  items: string[]
  isCustom?: boolean
  sortOrder?: number
}): Promise<MenuPreset> {
  const row = mapPresetToRow(preset)
  const mappedPreset = mapRowToPreset(row)

  // Upsert into Supabase
  const { error } = await supabase
    .from('menu_presets')
    .upsert(row, { onConflict: 'id' })

  if (error) {
    console.error('Error saving preset to Supabase:', error)
    throw new Error(error.message)
  }

  // Also update local storage for offline resilience
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      const list: MenuPreset[] = stored ? JSON.parse(stored) : []
      const index = list.findIndex(p => p.id === mappedPreset.id)
      if (index >= 0) {
        list[index] = mappedPreset
      } else {
        list.unshift(mappedPreset)
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list))
    } catch (e) {}
  }

  return mappedPreset
}

// Admin delete preset from Supabase
export async function deletePreset(id: string): Promise<void> {
  const { error } = await supabase
    .from('menu_presets')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting preset from Supabase:', error)
    throw new Error(error.message)
  }

  // Remove from localStorage if exists
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        const list: MenuPreset[] = JSON.parse(stored)
        const filtered = list.filter(p => p.id !== id)
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered))
      }
    } catch (e) {}
  }
}

// Backwards-compatible custom preset save (redirects to savePreset)
export function saveCustomPreset(preset: {
  name: string
  description?: string
  mealCategory?: MenuPreset['mealCategory']
  items: string[]
}): MenuPreset {
  const row = mapPresetToRow({ ...preset, isCustom: true })
  const mappedPreset = mapRowToPreset(row)

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      const currentList: MenuPreset[] = stored ? JSON.parse(stored) : []
      currentList.unshift(mappedPreset)
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentList))
    } catch (e) {}
  }

  try {
    Promise.resolve(
      supabase.from('menu_presets').upsert(row)
    ).catch(() => {})
  } catch (e) {}

  return mappedPreset
}

// Backwards-compatible custom preset delete
export function deleteCustomPreset(id: string): void {
  deletePreset(id).catch(() => {})
}
