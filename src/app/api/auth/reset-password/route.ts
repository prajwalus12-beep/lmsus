import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { encryptSession } from "@/lib/session"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 })
    }

    // 1. Verify if the email is registered in DB
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true, communicationEmail: true }
    })

    if (!user) {
      // Prevent user enumeration by sending a generic successful response
      return NextResponse.json({ 
        status: "SUCCESS", 
        message: "Password reset link has been sent to your registered email!" 
      })
    }

    // 2. Generate encrypted reset token (expires in 1 hour)
    const token = encryptSession({
      email: user.email,
      exp: Date.now() + 60 * 60 * 1000 // 1 hour
    })

    const origin = new URL(request.url).origin
    const resetLink = `${origin}/login/reset-password?token=${encodeURIComponent(token)}`

    // 3. Format professional HTML email
    const name = user.name || "User"
    const htmlContent = `
<div style="background-color: #f8fafc; padding: 40px 20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
    <div style="background-color: #4f46e5; color: #ffffff; padding: 28px; text-align: center;">
      <span style="font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: 0.9; display: block; margin-bottom: 4px;">Leave Management System</span>
      <h1 style="font-size: 22px; font-weight: 600; margin: 0; letter-spacing: 0.5px;">Password Reset Request</h1>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 600; margin-bottom: 8px;">Hello ${name},</h2>
      <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
        We received a request to reset the password for your LMS account. Click the button below to choose a new password:
      </p>
      
      <div style="text-align: center; margin-bottom: 28px;">
        <a href="${resetLink}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 30px; font-size: 15px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2); transition: background-color 0.2s;">
          Reset Password
        </a>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 12px;">
        This password reset link will expire in 1 hour. If you did not request this, you can safely ignore this email — your password will remain unchanged.
      </p>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

      <p style="font-size: 11px; color: #94a3b8; line-height: 1.5; word-break: break-all; margin: 0;">
        If the button above does not work, copy and paste this URL into your browser:<br />
        <a href="${resetLink}" style="color: #4f46e5; text-decoration: underline;">${resetLink}</a>
      </p>
    </div>
    <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
      LMS SaaS · Confidential · Please do not forward this email.
    </div>
  </div>
</div>
`

    const targetEmail = (user.communicationEmail && user.communicationEmail !== 'noreply@yopmail.com')
      ? user.communicationEmail
      : user.email

    // 4. Send email using SMTP helper
    await sendEmail({
      to: targetEmail,
      subject: `Reset your LMS account password`,
      html: htmlContent
    })

    return NextResponse.json({ 
      status: "SUCCESS", 
      message: "Password reset link has been sent to your registered email!" 
    })
  } catch (err: any) {
    console.error("API reset password error:", err)
    return NextResponse.json({ error: err?.message || "An error occurred. Please try again." }, { status: 500 })
  }
}
