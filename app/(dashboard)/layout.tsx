export const dynamic = 'force-dynamic'

import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full bg-slate-50">
      {/* デスクトップサイドバー */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* メインコンテンツ */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden pb-16 md:pb-0">
        {children}
      </main>

      {/* モバイルボトムナビ */}
      <MobileNav />
    </div>
  )
}
