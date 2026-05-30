'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Upload, FileText, Shield, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/estimates', icon: Calculator, label: '見積もり' },
  { href: '/chat', icon: MessageSquare, label: 'AI検索' },
  { href: '/upload', icon: Upload, label: '追加' },
  { href: '/documents', icon: FileText, label: '一覧' },
]

export default function MobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const items = isAdmin
    ? [...navItems, { href: '/admin', icon: Shield, label: '管理' }]
    : navItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex md:hidden z-50">
      {items.map(({ href, icon: Icon, label }) => {
        const isActive =
          href === '/admin'
            ? pathname.startsWith('/admin')
            : href === '/estimates'
              ? pathname.startsWith('/estimates')
              : pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
              isActive
                ? href === '/estimates' ? 'text-emerald-600' : 'text-blue-600'
                : 'text-slate-400'
            )}
          >
            <Icon className="w-6 h-6" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
