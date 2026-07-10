import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  const sessionUser = session?.user as any
  if (sessionUser?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password, role, departmentId, joinDate, openingPl, openingCl } = await req.json()
  const finalPassword = password || 'Unique@123'

  // 1. Create User in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: finalPassword,
    email_confirm: true,
    user_metadata: { name, role: role || "EMPLOYEE" }
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const userId = authData.user.id

  // 2. Update the profile record (created by trigger) with department and joinDate
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      department_id: departmentId || null,
      join_date: joinDate ? new Date(joinDate).toISOString() : new Date().toISOString(),
      status: 'ACTIVE'
    })
    .eq('id', userId)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // 3. Create default leave_balances
  const parsedPl = parseFloat(openingPl) || 0
  const parsedCl = parseFloat(openingCl) || 0

  const { error: balanceError } = await supabaseAdmin
    .from('leave_balances')
    .insert({
      user_id: userId,
      year: new Date().getFullYear(),
      opening_pl: parsedPl,
      opening_cl: parsedCl,
      pl: parsedPl,
      cl: parsedCl,
      sl: 7,
      comp: 0,
      pl_accrued: 0,
      pl_used: 0,
      cl_used: 0,
      sl_used: 0,
      pl_carry_forward: 0
    })

  if (balanceError) {
    return NextResponse.json({ error: balanceError.message }, { status: 500 })
  }

  // 4. Send Confirmation / Welcome Email
  try {
    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    await sendEmail({
      to: email,
      subject: `Welcome to the Leave Management System (LMS) - Account Created`,
      html: `
<div style="background-color: #f8fafc; padding: 40px 20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
    <div style="background-color: #4f46e5; color: #ffffff; padding: 28px; text-align: center;">
      <span style="font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: 0.9; display: block; margin-bottom: 4px;">Leave Management System</span>
      <h1 style="font-size: 22px; font-weight: 600; margin: 0; letter-spacing: 0.5px;">Welcome to LMS!</h1>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 600; margin-bottom: 8px;">Hello ${name},</h2>
      <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
        An account has been created for you on the Leave Management System. You can now log in and start managing your leave balance, submissions, and calendar.
      </p>
      
      <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 24px; font-size: 14px;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 12px;">Your Login Credentials</span>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color: #64748b; padding-bottom: 8px; width: 35%;">Portal URL</td>
            <td style="color: #0f172a; font-weight: 600; padding-bottom: 8px;"><a href="${appUrl}/login" style="color: #4f46e5; text-decoration: none;">${appUrl}/login</a></td>
          </tr>
          <tr>
            <td style="color: #64748b; padding-bottom: 8px;">Email Address</td>
            <td style="color: #0f172a; font-weight: 600; padding-bottom: 8px;">${email}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Password</td>
            <td style="color: #0f172a; font-weight: 600; font-family: monospace; font-size: 15px;">${finalPassword}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${appUrl}/login" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
          Log In to Portal
        </a>
      </div>

      <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 28px; font-size: 13.5px; color: #b45309; line-height: 1.5;">
        <strong>Security Notice:</strong> For security reasons, we strongly recommend that you change your password immediately after logging in for the first time.
      </div>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px; text-align: center;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Leave Management System</div>
        <div style="color: #cbd5e1; font-size: 12px;">Unique School India LLP</div>
      </div>
    </div>
  </div>
</div>
    `
    })
  } catch (emailErr) {
    console.error("Failed to send welcome email:", emailErr)
  }

  return NextResponse.json({ id: userId, name, email, role })
}
