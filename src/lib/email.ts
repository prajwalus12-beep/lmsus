import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const port = parseInt(process.env.SMTP_PORT || '587')
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port,
  secure: port === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

/** Read EMAIL_ENABLED from system_configs. Defaults to true if the key is missing. */
async function isEmailEnabled(): Promise<boolean> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ulwoyxlnmtfnbfpfujtq.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    )
    const { data } = await supabase
      .from('system_configs')
      .select('value')
      .eq('key', 'EMAIL_ENABLED')
      .maybeSingle()
    // If the key doesn't exist yet, treat as enabled (opt-in default)
    return data?.value !== 'false'
  } catch {
    // On any error, fall through and allow sending
    return true
  }
}

export async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('SMTP settings not configured. Skipping email.')
    return
  }

  // Respect the admin EMAIL_ENABLED toggle
  const enabled = await isEmailEnabled()
  if (!enabled) {
    console.log(`Email suppressed (EMAIL_ENABLED=false): [${subject}] to ${to}`)
    return
  }

  try {
    await transporter.sendMail({
      from: `"LMS Portal" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    console.log(`Email sent to ${to}: ${subject}`)
  } catch (error) {
    console.error('Failed to send email:', error)
  }
}
