/**
 * Ачаа олноор бүртгэх хуудасны Excel/paste импортын цэвэр функцууд.
 *
 * Толгойн нэрсийг ЗӨВХӨН ЭНД тодорхойлно (`BULK_IMPORT_COLUMNS`) — Excel парс,
 * paste парс, sample файл үүсгэх бүгд үүнийг ашигладаг тул толгойн нэр өөрчлөгдвөл
 * нэг газар л засна, drift үүсэхгүй.
 */

export interface BulkImportColumn {
  key: 'trackingNumber' | 'phone' | 'customerName' | 'quantity' | 'weightKg' | 'price'
  header: string
  required?: boolean
}

export const BULK_IMPORT_COLUMNS: BulkImportColumn[] = [
  { key: 'trackingNumber', header: 'Ачааны дугаар', required: true },
  { key: 'phone', header: 'Утас' },
  { key: 'customerName', header: 'Хүлээн авагчийн нэр' },
  { key: 'quantity', header: 'Тоо ширхэг' },
  { key: 'weightKg', header: 'Жин (кг)' },
  { key: 'price', header: 'Үнэ (₮)' },
]

export interface ParsedImportRow {
  trackingNumber: string
  phone: string
  customerName: string
  quantity: number | null
  weightKg: number | null
  price: number | null
}

export interface ImportResult {
  rows: ParsedImportRow[]
  missingRequiredColumn: boolean
  skippedCount: number
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

/** Excel/Google Sheets-ээс copy хийхэд tab-delimited байдаг тул эхлээд tab, дараа нь comma туршина. */
export function parsePastedText(text: string): (string | number)[][] {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .filter(line => line.trim().length > 0)

  return lines.map(line => (line.includes('\t') ? line.split('\t') : line.split(',')).map(cell => cell.trim()))
}

export async function parseExcelFile(file: File): Promise<(string | number)[][]> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? '']
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, blankrows: false })
}

/** Эхний мөрийг толгой гэж үзэж, `BULK_IMPORT_COLUMNS`-той тааруулна. */
export function rowsFromMatrix(matrix: (string | number)[][]): ImportResult {
  const headerRow = matrix[0]
  if (!headerRow) return { rows: [], missingRequiredColumn: true, skippedCount: 0 }

  const columnIndex = new Map<BulkImportColumn['key'], number>()
  for (const column of BULK_IMPORT_COLUMNS) {
    const index = headerRow.findIndex(cell => normalizeHeader(cell) === normalizeHeader(column.header))
    if (index !== -1) columnIndex.set(column.key, index)
  }

  if (!columnIndex.has('trackingNumber')) {
    return { rows: [], missingRequiredColumn: true, skippedCount: 0 }
  }

  const cellAt = (dataRow: (string | number)[], key: BulkImportColumn['key']) => {
    const index = columnIndex.get(key)
    return index == null ? undefined : dataRow[index]
  }

  const rows: ParsedImportRow[] = []
  let skippedCount = 0

  for (const dataRow of matrix.slice(1)) {
    const trackingNumber = String(cellAt(dataRow, 'trackingNumber') ?? '').trim()
    if (!trackingNumber) {
      skippedCount++
      continue
    }

    rows.push({
      trackingNumber,
      phone: String(cellAt(dataRow, 'phone') ?? '').trim(),
      customerName: String(cellAt(dataRow, 'customerName') ?? '').trim(),
      quantity: toNumber(cellAt(dataRow, 'quantity')),
      weightKg: toNumber(cellAt(dataRow, 'weightKg')),
      price: toNumber(cellAt(dataRow, 'price')),
    })
  }

  return { rows, missingRequiredColumn: false, skippedCount }
}

export async function downloadSampleWorkbook(): Promise<void> {
  const XLSX = await import('xlsx')

  const headers = BULK_IMPORT_COLUMNS.map(c => c.header)
  const sampleSheet = XLSX.utils.aoa_to_sheet([
    headers,
    ['SF1234567890', '99112233', 'Бат-Эрдэнэ', 1, 12.5, ''],
    ['CB9988776655', '', '', 2, '', 45000],
  ])

  const instructionSheet = XLSX.utils.aoa_to_sheet([
    ['Заавар'],
    ['1. "Ачаа" хуудасны эхний мөрийн багана нэрийг бүү өөрчил.'],
    ['2. "Ачааны дугаар" баганыг ЗААВАЛ бөглөнө, бусад нь сонголтоор.'],
    ['3. "Жин (кг)" эсвэл "Үнэ (₮)" — аль нэгийг л бөглөнө, систем дэх бүртгэлийн горим (жингээр/дүнгээр) тухайн үед аль нь хэрэглэгдэхийг шийднэ.'],
    ['4. Мөр бүр тусдаа ачаа гэсэн үг.'],
  ])

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Ачаа')
  XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Заавар')

  XLSX.writeFile(workbook, 'ачаа-загвар.xlsx')
}
