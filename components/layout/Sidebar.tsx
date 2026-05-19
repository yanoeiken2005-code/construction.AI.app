'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { HardHat, MessageSquare, Upload, FileText, LogOut, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/chat', icon: MessageSquare, label: 'AI 検索' },
  { href: '/upload', icon: Upload, label: 'ファイル追加' },
  { href: '/documents', icon: FileText, label: 'ドキュメント一覧' },
]

export default function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col h-full shrink-0">
      {/* ロゴ */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm leading-tight">建設ナレッジAI</p>
            <p className="text-xs text-slate-400">社内知識を瞬時に検索</p>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </Link>
        ))}
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mt-4 border border-amber-100',
              pathname.startsWith('/admin')
                ? 'bg-amber-50 text-amber-700'
                : 'text-amber-700 bg-amber-50/40 hover:bg-amber-50'
            )}
          >
            <Shield className="w-5 h-5 shrink-0" />
            管理画面
          </Link>
        )}
      </nav>

      {/* ログアウト */}
      <div className="px-3 py-4 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          ログアウト
        </button>
      </div>
    </aside>
  )
}
