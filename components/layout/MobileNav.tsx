'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Upload, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/chat', icon: MessageSquare, label: 'AI検索' },
  { href: '/upload', icon: Upload, label: '追加' },
  { href: '/documents', icon: FileText, label: '一覧' },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex md:hidden z-50">
      {navItems.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
            pathname === href ? 'text-blue-600' : 'text-slate-400'
          )}
        >
          <Icon className="w-6 h-6" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
