import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const email = "admin@company.com";
    const pass = "Unique@123";
    
    // 1. Check Connection
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return NextResponse.json({ 
        status: "FAILED", 
        error: "User not found in the database. Are you sure DATABASE_URL is correct?",
        connected_to: process.env.DATABASE_URL?.split('@')[1] || "Unknown"
      });
    }

    // 2. Check Password Hashing
    const match = await bcrypt.compare(pass, user.password);
    
    return NextResponse.json({
      status: match ? "SUCCESS" : "HASH_MISMATCH",
      db_email: user.email,
      db_role: user.role,
      hash_in_db: user.password,
      does_match: match,
      hint: match ? "Login should work. Restart your server!" : "The hash in DB does not match 'Unique@123'."
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
