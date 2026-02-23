import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const { userId } = await req.json()

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

        const { data: requestorProfile } = await adminClient
            .from('profiles')
            .select('permissions')
            .eq('id', user.id)
            .single()

        if (!requestorProfile || !requestorProfile.permissions?.settings) {
            return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 })
        }

        // Prevent self-deletion
        if (userId === user.id) {
            return NextResponse.json({ error: "Forbidden: Cannot delete your own Admin account." }, { status: 403 })
        }

        // 3. Delete Auth User 

        // 3. Delete Auth User 
        // Note: Our SQL schema uses ON DELETE CASCADE on the profiles table, 
        // so deleting the auth user will automatically delete their profile rows.
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

        if (deleteError) {
            return NextResponse.json({ error: "Failed to delete user: " + deleteError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: "User deleted successfully!" })

    } catch (err: any) {
        console.error("Critical API Error:", err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
