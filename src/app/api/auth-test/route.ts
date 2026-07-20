import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: 'adminus@yopmail.com' }
    })

    if (!user) {
      return NextResponse.json({ 
        status: "FAILED", 
        error: "User not found in database."
      });
    }

    return NextResponse.json({
      status: "SUCCESS",
      db_email: user.email,
      db_role: user.role,
      hint: "Prisma connection is successful and admin user exists in database."
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
