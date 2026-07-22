import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getServerSession } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const data = await prisma.holiday.findMany({
      orderBy: { date: 'asc' }
    });
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("GET /api/holidays error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sessionUser = session.user as any
    if (sessionUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })

    const { name, date } = await req.json();

    if (!name || !date) {
      return NextResponse.json({ error: "name and date are required" }, { status: 400 });
    }

    const holiday = await prisma.holiday.create({
      data: { name, date: new Date(date) }
    });

    // Send emails (async, don't block response)
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { email: true, name: true, communicationEmail: true }
    }).then((users) => {
      if (!users || users.length === 0) return;

      const formattedDate = new Date(date).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const emailHtml = `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #8b5cf6; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL - HOLIDAY ANNOUNCEMENT</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">New Holiday Added</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        A new public holiday has been added to the annual calendar.
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">HOLIDAY DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Holiday Name</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 16px; color: #64748b; font-size: 14px;">Date</td>
          <td style="padding: 16px; color: #0f172a; font-size: 14px; font-weight: 600;">${formattedDate}</td>
        </tr>
      </table>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Best Regards,</div>
        <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">Human Resources Team</div>
        <div style="color: #64748b;">Unique School India LLP</div>
      </div>
    </div>
  </div>
</div>`;

      Promise.all(
        users.map((u: any) => {
          const targetEmail = (u.communicationEmail && u.communicationEmail !== 'noreply@yopmail.com')
            ? u.communicationEmail
            : u.email
          return sendEmail({
            to: targetEmail,
            subject: `New Public Holiday: ${name}`,
            html: emailHtml,
          })
        })
      ).catch((err) => console.error("Holiday email blast error:", err));
    });

    return NextResponse.json(holiday);
  } catch (error: any) {
    console.error("POST /api/holidays error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sessionUser = session.user as any
    if (sessionUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })

    const { id, name, date } = await req.json();

    if (!id || !name || !date) {
      return NextResponse.json({ error: "id, name and date are required" }, { status: 400 });
    }

    const holiday = await prisma.holiday.update({
      where: { id },
      data: { name, date: new Date(date) }
    });

    // Send update emails (async, don't block response)
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { email: true, name: true, communicationEmail: true }
    }).then((users) => {
      if (!users || users.length === 0) return;

      const formattedDate = new Date(date).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const emailHtml = `
<div style="background-color: #f0f4f8; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #8b5cf6; color: #ffffff; text-align: center; padding: 16px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">LMS PORTAL - HOLIDAY ANNOUNCEMENT</div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 24px; margin-bottom: 16px;">Holiday Details Updated</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        The details of an existing public holiday have been updated in the annual calendar.
      </p>
      <div style="font-size: 13px; font-weight: bold; color: #64748b; letter-spacing: 1px; margin-bottom: 12px; text-transform: uppercase;">UPDATED HOLIDAY DETAILS</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; width: 35%;">Holiday Name</td>
          <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 16px; color: #64748b; font-size: 14px;">Date</td>
          <td style="padding: 16px; color: #0f172a; font-size: 14px; font-weight: 600;">${formattedDate}</td>
        </tr>
      </table>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px;">
        <div style="color: #94a3b8; margin-bottom: 4px;">Best Regards,</div>
        <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">Human Resources Team</div>
        <div style="color: #64748b;">Unique School India LLP</div>
      </div>
    </div>
  </div>
</div>`;

      Promise.all(
        users.map((u: any) => {
          const targetEmail = (u.communicationEmail && u.communicationEmail !== 'noreply@yopmail.com')
            ? u.communicationEmail
            : u.email
          return sendEmail({
            to: targetEmail,
            subject: `Updated Public Holiday: ${name}`,
            html: emailHtml,
          })
        })
      ).catch((err) => console.error("Holiday update email blast error:", err));
    });

    return NextResponse.json(holiday);
  } catch (error: any) {
    console.error("PUT /api/holidays error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sessionUser = session.user as any
    if (sessionUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) throw new Error("Missing ID");

    await prisma.holiday.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/holidays error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
