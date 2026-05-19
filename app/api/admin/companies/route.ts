import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'
import type { Company, UserPlan } from '@/types'

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('users')
      .select('company_name, plan')

    if (error) throw error

    const map = new Map<string, { plan: UserPlan; count: number }>()
    for (const row of (data ?? []) as { company_name: string | null; plan: UserPlan }[]) {
      const key = row.company_name?.trim() || '(未設定)'
      const existing = map.get(key)
      if (existing) {
        existing.count += 1
        // standard が優先 (混在時)
        if (row.plan === 'standard') existing.plan = 'standard'
      } else {
        map.set(key, { plan: row.plan, count: 1 })
      }
    }

    const companies: Company[] = Array.from(map.entries())
      .map(([company_name, v]) => ({ company_name, plan: v.plan, user_count: v.count }))
      .sort((a, b) => b.user_count - a.user_count)

    return NextResponse.json({ companies })
  } catch (error) {
    console.error('Admin companies GET error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
