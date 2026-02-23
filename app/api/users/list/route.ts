import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
    try {
        // 1. Verify Requestor Token
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 })

        const token = authHeader.replace('Bearer ', '')
        const standardClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data: { user }, error: authError } = await standardClient.auth.getUser(token)
        if (authError || !user) return NextResponse.json({ error: authError?.message || 'Invalid token' }, { status: 401 })

        // 2. Initialize Admin Service Client to bypass RLS recursion limits
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 })

        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // 3. Verify Admin Access
        const { data: requestorProfile } = await adminClient
            .from('profiles')
            .select('permissions')
            .eq('id', user.id)
            .single()

        if (!requestorProfile || !requestorProfile.permissions?.settings) {
            return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 })
        }

        // 4. Fetch all users
        const { data: users, error: fetchError } = await adminClient
            .from('profiles')
            .select('*')
            .order('full_name')

        if (fetchError) {
            return NextResponse.json({ error: "Failed to fetch users: " + fetchError.message }, { status: 500 })
        }

        return NextResponse.json({ users })

    } catch (err: any) {
        console.error("Critical API Error (Users List):", err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
