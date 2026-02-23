import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data, error } = await sb.from('events').select('*').limit(1)
console.log(JSON.stringify(data[0], null, 2))
