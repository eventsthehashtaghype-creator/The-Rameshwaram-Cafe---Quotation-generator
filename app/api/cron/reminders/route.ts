import { NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { Resend } from 'resend'

export async function POST() {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) return NextResponse.json({ error: "Resend API Key not configured." }, { status: 500 })
    const resend = new Resend(resendApiKey)

    // A. Get Settings
    const { data: settings } = await supabase.from('app_settings').select('*').single()
    const daysBefore = settings?.reminder_days ?? 2
    const adminEmail = settings?.admin_email || 'admin@example.com'
    const companyName = settings?.company_name || 'Hashtag Hype'

    // B. Calculate Target Date
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + daysBefore)
    const targetStr = targetDate.toISOString().split('T')[0] // Format: YYYY-MM-DD

    // C. Find Events on that date
    const { data: events, error: fetchErr } = await supabase
      .from('events')
      .select('*, client:clients(entity_name)')
      .eq('event_date', targetStr)

    if (fetchErr) throw fetchErr

    if (!events || events.length === 0) {
      return NextResponse.json({ message: `No events found for ${targetStr}` })
    }

    // D. Send Emails
    const log = []
    let successCount = 0

    for (const evt of events) {
      const htmlContent = `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 20px;">
                <h3 style="color: #b45309; margin-top: 0;">Automated System Reminder</h3>
                <p style="margin-bottom: 0;">An event is approaching its execution date in exactly <strong>${daysBefore} days</strong>.</p>
            </div>
            
            <p><strong>Event:</strong> ${evt.event_code}</p>
            <p><strong>Client:</strong> ${evt.client?.entity_name || 'Unknown'}</p>
            <p><strong>Date:</strong> ${new Date(evt.event_date).toLocaleDateString()}</p>
            <p><strong>City:</strong> ${evt.city || 'Not Specified'}</p>
            <p><strong>Pax Count:</strong> ${evt.pax_count}</p>
            <p><strong>Current Status:</strong> ${evt.status.toUpperCase()}</p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            <p style="font-size: 12px; color: #6b7280;">This is an automated message from the ${companyName} internal management system.</p>
        </div>
      `

      const { error: sendErr } = await resend.emails.send({
        from: `${companyName} System <alerts@hashtaghype.in>`, // Update with verified domain later if needed
        to: [adminEmail],
        subject: `ACTION REQUIRED: Upcoming Event Reminder for ${evt.client?.entity_name || evt.event_code}`,
        html: htmlContent
      });

      if (sendErr) {
        log.push(`Failed to send to ${adminEmail} for event ${evt.id}: ${sendErr.message}`)
      } else {
        successCount++
        log.push(`Sent reminder for ${evt.id}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${successCount}/${events.length} reminders for ${targetStr}`,
      details: log
    })

  } catch (error: any) {
    console.error("Cron Error: ", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
