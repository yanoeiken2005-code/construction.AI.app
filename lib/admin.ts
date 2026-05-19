import { createClient } from '@/lib/supabase/server'
import type { AppUser } from '@/types'

export async function getCurrentUserProfile(): Promise<AppUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('id, email, company_name, role, plan, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle()

  return (data as AppUser) ?? null
}

export async function requireAdmin(): Promise<AppUser | null> {
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') return null
  return profile
}
