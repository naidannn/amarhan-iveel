/**
 * Төлбөрийн API — introduction.md §1.8, §2
 *
 * `usePackages`-ийн ижил хэв: `ApiError`-оор машинд уншигдах `code`/`details`-ыг
 * хамгаална. §2-ын урсгалд `code === 'OVERPAYMENT'` ба `'ALLOCATION_MISMATCH'`
 * хоёрыг ялгаж харуулах шаардлагатай — мессежийн ТЕКСТЭД хамаарах нь эмзэг.
 */

import { ApiError, type CargoPackage, type Pagination } from './usePackages'

export type PaymentMethodValue = 'cash' | 'bank' | 'card' | 'qpay'
export type PaymentRecordStatus = 'pending' | 'completed' | 'voided'
export type InvoiceStatusValue = 'open' | 'paid' | 'cancelled'

export interface Allocation {
  packageId: string | { id: string; trackingNumber: string; finalPrice: number }
  amount: number
}

export interface Payment {
  id: string
  amount: number
  method: PaymentMethodValue
  invoiceId: string | null
  customerId: string | { id: string; phone: string; name: string | null }
  customerPhone: string
  allocations: Allocation[]
  status: PaymentRecordStatus
  receivedBy: { firstname?: string; lastname?: string } | string | null
  receivedByName: string | null
  note: string | null
  voidedAt: string | null
  voidReason: string | null
  createdAt: string
}

export interface InvoiceItem {
  packageId: string | { id: string; trackingNumber: string; balance: number }
  trackingNumber: string
  amount: number
}

export interface Invoice {
  id: string
  invoiceNumber: string
  customerId: string | { id: string; phone: string; name: string | null }
  customerPhone: string
  items: InvoiceItem[]
  totalAmount: number
  paidAmount: number
  status: InvoiceStatusValue
  createdBy: { firstname?: string; lastname?: string } | string | null
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
}

export interface PaymentSummary {
  total: number
  count: number
  byMethod: Record<string, { total: number; count: number }>
}

/** Backend-ийн `ERROR_CODE`-той нийцнэ */
export const PAYMENT_ERROR_CODE = {
  OVERPAYMENT: 'OVERPAYMENT',
  ALLOCATION_MISMATCH: 'ALLOCATION_MISMATCH',
  PAYMENT_ALREADY_VOIDED: 'PAYMENT_ALREADY_VOIDED',
  MIXED_CUSTOMERS: 'MIXED_CUSTOMERS',
} as const

const API = '/api/v1/payments'

export function usePayments() {
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

  /** Нэг объект буцаадаг endpoint-ууд. ЖАГСААЛТАД хэрэглэхгүй (`pagination` хаягдана) */
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
      if (Array.isArray(value) && value.length === 0) continue
      params[key] = value
    }

    try {
      const response = await $axios.get(API, { params })
      return {
        data: (response.data.data ?? []) as Payment[],
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

  /** §2.2 — өдрийн касс тулгах нийлбэрүүд */
  const summary = (filters: Record<string, any> = {}) =>
    call<PaymentSummary>(() => $axios.get(`${API}/summary`, { params: filters }))

  const forPackage = (packageId: string) =>
    call<Payment[]>(() => $axios.get(`${API}/package/${packageId}`))

  /**
   * Төлбөр бүртгэх. `invoiceId`, `packageIds`, `allocations`-ийн ЯДАЖ НЭГ.
   * Хуваарилалтыг backend бодно (BR-17) — client талд бодохыг хориглоно.
   */
  const create = (payload: {
    amount: number
    method: PaymentMethodValue
    invoiceId?: string
    packageIds?: string[]
    allocations?: Array<{ packageId: string; amount: number }>
    note?: string
  }) =>
    call<{ payment: Payment; packages: CargoPackage[] }>(() => $axios.post(API, payload))

  // BR-18 — устгахгүй, хүчингүй болгоно
  const voidPayment = (id: string, reason: string) =>
    call<{ payment: Payment; packages: CargoPackage[] }>(() =>
      $axios.put(`${API}/${id}/void`, { reason })
    )

  // ── Нэгтгэсэн нэхэмжлэх (§2.3) ─────────────────────────────────────────

  async function listInvoices(filters: Record<string, any> = {}) {
    const params: Record<string, any> = {}
    for (const [key, value] of Object.entries(filters)) {
      if (value === '' || value == null) continue
      params[key] = value
    }

    try {
      const response = await $axios.get(`${API}/invoices`, { params })
      return {
        data: (response.data.data ?? []) as Invoice[],
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

  const createInvoice = (packageIds: string[]) =>
    call<Invoice>(() => $axios.post(`${API}/invoices`, { packageIds }))

  const invoiceDetail = (id: string) =>
    call<{
      invoice: Invoice
      payments: Payment[]
      auditLogs: any[]
      balance: number
    }>(() => $axios.get(`${API}/invoices/${id}`))

  const cancelInvoice = (id: string, reason: string) =>
    call<Invoice>(() => $axios.put(`${API}/invoices/${id}/cancel`, { reason }))

  /** §2.3 — нэхэмжлэх үүсгэхийн ӨМНӨХ дэлгэц */
  const payableByPhone = (phone: string) =>
    call<{
      customer: { id: string; phone: string; name: string | null }
      packages: CargoPackage[]
      totalBalance: number
    }>(() => $axios.get(`${API}/invoices/payable/${encodeURIComponent(phone)}`))

  return {
    list,
    summary,
    forPackage,
    create,
    voidPayment,
    listInvoices,
    createInvoice,
    invoiceDetail,
    cancelInvoice,
    payableByPhone,
  }
}
