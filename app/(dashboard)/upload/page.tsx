export const dynamic = 'force-dynamic'
export const revalidate = 0

import { unstable_noStore as noStore } from 'next/cache'
import { getCurrentUserProfile } from '@/lib/admin'
import UploadForm from './UploadForm'

export default async function UploadPage() {
  noStore()
  const profile = await getCurrentUserProfile()
  // 厳密に role === 'admin' のときだけ true（undefined / 'user' / null はすべて false）
  const isAdmin = profile?.role === 'admin'
  return <UploadForm isAdmin={isAdmin === true} />
}
