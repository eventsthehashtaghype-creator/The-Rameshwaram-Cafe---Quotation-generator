import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Fallback for visual editors or build steps where env might be missing
// This prevents "supabaseUrl is required" error during Vercel build if vars aren't set yet
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
)
// Force Vercel Rebuild - Timestamp: 2026-02-18