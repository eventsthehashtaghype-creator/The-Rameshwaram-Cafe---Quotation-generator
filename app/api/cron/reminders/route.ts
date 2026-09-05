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
    const whatsappPhone = settings?.whatsapp_phone || ''
    const whatsappWebhookUrl = settings?.whatsapp_webhook_url || process.env.WHATSAPP_WEBHOOK_URL || ''
    const enableEmail = settings?.enable_email_reminders !== false
    const enableWhatsapp = settings?.enable_whatsapp_reminders !== false

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

    // >> A. Upcoming Event notification - Every week (Next 7 days)
    const upcomingEvents = events.filter(e => {
      const ed = new Date(e.event_date)
      return ed >= today && ed <= sevenDaysLater && e.status !== 'cancelled'
    })

    // >> B. New Requests - Every day (Pending admin approval or client submitted)
    const newRequests = events.filter(e =>
      e.status === 'pending_admin_approval' || e.quote_status === 'client_submitted'
    )

    // >> C. Rejected Event - Every week (status is cancelled)
    const rejectedEvents = events.filter(e => e.status === 'cancelled')

    // >> D. Menu Locking - If not locked 4 days before Event
    const menuLockingWarning = events.filter(e => {
      const ed = e.event_date
      return ed <= fourDaysStr && new Date(ed) >= today && !e.menu_locked && e.status !== 'cancelled'
    })

    // >> E. Quotation Locking - If not locked 4 days before Event
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
      upcomingEvents,
      newRequests,
      rejectedEvents,
      menuLockingWarning,
      quotationLockingWarning,
    }

    // --- 1. PREPARE WHATSAPP MESSAGE (According to the 5 rules) ---
    const waLines: string[] = [
      `🔔 *${companyName.toUpperCase()}*`,
      `*PENDING ACTIVITIES REMINDER (3-DAY CYCLE)*`,
      `📅 *Date:* ${today.toLocaleDateString('en-GB')}`,
      `─────────────────────────`,
      `*>> A. UPCOMING EVENTS (Every Week)*: ${upcomingEvents.length}`,
      upcomingEvents.length > 0
        ? upcomingEvents.map(e => `• *${e.event_code}* - ${e.client?.entity_name || 'Client'} (${new Date(e.event_date).toLocaleDateString('en-GB')})`).join('\n')
        : '• _No upcoming events in next 7 days._',
      ``,
      `*>> B. NEW REQUESTS (Every Day)*: ${newRequests.length}`,
      newRequests.length > 0
        ? newRequests.map(e => `• *${e.event_code}* - ${e.client?.entity_name || 'Client'} [Status: ${e.status}]`).join('\n')
        : '• _No pending requests requiring review._',
      ``,
      `*>> C. REJECTED EVENTS (Every Week)*: ${rejectedEvents.length}`,
      rejectedEvents.length > 0
        ? rejectedEvents.map(e => `• *${e.event_code}* - ${e.client?.entity_name || 'Client'}`).join('\n')
        : '• _No rejected/cancelled events._',
      ``,
      `*>> D. MENU LOCKING (If not locked 4 days before Event)*: ${menuLockingWarning.length}`,
      menuLockingWarning.length > 0
        ? menuLockingWarning.map(e => `• ⚠️ *${e.event_code}* - ${e.client?.entity_name || 'Client'} (Event: ${new Date(e.event_date).toLocaleDateString('en-GB')}) - *Lock Menu Immediately*`).join('\n')
        : '• _All menus locked on schedule._',
      ``,
      `*>> E. QUOTATION LOCKING (If not locked 4 days before Event)*: ${quotationLockingWarning.length}`,
      quotationLockingWarning.length > 0
        ? quotationLockingWarning.map(e => `• ⚠️ *${e.event_code}* - ${e.client?.entity_name || 'Client'} (Event: ${new Date(e.event_date).toLocaleDateString('en-GB')}) - *Lock/Submit Quote Immediately*`).join('\n')
        : '• _All quotations locked on schedule._',
      `─────────────────────────`,
      `⚙️ _Auto-generated 3-day reminder digest._`
    ]

    const whatsappMessage = waLines.join('\n')
    const cleanPhone = whatsappPhone.replace(/[^0-9]/g, '')
    const whatsappUrl = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(whatsappMessage)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`

    // --- 2. DISPATCH WHATSAPP (Webhook if configured) ---
    let whatsappSent = false
    let whatsappError: string | null = null

    if (enableWhatsapp && whatsappWebhookUrl) {
      try {
        const waRes = await fetch(whatsappWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: cleanPhone || undefined,
            message: whatsappMessage,
            summary: summaryReport
          })
        })
        if (waRes.ok) {
          whatsappSent = true
        } else {
          whatsappError = `Webhook responded with status ${waRes.status}`
        }
      } catch (err: any) {
        whatsappError = err.message
      }
    }

    // --- 3. DISPATCH EMAIL VIA RESEND ---
    let emailSent = false
    let emailError: string | null = null

    if (enableEmail && resend) {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; background-color: #f8fafc; padding: 24px; border-radius: 16px;">
          <div style="background-color: #0f172a; padding: 20px; text-align: center; border-radius: 12px; margin-bottom: 24px;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px;">${companyName} - Activity Reminders</h2>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 6px;">Automated 3-Day Activity Digest & Pending Actions</p>
          </div>

          <!-- Section A: Upcoming Events -->
          <div style="background-color: #ffffff; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <h3 style="color: #2563eb; margin-top: 0; font-size: 14px; text-transform: uppercase;">>> A. Upcoming Events (Every Week): ${upcomingEvents.length}</h3>
            ${upcomingEvents.map(e => `<p style="font-size: 13px; margin: 4px 0;">• <strong>${e.event_code}</strong> - ${e.client?.entity_name || 'Client'} (${new Date(e.event_date).toLocaleDateString('en-GB')})</p>`).join('') || '<p style="font-size: 12px; color: #94a3b8;">No upcoming events in next 7 days.</p>'}
          </div>

          <!-- Section B: New Requests -->
          <div style="background-color: #ffffff; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <h3 style="color: #d97706; margin-top: 0; font-size: 14px; text-transform: uppercase;">>> B. New Requests (Every Day): ${newRequests.length}</h3>
            ${newRequests.map(e => `<p style="font-size: 13px; margin: 4px 0;">• <strong>${e.event_code}</strong> - ${e.client?.entity_name || 'Client'} (Status: ${e.status})</p>`).join('') || '<p style="font-size: 12px; color: #94a3b8;">No pending requests requiring review.</p>'}
          </div>

          <!-- Section C: Rejected Events -->
          <div style="background-color: #ffffff; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <h3 style="color: #dc2626; margin-top: 0; font-size: 14px; text-transform: uppercase;">>> C. Rejected Events (Every Week): ${rejectedEvents.length}</h3>
            ${rejectedEvents.map(e => `<p style="font-size: 13px; margin: 4px 0;">• <strong>${e.event_code}</strong> - ${e.client?.entity_name || 'Client'}</p>`).join('') || '<p style="font-size: 12px; color: #94a3b8;">No rejected events.</p>'}
          </div>

          <!-- Section D: Menu Locking Warning -->
          <div style="background-color: #ffffff; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <h3 style="color: #7c3aed; margin-top: 0; font-size: 14px; text-transform: uppercase;">>> D. Menu Locking (If not locked 4 days before Event): ${menuLockingWarning.length}</h3>
            ${menuLockingWarning.map(e => `<p style="font-size: 13px; margin: 4px 0; color: #b45309;">• ⚠️ <strong>${e.event_code}</strong> - ${e.client?.entity_name || 'Client'} (Event Date: ${new Date(e.event_date).toLocaleDateString('en-GB')})</p>`).join('') || '<p style="font-size: 12px; color: #94a3b8;">All menus locked on schedule.</p>'}
          </div>

          <!-- Section E: Quotation Locking Warning -->
          <div style="background-color: #ffffff; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <h3 style="color: #0284c7; margin-top: 0; font-size: 14px; text-transform: uppercase;">>> E. Quotation Locking (If not locked 4 days before Event): ${quotationLockingWarning.length}</h3>
            ${quotationLockingWarning.map(e => `<p style="font-size: 13px; margin: 4px 0; color: #b45309;">• ⚠️ <strong>${e.event_code}</strong> - ${e.client?.entity_name || 'Client'} (Event Date: ${new Date(e.event_date).toLocaleDateString('en-GB')})</p>`).join('') || '<p style="font-size: 12px; color: #94a3b8;">All quotations locked on schedule.</p>'}
          </div>

          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px;">Sent automatically every 3 days by ${companyName} Quotation System</p>
        </div>
      `

      try {
        const { error: sendErr } = await resend.emails.send({
          from: `${companyName} Alerts <alerts@hashtaghype.in>`,
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
      whatsappSent,
      whatsappError,
      whatsappMessage,
      whatsappUrl,
      summaryReport,
    })

  } catch (error: any) {
    console.error("Cron Error: ", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
