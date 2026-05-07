import { NextRequest, NextResponse } from 'next/server'

function row(label: string, value: string) {
  return `
    <tr>
      <td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#1a2d4f;width:180px;border:1px solid #e2e8f0;vertical-align:top;">${label}</td>
      <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#374151;">${value}</td>
    </tr>`
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const {
    name, organisation, email, phone,
    sport, tournamentType, format, teamCount,
    location, expectedDate, notes,
  } = body

  if (!name || !organisation || !email || !sport || !tournamentType || !format || !teamCount) {
    return NextResponse.json({ error: 'Please fill in all required fields.' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('RESEND_API_KEY is not configured')
    return NextResponse.json({ error: 'Email service not configured — contact support.' }, { status: 500 })
  }

  const toEmail = process.env.INTEREST_EMAIL ?? 'bav.j.patel@gmail.com'

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:620px;margin:0 auto;color:#111827;">
      <div style="background:#1a2d4f;padding:24px 32px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;color:#ffffff;">New Registration of Interest</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">TournaMate — tournament platform</p>
      </div>
      <div style="background:#ffffff;padding:24px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        <table style="width:100%;border-collapse:collapse;">
          ${row('Name', name)}
          ${row('Organisation', organisation)}
          ${row('Email', `<a href="mailto:${email}" style="color:#f47c20;">${email}</a>`)}
          ${phone ? row('Phone', phone) : ''}
          ${row('Sport', sport)}
          ${row('Tournament Type', tournamentType)}
          ${row('Expected Format', format)}
          ${row('Number of Teams', teamCount)}
          ${location ? row('Location / Region', location) : ''}
          ${expectedDate ? row('Expected Date', expectedDate) : ''}
          ${notes ? row('Additional Notes', notes.replace(/\n/g, '<br>')) : ''}
        </table>
        <p style="margin-top:24px;font-size:12px;color:#9ca3af;">
          Submitted via the TournaMate Register Your Interest form. Reply directly to this email to respond to ${name}.
        </p>
      </div>
    </div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TournaMate <onboarding@resend.dev>',
      to: [toEmail],
      reply_to: email,
      subject: `Interest: ${name} — ${organisation} (${sport})`,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('Resend error:', err)
    return NextResponse.json({ error: 'Failed to send — please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
