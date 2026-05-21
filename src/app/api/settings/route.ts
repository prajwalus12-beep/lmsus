import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getCachedDepartments } from "@/lib/cachedData"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const tab = searchParams.get("tab")

    if (tab === "departments") {
      const departments = await getCachedDepartments()
      return NextResponse.json({ departments })
    }

    return NextResponse.json({ error: "Invalid tab parameter" }, { status: 400 })
  } catch (error: any) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
