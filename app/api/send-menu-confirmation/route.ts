import { NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { Resend } from 'resend'

export async function POST(req: Request) {
    try {
        const { eventId, pdfBase64 } = await req.json()
        if (!eventId) return NextResponse.json({ error: "Missing event ID" }, { status: 400 })
        if (!pdfBase64) return NextResponse.json({ error: "Missing PDF content" }, { status: 400 })

        const resendApiKey = process.env.RESEND_API_KEY
        if (!resendApiKey) return NextResponse.json({ error: "Resend API Key not configured." }, { status: 500 })

        const resend = new Resend(resendApiKey)

        // Fetch Event and Client Details
        const { data: event, error: evtErr } = await supabase
            .from('events')
            .select('*, client:clients(entity_name, contact_person, email)')
            .eq('id', eventId)
            .single()

        if (evtErr || !event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

        const clientEmail = event.client?.email
        if (!clientEmail) return NextResponse.json({ error: "Client does not have an email address on file." }, { status: 400 })

        // Fetch App Settings (for Company Name fallback)
        const { data: settings } = await supabase.from('app_settings').select('*').single()
        const companyName = settings?.company_name || 'Hashtag Hype'

        // Construct Email
        const previewLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/client-menu/${event.id}?preview=true`
        const clientName = event.client?.contact_person || event.client?.entity_name || 'Valued Client'

        const htmlContent = `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">Menu Selection Confirmed</h2>
        <p>Dear ${clientName},</p>
        <p>Thank you for submitting your menu selections for your upcoming event on <strong>${new Date(event.event_date).toLocaleDateString()}</strong>.</p>
        <p>We have received your selections and attached the confirmed menu document to this email for your reference.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${previewLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            View Your Selected Menu
          </a>
        </div>

        <p>Our team will review your selections and get in touch with you shortly. If you need to make any further changes, please contact us.</p>
        <br/>
        <p>Best Regards,</p>
        <p><strong>The ${companyName} Team</strong></p>
      </div>
    `

        // Send email with PDF attachment
        const { data, error } = await resend.emails.send({
            from: `${companyName} <hello@hashtaghype.in>`, // Update with verified domain later if needed
            to: [clientEmail],
            cc: ['hello@hashtaghype.in'], // CC the admin/hello inbox
            subject: `Menu Selection Confirmed - ${event.event_code}`,
            html: htmlContent,
            attachments: [
                {
                    filename: `Confirmed_Menu_${event.event_code}.pdf`,
                    content: Buffer.from(pdfBase64, 'base64')
                }
            ]
        })

        if (error) {
            console.error("Resend Error:", error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: "Menu confirmation email sent successfully!" })

    } catch (err: any) {
        console.error("Critical API Error:", err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
