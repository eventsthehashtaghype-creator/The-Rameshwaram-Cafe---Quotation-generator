import { NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { Resend } from 'resend'

export async function GET() {
  return handleReminders()
}

export async function POST() {
  return handleReminders()
}

async function handleReminders() {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    const resend = resendApiKey ? new Resend(resendApiKey) : null

    // Fetch settings
    const { data: settings } = await supabase.from('app_settings').select('*').single()
    const adminEmail = settings?.admin_email || 'admin@therameshwaramcafe.org'
    const companyName = settings?.company_name || 'The Rameshwaram Cafe'

    const today = new Date()
    const fourDaysLater = new Date(today)
    fourDaysLater.setDate(fourDaysLater.getDate() + 4)
    const fourDaysStr = fourDaysLater.toISOString().split('T')[0]

    const sevenDaysLater = new Date(today)
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
    const sevenDaysStr = sevenDaysLater.toISOString().split('T')[0]

    const { data: allEvents } = await supabase
      .from('events')
      .select('*, client:clients(entity_name, contact_person, mobile)')
      .order('event_date', { ascending: true })

    const events = allEvents || []

    // Rule A: Upcoming Events (Next 7 days) - Weekly Rule
    const upcomingEvents = events.filter(e => {
      const ed = new Date(e.event_date)
      return ed >= today && ed <= sevenDaysLater && e.status !== 'cancelled'
    })

    // Rule B: New Requests - Daily Rule (status is pending_admin_approval or draft)
    const newRequests = events.filter(e =>
      e.status === 'pending_admin_approval' || e.quote_status === 'client_submitted'
    )

    // Rule C: Rejected Events - Weekly Rule (status is cancelled)
    const rejectedEvents = events.filter(e => e.status === 'cancelled')

    // Rule D: Menu Locking Warning - If not locked 4 days before event
    const menuLockingWarning = events.filter(e => {
      const ed = e.event_date
      return ed <= fourDaysStr && new Date(ed) >= today && !e.menu_locked && e.status !== 'cancelled'
    })

    // Rule E: Quotation Locking Warning - If not locked/submitted 4 days before event
    const quotationLockingWarning = events.filter(e => {
      const ed = e.event_date
      const isLocked = e.status === 'sent' || e.quote_status === 'submitted' || e.quote_submitted === true
      return ed <= fourDaysStr && new Date(ed) >= today && !isLocked && e.status !== 'cancelled'
    })

    const summaryReport = {
      timestamp: new Date().toISOString(),
      upcomingEventsCount: upcomingEvents.length,
      newRequestsCount: newRequests.length,
      rejectedEventsCount: rejectedEvents.length,
      menuLockingWarningCount: menuLockingWarning.length,
      quotationLockingWarningCount: quotationLockingWarning.length,
    }

    let emailSent = false
    let emailError = null

    if (resend) {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; background-color: #f8fafc; padding: 24px; border-radius: 16px;">
          <div style="background-color: #0f172a; padding: 20px; text-align: center; border-radius: 12px; margin-bottom: 24px;">
            <h2 style="color: #ffffff; margin: 0;">${companyName} - Activity Reminders</h2>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 6px;">Automated 3-Day Activity Digest & Pending Actions</p>
          </div>

          <!-- Section A: Upcoming Events -->
          <div style="background-color: #ffffff; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <h3 style="color: #2563eb; margin-top: 0;">📅 Upcoming Events (Next 7 Days): ${upcomingEvents.length}</h3>
            ${upcomingEvents.map(e => `<p style="font-size: 13px; margin: 4px 0;">• <strong>${e.event_code}</strong> - ${e.client?.entity_name || 'Client'} (${new Date(e.event_date).toLocaleDateString('en-GB')})</p>`).join('') || '<p style="font-size: 12px; color: #94a3b8;">No upcoming events in next 7 days.</p>'}
          </div>

          <!-- Section B: New Requests -->
          <div style="background-color: #ffffff; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <h3 style="color: #d97706; margin-top: 0;">⚡ New Pending Requests: ${newRequests.length}</h3>
            ${newRequests.map(e => `<p style="font-size: 13px; margin: 4px 0;">• <strong>${e.event_code}</strong> - ${e.client?.entity_name || 'Client'} (Status: ${e.status})</p>`).join('') || '<p style="font-size: 12px; color: #94a3b8;">No pending requests.</p>'}
          </div>

          <!-- Section C: Rejected Events -->
          <div style="background-color: #ffffff; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <h3 style="color: #dc2626; margin-top: 0;">❌ Rejected / Cancelled Events: ${rejectedEvents.length}</h3>
            ${rejectedEvents.map(e => `<p style="font-size: 13px; margin: 4px 0;">• <strong>${e.event_code}</strong> - ${e.client?.entity_name || 'Client'}</p>`).join('') || '<p style="font-size: 12px; color: #94a3b8;">No rejected events.</p>'}
          </div>

          <!-- Section D: Menu Locking Warning -->
          <div style="background-color: #ffffff; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <h3 style="color: #7c3aed; margin-top: 0;">🔒 Menu Locking Warning (&le; 4 Days Unlocked): ${menuLockingWarning.length}</h3>
            ${menuLockingWarning.map(e => `<p style="font-size: 13px; margin: 4px 0;">• <strong>${e.event_code}</strong> - ${e.client?.entity_name || 'Client'} (Date: ${new Date(e.event_date).toLocaleDateString('en-GB')})</p>`).join('') || '<p style="font-size: 12px; color: #94a3b8;">All menus locked on schedule.</p>'}
          </div>

          <!-- Section E: Quotation Locking Warning -->
          <div style="background-color: #ffffff; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <h3 style="color: #0284c7; margin-top: 0;">📝 Quotation Locking Warning (&le; 4 Days Unlocked): ${quotationLockingWarning.length}</h3>
            ${quotationLockingWarning.map(e => `<p style="font-size: 13px; margin: 4px 0;">• <strong>${e.event_code}</strong> - ${e.client?.entity_name || 'Client'} (Date: ${new Date(e.event_date).toLocaleDateString('en-GB')})</p>`).join('') || '<p style="font-size: 12px; color: #94a3b8;">All quotations locked on schedule.</p>'}
          </div>

          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px;">Sent automatically by ${companyName} Quotation System</p>
        </div>
      `

      try {
        const { error: sendErr } = await resend.emails.send({
          from: `${companyName} System <alerts@hashtaghype.in>`,
          to: [adminEmail],
          subject: `Automated 3-Day Activity Digest & Reminders - ${today.toLocaleDateString('en-GB')}`,
          html: htmlContent,
        })
        if (!sendErr) emailSent = true
        else emailError = sendErr.message
      } catch (e: any) {
        emailError = e.message
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      emailError,
      summaryReport,
    })

  } catch (error: any) {
    console.error("Cron Error: ", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
