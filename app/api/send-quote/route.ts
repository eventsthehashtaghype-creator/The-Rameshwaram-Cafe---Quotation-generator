import { NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { Resend } from 'resend'

export async function POST(req: Request) {
    try {
        const { eventId } = await req.json()
        if (!eventId) return NextResponse.json({ error: "Missing event ID" }, { status: 400 })

        const resendApiKey = process.env.RESEND_API_KEY
        if (!resendApiKey) return NextResponse.json({ error: "Resend API Key not configured." }, { status: 500 })

        const resend = new Resend(resendApiKey)

        // A. Fetch Event and Client Details
        const { data: event, error: evtErr } = await supabase
            .from('events')
            .select('*, client:clients(entity_name, contact_person, email)')
            .eq('id', eventId)
            .single()

        if (evtErr || !event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

        const clientEmail = event.client?.email
        if (!clientEmail) return NextResponse.json({ error: "Client does not have an email address on file." }, { status: 400 })

        // B. Fetch App Settings (for Company Name fallback)
        const { data: settings } = await supabase.from('app_settings').select('*').single()
        const companyName = settings?.company_name || 'Hashtag Hype'

        // C. Construct Email
        const quoteLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/client-menu/${event.id}?preview=true`
        const clientName = event.client?.contact_person || event.client?.entity_name || 'Valued Client'

        const htmlContent = `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">Your Event Quotation is Ready</h2>
        <p>Dear ${clientName},</p>
        <p>Thank you for choosing <strong>${companyName}</strong> for your upcoming event on <strong>${new Date(event.event_date).toLocaleDateString()}</strong>.</p>
        <p>We have prepared a customized quotation and menu specifically tailored for your requirements.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${quoteLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            View Your Quotation & Menu
          </a>
        </div>

        <p>If you have any questions or require revisions, please do not hesitate to contact us.</p>
        <br/>
        <p>Best Regards,</p>
        <p><strong>The ${companyName} Team</strong></p>
      </div>
    `

        // D. Dispatch
        const { data, error } = await resend.emails.send({
            from: `${companyName} <hello@hashtaghype.in>`, // Update with verified domain later if needed
            to: [clientEmail],
            subject: `Your Event Quotation from ${companyName}`,
            html: htmlContent
        })

        if (error) {
            console.error("Resend Error:", error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // E. (Optional) Auto-update status
        if (event.status === 'draft') {
            await supabase.from('events').update({ status: 'sent' }).eq('id', eventId)
        }

        return NextResponse.json({ success: true, message: "Quotation sent successfully!" })

    } catch (err: any) {
        console.error("Critical API Error:", err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
