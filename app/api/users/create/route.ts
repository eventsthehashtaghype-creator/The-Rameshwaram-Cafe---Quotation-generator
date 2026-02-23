import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const { email, password, fullName, permissions } = await req.json()

        if (!email || !password || !fullName || !permissions) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // 1. Verify Requestor is Admin 
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 })

        const token = authHeader.replace('Bearer ', '')
        const standardClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data: { user }, error: authError } = await standardClient.auth.getUser(token)
        if (authError || !user) return NextResponse.json({ error: authError?.message || 'Invalid token' }, { status: 401 })

        // 2. Initialize Admin Service Client to bypass restrictions
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 })

        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const { data: requestorProfile } = await adminClient
            .from('profiles')
            .select('permissions')
            .eq('id', user.id)
            .single()

        if (!requestorProfile || !requestorProfile.permissions?.settings) {
            return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 })
        }

        // 3. Create Auth User
        const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true // Auto-confirm to avoid SMTP limits
        })

        if (createError || !newAuthUser?.user) {
            return NextResponse.json({ error: createError?.message || 'Failed to create user' }, { status: 500 })
        }

        // 4. Create Profile
        const { error: profileError } = await adminClient.from('profiles').insert({
            id: newAuthUser.user.id,
            email: email,
            full_name: fullName,
            assigned_password: password,
            permissions: permissions
        })

        if (profileError) {
            // Rollback if profile errors
            await adminClient.auth.admin.deleteUser(newAuthUser.user.id)
            return NextResponse.json({ error: "Failed to create profile: " + profileError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: "User created successfully!", user: { id: newAuthUser.user.id, email, fullName } })

    } catch (err: any) {
        console.error("Critical API Error:", err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
