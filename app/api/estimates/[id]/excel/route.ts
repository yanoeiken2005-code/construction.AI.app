import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { data: estimate } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!estimate) return NextResponse.json({ error: '見積もりが見つかりません' }, { status: 404 })

    const { data: items } = await supabase
      .from('estimate_items')
      .select('*')
      .eq('estimate_id', id)
      .order('display_order')

    const workbook = new ExcelJS.Workbook()
    workbook.creator = '建設ナレッジAI'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('見積書', { properties: { defaultRowHeight: 20 } })

    sheet.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: '工種', key: 'section', width: 14 },
      { header: '項目名', key: 'name', width: 32 },
      { header: '規格・仕様', key: 'spec', width: 22 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '単位', key: 'unit', width: 8 },
      { header: '単価', key: 'unit_price', width: 12 },
      { header: '金額', key: 'amount', width: 14 },
      { header: '根拠', key: 'source', width: 28 },
      { header: '信頼度', key: 'confidence', width: 8 },
      { header: '備考', key: 'notes', width: 24 },
    ]

    // タイトル
    sheet.insertRow(1, [])
    sheet.insertRow(1, [`概算見積書`])
    sheet.mergeCells('A1:K1')
    const titleCell = sheet.getCell('A1')
    titleCell.font = { size: 18, bold: true }
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    sheet.getRow(1).height = 32

    // メタ情報
    sheet.insertRow(2, [`工事名： ${estimate.project_name}`])
    sheet.mergeCells('A2:K2')
    sheet.insertRow(3, [
      `都道府県： ${estimate.prefecture ?? '未設定'}   工事区分： ${estimate.work_type}   作成日： ${new Date().toLocaleDateString('ja-JP')}`,
    ])
    sheet.mergeCells('A3:K3')
    sheet.insertRow(4, [])

    // ヘッダー行はExcelJSのcolumns設定で5行目に来る
    const headerRow = sheet.getRow(5)
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' },
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
    })

    // 明細行
    const rows = items || []
    rows.forEach((it, i) => {
      const row = sheet.addRow({
        no: i + 1,
        section: it.section ?? '',
        name: it.name ?? '',
        spec: it.spec ?? '',
        quantity: it.quantity ?? '',
        unit: it.unit ?? '',
        unit_price: it.unit_price ?? '',
        amount: it.amount ?? '',
        source: it.source ?? '',
        confidence: it.confidence ?? '',
        notes: it.notes ?? '',
      })
      row.eachCell((cell, col) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        }
        if (col === 7 || col === 8) {
          cell.numFmt = '#,##0'
          cell.alignment = { horizontal: 'right' }
        }
        if (col === 5) cell.alignment = { horizontal: 'right' }
      })
    })

    // 合計行
    sheet.addRow([])
    const subTotal = sheet.addRow({
      no: '',
      section: '',
      name: '小計（直接工事費）',
      spec: '',
      quantity: '',
      unit: '',
      unit_price: '',
      amount: estimate.total_amount ?? 0,
      source: '',
      confidence: '',
      notes: '',
    })
    subTotal.font = { bold: true }
    subTotal.getCell('amount').numFmt = '#,##0'
    subTotal.getCell('amount').alignment = { horizontal: 'right' }

    const taxTotal = sheet.addRow({
      no: '',
      section: '',
      name: '合計（税込）',
      spec: '',
      quantity: '',
      unit: '',
      unit_price: '',
      amount: estimate.total_amount_tax_included ?? 0,
      source: '',
      confidence: '',
      notes: '',
    })
    taxTotal.font = { bold: true, size: 13 }
    taxTotal.getCell('amount').numFmt = '#,##0'
    taxTotal.getCell('amount').alignment = { horizontal: 'right' }
    taxTotal.getCell('amount').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF9C4' },
    }

    // 注記
    sheet.addRow([])
    sheet.addRow([`AI注記： ${estimate.ai_notes ?? '概算であり、最終見積もりには現場確認が必要です。'}`])
    sheet.addRow([`※ このシートは建設ナレッジAIによって生成された概算見積もりです。`])

    const buffer = await workbook.xlsx.writeBuffer()
    const safeFile = encodeURIComponent(`見積_${estimate.project_name}_${new Date().toISOString().slice(0, 10)}.xlsx`)

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${safeFile}`,
      },
    })
  } catch (error) {
    console.error('Excel export error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
