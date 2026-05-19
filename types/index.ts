export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  sources?: DocumentSource[]
  created_at: string
}

export interface DocumentSource {
  id: string
  name: string
  project_name?: string
  document_date?: string
  category?: string
  similarity?: number
  file_url?: string
}

export interface Document {
  id: string
  user_id: string
  name: string
  content?: string
  file_url?: string
  file_type?: string
  project_name?: string
  document_date?: string
  category: string
  created_at: string
}

export type UserRole = 'admin' | 'user'
export type UserPlan = 'small' | 'standard'

export interface AppUser {
  id: string
  email: string
  company_name: string | null
  role: UserRole
  plan: UserPlan
  created_at: string
  updated_at: string
  last_sign_in_at?: string | null
}

export interface Company {
  company_name: string
  plan: UserPlan
  user_count: number
}

export const PLAN_LABELS: Record<UserPlan, string> = {
  small: 'スモール',
  standard: 'スタンダード',
}

export const DOCUMENT_CATEGORIES = [
  '施工図・設計書',
  '報告書',
  'クレーム・対応記録',
  '契約書',
  '写真',
  '行政書類',
  '協力会社関連',
  'その他',
] as const

export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number]
