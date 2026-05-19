import { NextResponse } from 'next/server'
import { getCurrentUserProfile } from '@/lib/admin'

export async function GET() {
  const profile = await getCurrentUserProfile()
  if (!profile) return NextResponse.json({ profile: null }, { status: 200 })
  return NextResponse.json({ profile })
}
