import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const { userId, email, password, fullName, permissions } = await req.json()

        if (!userId) {
            return NextResponse.json({ error: "Missing Target User ID" }, { status: 400 })
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

        // Ensure requestor has Admin rights in the Profiles table
        const { data: requestorProfile, error: profileError } = await adminClient
            .from('profiles')
            .select('permissions')
            .eq('id', user.id)
            .single()

        console.log("SERVER LOG - User ID:", user.id)
        console.log("SERVER LOG - Profile Fetch Error:", profileError)
        console.log("SERVER LOG - Requestor Profile:", requestorProfile)

        if (!requestorProfile || !requestorProfile.permissions?.settings) {
            console.error("SERVER LOG - REJECTED! Profile or Settings is false/missing. Dumping permissions:", requestorProfile?.permissions)
            return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 })
        }

        // Prevent self-demotion out of fear of lockout
        if (userId === user.id && permissions && permissions.settings === false) {
            return NextResponse.json({ error: "Forbidden: Cannot remove your own Admin privileges." }, { status: 403 })
        }

        // 3. Update Auth User (if email or password provided)
        const updateParams: any = {}
        if (email) updateParams.email = email
        if (password) updateParams.password = password

        if (email || password) {
            const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(userId, updateParams)
            if (updateAuthError) {
                return NextResponse.json({ error: "Failed to update auth credentials: " + updateAuthError.message }, { status: 500 })
            }
        }

        // 4. Update Profile
        const profileUpdates: any = {}
        if (email) profileUpdates.email = email
        if (fullName) profileUpdates.full_name = fullName
        if (password) profileUpdates.assigned_password = password
        if (permissions) profileUpdates.permissions = permissions

        if (Object.keys(profileUpdates).length > 0) {
            const { error: profileError } = await adminClient.from('profiles').update(profileUpdates).eq('id', userId)
            if (profileError) {
                return NextResponse.json({ error: "Failed to update profile: " + profileError.message }, { status: 500 })
            }
        }

        return NextResponse.json({ success: true, message: "User updated successfully!" })

    } catch (err: any) {
        console.error("Critical API Error:", err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
