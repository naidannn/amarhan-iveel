/**
 * Зарлагын API — docs/business-rules.md BR-47
 *
 * `usePayments`-ийн ижил хэв: `ApiError`-оор машинд уншигдах `code`-ыг хамгаална.
 * Зөвхөн Менежер/Админ хандах endpoint (Ажилтанд backend `403` буцаана).
 */

import { ApiError, type Pagination } from './usePackages'

export type ExpenseCategory =
  | 'rent'
  | 'salary'
  | 'fuel'
  | 'office'
  | 'maintenance'
  | 'cargo'
  | 'other'
export type ExpenseStatus = 'active' | 'voided'

export const EXPENSE_CATEGORY_OPTIONS: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'rent', label: 'Түрээс' },
  { value: 'salary', label: 'Цалин' },
  { value: 'fuel', label: 'Шатахуун/Тээвэр' },
  { value: 'office', label: 'Оффисын зардал' },
  { value: 'maintenance', label: 'Засвар үйлчилгээ' },
  { value: 'cargo', label: 'Ачааны тээвэрлэлт' },
  { value: 'other', label: 'Бусад' },
]

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = Object.fromEntries(
  EXPENSE_CATEGORY_OPTIONS.map(o => [o.value, o.label])
) as Record<ExpenseCategory, string>

export interface Expense {
  id: string
  amount: number
  category: ExpenseCategory
  categoryLabel: string | null
  description: string
  date: string
  branchId: string | { id: string; code: string; name: string }
  status: ExpenseStatus
  createdBy: { firstname?: string; lastname?: string } | string | null
  createdByName: string | null
  voidedAt: string | null
  voidedBy: string | null
  voidReason: string | null
  createdAt: string
}

export interface ExpenseSummary {
  total: number
  count: number
  byCategory: Record<string, { total: number; count: number }>
}

/** Backend-ийн `ERROR_CODE`-той нийцнэ */
export const EXPENSE_ERROR_CODE = {
  EXPENSE_ALREADY_VOIDED: 'EXPENSE_ALREADY_VOIDED',
} as const

/** Категорийн МОНГОЛ нэрийг харуулна — "Бусад" бол ажилтны бичсэн нэрийг ашиглана */
export function expenseCategoryLabel(expense: Pick<Expense, 'category' | 'categoryLabel'>) {
  if (expense.category === 'other' && expense.categoryLabel) return expense.categoryLabel
  return EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category
}

const API = '/api/v1/expenses'

export function useExpenses() {
  const { $axios } = useNuxtApp()

  function toApiError(e: any): ApiError {
    const body = e.response?.data
    const message =
      body?.errors?.[0]?.message || body?.message || e.message || 'Хүсэлт биелсэнгүй'
    return new ApiError(message, {
      code: body?.code ?? null,
      details: body?.details ?? null,
      status: e.response?.status ?? 0,
    })
  }

  async function call<T>(fn: () => Promise<any>): Promise<T> {
    try {
      const response = await fn()
      return response.data.data as T
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  /** §9.3 — хайлт БҮРЭН server талд */
  async function list(filters: Record<string, any> = {}) {
    const params: Record<string, any> = {}
    for (const [key, value] of Object.entries(filters)) {
      if (value === '' || value == null) continue
      params[key] = value
    }

    try {
      const response = await $axios.get(API, { params })
      return {
        data: (response.data.data ?? []) as Expense[],
        pagination: (response.data.pagination ?? {
          page: 1,
          pages: 1,
          total: 0,
          limit: params.limit ?? 50,
        }) as Pagination,
      }
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  const summary = (filters: Record<string, any> = {}) =>
    call<ExpenseSummary>(() => $axios.get(`${API}/summary`, { params: filters }))

  const create = (payload: {
    amount: number
    category: ExpenseCategory
    categoryLabel?: string
    description: string
    date?: string
  }) => call<Expense>(() => $axios.post(API, payload))

  // BR-47 — устгахгүй, хүчингүй болгоно
  const voidExpense = (id: string, reason: string) =>
    call<Expense>(() => $axios.put(`${API}/${id}/void`, { reason }))

  return { list, summary, create, voidExpense }
}
