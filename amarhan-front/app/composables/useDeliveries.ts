/**
 * Хүргэлтийн API — introduction.md §5
 *
 * `usePayments`-ийн ижил хэв: `ApiError`-оор машинд уншигдах `code`/`details`-ыг
 * хамгаална. §5.2-ын урсгалд `code === 'UNPAID_PACKAGES'` ба
 * `details.unpaidTotal` хоёроос "Төлбөр дутуу байна: XXX₮" мэдэгдэл гарна —
 * мессежийн ТЕКСТЭД хамаарах нь эмзэг.
 */

import { ApiError, type CargoPackage, type Pagination } from './usePackages'
import type { DeliveryStatus } from './useStatus'

export interface Delivery {
  id: string
  deliveryNumber: string
  customerId: string | { id: string; phone: string; name: string | null }
  customerPhone: string
  packageIds: Array<
    string | { id: string; trackingNumber: string; balance: number; status: string }
  >
  address: string
  phone: string
  note: string | null
  status: DeliveryStatus
  driverId: { id: string; firstname?: string; lastname?: string } | string | null
  driverName: string | null
  driverPhone: string | null
  scheduledDate: string | null
  dispatchedAt: string | null
  deliveredAt: string | null
  fee: number
  createdBy: { firstname?: string; lastname?: string } | string | null
  statusHistory: Array<{
    from: string | null
    to: string
    at: string
    byName: string | null
    reason: string | null
  }>
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
}

export interface UnpaidPackage {
  id: string
  trackingNumber: string
  balance: number
}

export interface DeliveryDetail {
  delivery: Delivery
  auditLogs: any[]
  unpaidPackages: UnpaidPackage[]
  /** §5.2 — «Төлбөр дутуу байна: XXX₮». Backend бодно, client талд БИШ */
  unpaidTotal: number
  /** Ажилтан ГАРААР дарж болох төлөвүүд (цуцлах орохгүй) */
  allowedTransitions: DeliveryStatus[]
}

export interface DeliverySummary {
  total: number
  packageCount: number
  byStatus: Record<string, { count: number; packageCount: number }>
}

export interface DeliveryPayload {
  packageIds: string[]
  address: string
  phone?: string
  note?: string
  driverId?: string | null
  driverName?: string | null
  driverPhone?: string | null
  scheduledDate?: string | null
  fee?: number
}

/** Backend-ийн `ERROR_CODE`-той нийцнэ */
export const DELIVERY_ERROR_CODE = {
  UNPAID_PACKAGES: 'UNPAID_PACKAGES',
  PACKAGE_IN_ACTIVE_DELIVERY: 'PACKAGE_IN_ACTIVE_DELIVERY',
  INVALID_DELIVERY_TRANSITION: 'INVALID_DELIVERY_TRANSITION',
  MIXED_CUSTOMERS: 'MIXED_CUSTOMERS',
} as const

const API = '/api/v1/deliveries'

export function useDeliveries() {
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

  /** Нэг объект буцаадаг endpoint-ууд. ЖАГСААЛТАД хэрэглэхгүй */
  async function call<T>(fn: () => Promise<any>): Promise<T> {
    try {
      const response = await fn()
      return response.data.data as T
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  /** §9.3 — шүүлт, хуудаслалт БҮРЭН server талд */
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
        data: (response.data.data ?? []) as Delivery[],
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

  /** §5 — өдрийн маршрутын нэгтгэл */
  const summary = (filters: Record<string, any> = {}) =>
    call<DeliverySummary>(() => $axios.get(`${API}/summary`, { params: filters }))

  const detail = (id: string) => call<DeliveryDetail>(() => $axios.get(`${API}/${id}`))

  const forPackage = (packageId: string) =>
    call<Delivery[]>(() => $axios.get(`${API}/package/${packageId}`))

  /** §5 — хүргэлт үүсгэхийн ӨМНӨХ дэлгэц */
  const deliverableByPhone = (phone: string) =>
    call<{
      customer: { id: string; phone: string; name: string | null }
      packages: CargoPackage[]
      totalBalance: number
      inActiveDelivery: Array<{ id: string; deliveryNumber: string; status: string }>
    }>(() => $axios.get(`${API}/deliverable/${encodeURIComponent(phone)}`))

  const create = (payload: DeliveryPayload) =>
    call<Delivery>(() => $axios.post(API, payload))

  const update = (id: string, payload: Partial<DeliveryPayload>) =>
    call<Delivery>(() => $axios.put(`${API}/${id}`, payload))

  /**
   * §5.2 — төлбөр дутуу бол `ApiError.code === 'UNPAID_PACKAGES'` шиднэ.
   * OVERRIDE БАЙХГҮЙ: `force` гэсэн параметр backend-д ч, энд ч байхгүй.
   */
  const changeStatus = (id: string, status: DeliveryStatus, reason?: string) =>
    call<Delivery>(() => $axios.put(`${API}/${id}/status`, { status, reason }))

  /** §5 — өдрийн маршрутыг нэг дор гаргах */
  const changeStatusBulk = (ids: string[], status: DeliveryStatus, reason?: string) =>
    call<{
      succeeded: Array<{ id: string; deliveryNumber: string }>
      failed: Array<{ id: string; message: string; code: string | null }>
      total: number
    }>(() => $axios.put(`${API}/bulk/status`, { ids, status, reason }))

  // Устгахгүй, цуцална (CLAUDE.md §5 дүрэм 4)
  const cancel = (id: string, reason: string) =>
    call<Delivery>(() => $axios.put(`${API}/${id}/cancel`, { reason }))

  return {
    list,
    summary,
    detail,
    forPackage,
    deliverableByPhone,
    create,
    update,
    changeStatus,
    changeStatusBulk,
    cancel,
  }
}
