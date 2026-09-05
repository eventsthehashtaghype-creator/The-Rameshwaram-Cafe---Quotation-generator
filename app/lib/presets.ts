import { supabase } from './supabase'

export interface MenuPreset {
  id: string
  name: string
  description: string
  mealCategory: 'ALL' | 'BREAKFAST' | 'LUNCH' | 'HI-TEA' | 'DINNER' | 'MEALS'
  items: string[]
  isCustom?: boolean
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
  }
]

const LOCAL_STORAGE_KEY = 'trc_custom_menu_presets'

// Get all presets (defaults + customs)
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

// Save a new custom preset
export function saveCustomPreset(preset: {
  name: string
  description?: string
  mealCategory?: MenuPreset['mealCategory']
  items: string[]
}): MenuPreset {
  const newPreset: MenuPreset = {
    id: `preset_custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: preset.name.trim(),
    description: (preset.description || `Custom preset with ${preset.items.length} items`).trim(),
    mealCategory: preset.mealCategory || 'ALL',
    items: [...preset.items],
    isCustom: true,
    createdAt: new Date().toISOString(),
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      const currentList: MenuPreset[] = stored ? JSON.parse(stored) : []
      currentList.unshift(newPreset)
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentList))
    } catch (e) {
      console.error('Failed to save custom preset to localStorage', e)
    }
  }

  // Best effort sync with Supabase if table exists
  try {
    Promise.resolve(
      supabase.from('menu_presets').insert({
        id: newPreset.id,
        name: newPreset.name,
        description: newPreset.description,
        meal_category: newPreset.mealCategory,
        items: newPreset.items,
        is_custom: true,
      })
    ).catch(() => {})
  } catch (e) {}

  return newPreset
}

// Delete custom preset
export function deleteCustomPreset(id: string): void {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        const currentList: MenuPreset[] = JSON.parse(stored)
        const filtered = currentList.filter(p => p.id !== id)
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered))
      }
    } catch (e) {
      console.error('Failed to delete custom preset from localStorage', e)
    }
  }

  try {
    Promise.resolve(
      supabase.from('menu_presets').delete().eq('id', id)
    ).catch(() => {})
  } catch (e) {}
}
