import { createClient } from '@/lib/supabase/server'
import type { AppUser, UserPlan } from '@/types'

type JoinedUserRow = {
  id: string
  email: string
  role: 'admin' | 'user'
  company_id: string | null
  created_at: string
  updated_at: string
  companies: { name: string; plan: UserPlan } | { name: string; plan: UserPlan }[] | null
}

function flattenUserRow(row: JoinedUserRow): AppUser {
  const company = Array.isArray(row.companies) ? row.companies[0] : row.companies
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    company_id: row.company_id,
    company_name: company?.name ?? null,
    company_plan: company?.plan ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function getCurrentUserProfile(): Promise<AppUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('id, email, role, company_id, created_at, updated_at, companies(name, plan)')
    .eq('id', user.id)
    .maybeSingle()

  if (!data) return null
  return flattenUserRow(data as JoinedUserRow)
}

export async function requireAdmin(): Promise<AppUser | null> {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') return null
  return profile
}

export function startOfCurrentMonthIso(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
