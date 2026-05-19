export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HardHat, Users, Building2, ArrowLeft } from 'lucide-react'
import { getCurrentUserProfile } from '@/lib/admin'
import AdminSignOut from './AdminSignOut'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/chat')
  const admin = profile

  return (
    <div className="flex h-full bg-slate-50">
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-100 flex-col h-full shrink-0">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center">
              <HardHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-tight">管理画面</p>
              <p className="text-xs text-slate-400">{admin.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            <Users className="w-5 h-5 shrink-0" />
            ユーザー
          </Link>
          <Link
            href="/admin/companies"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            <Building2 className="w-5 h-5 shrink-0" />
            会社一覧
          </Link>
          <Link
            href="/chat"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors mt-4"
          >
            <ArrowLeft className="w-5 h-5 shrink-0" />
            アプリへ戻る
          </Link>
        </nav>

        <div className="px-3 py-4 border-t border-slate-100">
          <AdminSignOut />
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* モバイル用ヘッダー */}
        <div className="md:hidden bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center">
              <HardHat className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm text-slate-800">管理画面</span>
          </div>
          <Link href="/chat" className="text-xs text-slate-500 flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> アプリへ
          </Link>
        </div>

        {/* モバイル用タブ */}
        <div className="md:hidden bg-white border-b border-slate-100 flex shrink-0">
          <Link href="/admin" className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-slate-600">
            <Users className="w-4 h-4" /> ユーザー
          </Link>
          <Link href="/admin/companies" className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-slate-600 border-l border-slate-100">
            <Building2 className="w-4 h-4" /> 会社
          </Link>
        </div>

        {children}
      </main>
    </div>
  )
}
