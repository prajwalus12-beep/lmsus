import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = await getSupabaseServer()
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'admin@company.com')
      .maybeSingle()

    if (error || !profile) {
      return NextResponse.json({ 
        status: "FAILED", 
        error: error?.message || "User not found in profiles."
      });
    }

    return NextResponse.json({
      status: "SUCCESS",
      db_email: profile.email,
      db_role: profile.role,
      hint: "Supabase connection is successful and admin user exists in profiles."
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
