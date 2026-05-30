import Anthropic from '@anthropic-ai/sdk'
import type {
  EstimateDrawingFile,
  EstimateItem,
  EstimatePendingQuestion,
  EstimateWorkType,
} from '@/types'

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const ESTIMATE_MODEL = 'claude-opus-4-7'

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
])

const PDF_MIME_TYPES = new Set(['application/pdf'])

const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/json',
  'image/vnd.dxf',
  'application/dxf',
  'application/acad',
  'application/x-acad',
  'application/autocad_dwg',
  'application/dwg',
])

export function classifyDrawingFile(file: EstimateDrawingFile) {
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  if (IMAGE_MIME_TYPES.has(type) || /\.(png|jpe?g|gif|webp)$/.test(name)) return 'image'
  if (PDF_MIME_TYPES.has(type) || /\.pdf$/.test(name)) return 'pdf'
  if (/\.(dxf|dwg)$/.test(name)) return 'cad'
  if (
    TEXT_MIME_TYPES.has(type) ||
    /\.(txt|csv|json)$/.test(name)
  ) return 'text'
  if (/\.xlsx?$/.test(name)) return 'spreadsheet'
  if (/\.docx?$/.test(name)) return 'document'
  return 'unknown'
}

export function imageMediaType(file: EstimateDrawingFile): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/jpeg' || t === 'image/jpg') return 'image/jpeg'
  if (t === 'image/png') return 'image/png'
  if (t === 'image/gif') return 'image/gif'
  if (t === 'image/webp') return 'image/webp'
  const n = file.name.toLowerCase()
  if (/\.png$/.test(n)) return 'image/png'
  if (/\.gif$/.test(n)) return 'image/gif'
  if (/\.webp$/.test(n)) return 'image/webp'
  return 'image/jpeg'
}

export interface AnalysisOutput {
  summary: string
  items: Array<{
    section?: string
    name: string
    spec?: string
    quantity?: number
    unit?: string
    unit_price?: number
    amount?: number
    source?: string
    confidence?: '高' | '中' | '低'
    notes?: string
  }>
  total_amount?: number
  total_amount_tax_included?: number
  ai_notes?: string
  pending_questions: Array<{ id: string; question: string; hint?: string }>
}

export function buildSystemPrompt(opts: {
  workType: EstimateWorkType
  prefecture?: string | null
  hasContext: boolean
  contextText?: string | null
}) {
  const { workType, prefecture, hasContext, contextText } = opts
  return `あなたは土木工事の積算（見積もり）を行う熟練の積算技術者です。
ユーザーから提供された設計図・仕様書・資料を読み取り、項目別の概算見積もりを作成してください。

【今回の工事区分】 ${workType}
${prefecture ? `【地域】 ${prefecture}（地域別の労務単価・資材単価に配慮してください）` : ''}

【積算の鉄則】
- 概算であることを前提とし、誤差は±20〜30%以内を目標にする
- 数量根拠が読み取れない場合は推測せず、必ず「不明点質問」として返す
- 単価の根拠は提示された単価表（資材単価・労務単価・歩掛）を最優先で参照する
- 単価が資料から特定できない場合は、業界一般の相場で代用し confidence を「低」とする
- 大項目（section）：道路工事なら「土工」「路盤工」「舗装工」「排水工」「付帯工」など、造成宅地なら「準備工」「土工」「擁壁工」「排水工」「外構工」など、工種ごとに整理する
- 各項目には数量・単位・単価・金額・根拠を必ず記載する
- 諸経費（共通仮設費・現場管理費・一般管理費）は別行で計上する（土木：直接工事費の概ね20〜30%目安）
- 消費税は別途算出する

【不明点質問のルール】
- 質問は最大5件まで。優先度の高いものに絞る
- 「寸法が読めない」「材料指定がない」「施工条件が不明」「地盤条件が不明」など具体的に
- 質問にはヒント（例：「設計図のSTA.0+50付近の擁壁の高さ」）を付ける

【出力フォーマット】
必ず以下のJSON形式のみを出力してください。前置きや後置きの文章は一切不要です。

{
  "summary": "工事の概要（80字以内）",
  "items": [
    {
      "section": "土工",
      "name": "掘削（オープンカット）",
      "spec": "普通土",
      "quantity": 120,
      "unit": "m3",
      "unit_price": 850,
      "amount": 102000,
      "source": "労務単価2026/04 普通作業員 + 機械損料",
      "confidence": "中",
      "notes": ""
    }
  ],
  "total_amount": 5800000,
  "total_amount_tax_included": 6380000,
  "ai_notes": "概算であり最終見積もりには現場確認が必要です。",
  "pending_questions": [
    { "id": "q1", "question": "擁壁の高さの記載が読み取れません。", "hint": "断面図STA.0+50付近の擁壁H寸法" }
  ]
}

${hasContext ? `【参照可能な社内資料・単価資料】
${contextText}` : ''}`
}

export function buildChatSystemPrompt(opts: {
  estimateSummary: string | null
  items: EstimateItem[]
  hasContext: boolean
  contextText?: string | null
}) {
  const itemsText = opts.items
    .map((i) =>
      `- [${i.section ?? '-'}] ${i.name} ${i.spec ?? ''} ${i.quantity ?? ''}${i.unit ?? ''} × ${
        i.unit_price ?? ''
      }円 = ${i.amount ?? ''}円`
    )
    .join('\n')
  return `あなたは土木工事の積算技術者です。
既に作成済みの概算見積もりについて、ユーザーから追加の質問を受け付けます。
範囲指定（「擁壁部分だけ」「3ページ目の見積もり」など）や明細の根拠への質問に答えてください。

【工事概要】
${opts.estimateSummary ?? '（未設定）'}

【現在の見積もり明細】
${itemsText || '（未作成）'}

【回答のスタイル】
- 自然な日本語で答える（箇条書きは必要な場面だけ）
- 部分見積もりを聞かれたら、対象範囲の項目を抽出して合計金額を提示
- 概算である旨を必要に応じて添える
- 数値の根拠（どの項目・単価・出典から計算したか）を明示

${opts.hasContext ? `【参考にできる社内資料】\n${opts.contextText}` : ''}`
}

export function parseAnalysisJson(text: string): AnalysisOutput {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  const raw = jsonMatch ? jsonMatch[0] : trimmed
  const parsed = JSON.parse(raw)
  if (!parsed.pending_questions) parsed.pending_questions = []
  if (!parsed.items) parsed.items = []
  if (!parsed.summary) parsed.summary = ''
  return parsed as AnalysisOutput
}

export function ensureQuestionIds(qs: AnalysisOutput['pending_questions']): EstimatePendingQuestion[] {
  return qs.map((q, i) => ({
    id: q.id || `q${i + 1}`,
    question: q.question,
    hint: q.hint,
    answered: false,
  }))
}
