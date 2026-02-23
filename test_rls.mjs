import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qoweuozttrcbdbibtors.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvd2V1b3p0dHJjYmRiaWJ0b3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MTIyMDAsImV4cCI6MjA4Mzk4ODIwMH0.0sSy5XJcCzo-DaI8s78bUNc83Gsj8HzahKyjJrru9BA'

// Use standard Anon client (just like the browser)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function debugBrowserFetch() {
    console.log("1. Authenticating as user...")
    // We need to sign in to get a session token
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'bharathwajkatta@gmail.com',
        password: 'admin' // Assuming this based on previously captured browser logs
    })

    if (authError) {
        console.error("Login Failed. Password might not be 'admin':", authError.message)
        return
    }

    const { user } = authData
    console.log(`2. Logged in! User ID: ${user.id}`)

    console.log("3. Attempting to fetch Profile (simulating AppSidebar)...")
    const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (profileErr) {
        console.error("4. FETCH FAILED. Detailed Error:")
        console.error(JSON.stringify(profileErr, null, 2))
    } else {
        console.log("4. FETCH SUCCEEDED!", profile)
    }
}

debugBrowserFetch()
