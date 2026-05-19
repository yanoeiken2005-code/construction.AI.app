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
  role: UserRole
  company_id: string | null
  company_name: string | null
  company_plan: UserPlan | null
  created_at: string
  updated_at: string
  last_sign_in_at?: string | null
}

export interface Company {
  id: string
  name: string
  plan: UserPlan
  user_count: number
  monthly_questions_used: number
  created_at: string
  updated_at: string
}

export const PLAN_LABELS: Record<UserPlan, string> = {
  small: 'スモール',
  standard: 'スタンダード',
}

export const PLAN_LIMITS: Record<UserPlan, { maxUsers: number; monthlyQuestions: number }> = {
  small: { maxUsers: 5, monthlyQuestions: 100 },
  standard: { maxUsers: 20, monthlyQuestions: 1000 },
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
