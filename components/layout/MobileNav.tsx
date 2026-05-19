'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Upload, FileText, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
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
      {items.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
            (href === '/admin' ? pathname.startsWith('/admin') : pathname === href)
              ? 'text-blue-600'
              : 'text-slate-400'
          )}
        >
          <Icon className="w-6 h-6" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
