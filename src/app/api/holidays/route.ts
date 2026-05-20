import { NextResponse } from "next/server";
import { getCachedHolidays } from "@/lib/cachedData";

export async function GET() {
  try {
    const year = new Date().getFullYear();
    const holidays = await getCachedHolidays(year);
    return NextResponse.json(holidays);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
