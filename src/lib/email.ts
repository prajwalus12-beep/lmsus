import nodemailer from 'nodemailer'

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

export async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('SMTP settings not configured. Skipping email.')
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
