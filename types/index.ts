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
export type UserPlan = 'solo' | 'small' | 'standard'

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
  solo: 'ソロ',
  small: 'スモール',
  standard: 'スタンダード',
}

export const PLAN_LIMITS: Record<UserPlan, { maxUsers: number; monthlyQuestions: number }> = {
  solo: { maxUsers: 1, monthlyQuestions: 30 },
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
  '単価表・歩掛',
  'その他',
] as const

export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number]

// =============================================
// 見積もり機能
// =============================================
export type EstimateStatus =
  | 'draft'
  | 'analyzing'
  | 'pending_questions'
  | 'ready'
  | 'archived'

export type EstimateWorkType = '道路' | '造成' | '混在' | 'その他'

export const ESTIMATE_WORK_TYPES: EstimateWorkType[] = ['道路', '造成', '混在', 'その他']

export interface EstimateDrawingFile {
  url: string
  name: string
  type: string
  size: number
}

export interface EstimatePendingQuestion {
  id: string
  question: string
  hint?: string
  answered?: boolean
}

export interface Estimate {
  id: string
  user_id: string
  company_id: string | null
  project_name: string
  prefecture: string | null
  work_type: EstimateWorkType
  status: EstimateStatus
  drawing_files: EstimateDrawingFile[]
  pending_questions: EstimatePendingQuestion[]
  user_answers: Record<string, string>
  summary: string | null
  total_amount: number | null
  total_amount_tax_included: number | null
  ai_notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface EstimateItem {
  id: string
  estimate_id: string
  display_order: number
  section: string | null
  name: string
  spec: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  amount: number | null
  source: string | null
  confidence: '高' | '中' | '低'
  notes: string | null
  created_at: string
}

export interface EstimateMessage {
  id: string
  estimate_id: string
  user_id: string
  role: MessageRole
  content: string
  sources?: DocumentSource[]
  created_at: string
}

export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
] as const
export type Prefecture = typeof PREFECTURES[number]
