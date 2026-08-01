/**
 * Ачааны API — introduction.md §1
 *
 * ЯАГААД `useApi()`-г шууд хэрэглээгүй: `useApi` алдааг мөр болгон хувиргаж
 * (`error.value = message`) машинд уншигдах `code`/`details`-ыг ХАЯДАГ.
 * §1.3-ийн давхардлын урсгал нь `code === 'DUPLICATE_TRACKING_NUMBER'` ба
 * `details.packageId`-аас хамаардаг тул бүтэн алдааг дамжуулах шаардлагатай.
 */

export type PackageStatusValue =
  | 'expected'
  | 'in_erlian'
  | 'registered'
  | 'notified'
  | 'awaiting_payment'
  | 'paid'
  | 'out_for_delivery'
  | 'picked_up'
  | 'delivered'
  | 'returned'
  | 'cancelled'

export interface CargoPackage {
  id: string
  trackingNumber: string
  customerId: string | { id: string; phone: string; name: string | null } | null
  customerPhone: string | null
  branchCode: string
  cargoTypeId: string | { id: string; code: string; name: string } | null
  quantity: number
  weightKg: number | null
  volumeM3: number | null
  dimensions: { lengthCm: number; widthCm: number; heightCm: number } | null
  computedPrice: number
  finalPrice: number
  priceSource: 'weight' | 'volume' | 'minimum' | 'manual' | 'pending'
  priceOverridden: boolean
  priceOverrideReason: string | null
  // `null` = ажилтан үнийг гараар заасан (BR-01a)
  pricingSnapshot: Record<string, any> | null
  paidAmount: number
  balance: number
  paymentStatus: 'unpaid' | 'partial' | 'paid'
  status: PackageStatusValue
  statusHistory: Array<{
    from: string | null
    to: string
    at: string
    byName: string | null
    reason: string | null
  }>
  locationCode: string | null
  arrivedAt: string
  note: string | null
  /** BR-46 — харилцагчийн өөрийн бичсэн тайлбар (`note` бол ажилтны дотоод) */
  customerNote: string | null
  /** BR-46 — бичлэгийг ажилтан эхлүүлсэн үү, харилцагч өөрөө үү */
  registrationSource: 'staff' | 'customer'
  isDuplicateApproved: boolean
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  registeredBy?: { firstname?: string; lastname?: string } | string | null
}

export interface Pagination {
  page: number
  pages: number
  total: number
  limit: number
}

/** Backend-ийн бүтэн алдаа — `code`, `details` хамт */
export class ApiError extends Error {
  code: string | null
  details: Record<string, any> | null
  status: number

  constructor(
    message: string,
    { code = null, details = null, status = 0 }: {
      code?: string | null
      details?: Record<string, any> | null
      status?: number
    } = {}
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.status = status
  }
}

/** Алдааны кодууд — backend-ийн `ERROR_CODE`-той нийцнэ */
export const ERROR_CODE = {
  DUPLICATE_TRACKING_NUMBER: 'DUPLICATE_TRACKING_NUMBER',
  OVERRIDE_LIMIT_EXCEEDED: 'OVERRIDE_LIMIT_EXCEEDED',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  DELETE_NOT_ALLOWED: 'DELETE_NOT_ALLOWED',
} as const

/** Backend-ийн API угтвар — `plugins/axios.ts`-ийн baseURL нь домэйн хүртэл л */
const API = '/api/v1'

export function usePackages() {
  const { $axios } = useNuxtApp()

  /** Axios-ийн алдааг `ApiError` болгож `code`/`details`-ыг хамгаална */
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

  /**
   * Нэг объект буцаадаг endpoint-ууд: `{ success, data }` → `data`.
   *
   * ЖАГСААЛТЫН endpoint-д ХЭРЭГЛЭХГҮЙ — тэр нь `{ success, data, pagination }`
   * хэлбэртэй бөгөөд `data` нь массив. Энэ функцээр дамжуулбал `pagination`
   * хаягдана.
   */
  async function call<T>(fn: () => Promise<any>): Promise<T> {
    try {
      const response = await fn()
      return response.data.data as T
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  /** §9.3 — хайлт БҮРЭН server талд. Хоосон шүүлтүүрийг явуулахгүй. */
  async function list(filters: Record<string, any>) {
    const params: Record<string, any> = {}
    for (const [key, value] of Object.entries(filters)) {
      if (value === '' || value == null) continue
      if (Array.isArray(value) && value.length === 0) continue
      params[key] = value
    }

    try {
      const response = await $axios.get(`${API}/packages`, { params })
      return {
        data: (response.data.data ?? []) as CargoPackage[],
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

  /**
   * `allowedTransitions` нь ЗӨВХӨН ажилтан ГАРААР хийж болох шилжилтүүд —
   * backend-ийн `manualTransitions()`. Системийн шилжилт (`paid`) ба хүчингүй
   * болгох нь орохгүй: тэднийг товч болгон харуулбал дарах бүрт 409 гарна.
   */
  const detail = (id: string) =>
    call<{
      package: CargoPackage
      auditLogs: any[]
      // §2.2 — ачаанд орсон төлбөрүүд (хүчингүй болсныг ч оруулна)
      payments: any[]
      // §5.1 — ачаа орсон хүргэлтүүд (цуцлагдсаныг ч оруулна)
      deliveries: any[]
      allowedTransitions: PackageStatusValue[]
    }>(() => $axios.get(`${API}/packages/${id}`))

  /** §1.3 — бүтэн (яг тохирсон) дугаараар ганц ачаа хайх */
  const getByTracking = (trackingNumber: string) =>
    call<CargoPackage>(() =>
      $axios.get(`${API}/packages/tracking/${encodeURIComponent(trackingNumber)}`)
    )

  /**
   * BR-46 — дугаар нь урьдчилсан бүртгэлтэй (харилцагчийн мэдүүлсэн эсвэл
   * Эрээнд тэмдэглэсэн) байвал backend ШИНЭ бичлэг үүсгэхгүй, тэр бичлэгийг
   * гүйцээгээд `adopted: true` буцаана. UI үүнийг ажилтанд хэлэх ёстой.
   */
  const create = (payload: Record<string, any>) =>
    call<{
      package: CargoPackage
      warnings: string[]
      adopted?: boolean
      adoptedFrom?: PackageStatusValue
    }>(() => $axios.post(`${API}/packages`, payload))

  /**
   * Олноор бүртгэх — админ вэбийн олон мөрт форм (Excel/CSV биш). Мөр бүр
   * `create`-тэй ижил шалгагдана, тус бүрдээ бүртгэгдэнэ — 1 мөрийн алдаа
   * бусдыг унагахгүй (§1.9-ийн хэв маяг, `changeStatusBulk`-тай адил).
   */
  const createBulk = (packages: Array<Record<string, any>>) =>
    call<{
      succeeded: CargoPackage[]
      failed: Array<{
        index: number
        trackingNumber: string
        message: string
        code: string | null
        details: Record<string, any> | null
      }>
      total: number
    }>(() => $axios.post(`${API}/packages/bulk`, { packages }))

  const update = (id: string, payload: Record<string, any>) =>
    call<CargoPackage>(() => $axios.put(`${API}/packages/${id}`, payload))

  const changeStatus = (id: string, status: string, reason?: string) =>
    call<CargoPackage>(() =>
      $axios.put(`${API}/packages/${id}/status`, { status, ...(reason ? { reason } : {}) })
    )

  const changeStatusBulk = (packageIds: string[], status: string, reason?: string) =>
    call<{
      succeeded: Array<{ id: string; trackingNumber: string }>
      failed: Array<{ id: string; message: string }>
      total: number
    }>(() =>
      $axios.put(`${API}/packages/bulk-status`, {
        packageIds,
        status,
        ...(reason ? { reason } : {}),
      })
    )

  const overridePrice = (id: string, price: number, reason: string) =>
    call<CargoPackage>(() => $axios.put(`${API}/packages/${id}/price`, { price, reason }))

  /**
   * BR-45 — "Эрээнд байгаа" ачаа Монголд ирэхэд жин/үнэ/байршил нэмж
   * "Бүртгэгдсэн" болгоно. Шинэ бичлэг ҮҮСГЭХГҮЙ.
   */
  const completeArrival = (id: string, payload: Record<string, any>) =>
    call<CargoPackage>(() => $axios.put(`${API}/packages/${id}/arrive`, payload))

  const cancel = (id: string, reason: string) =>
    call<CargoPackage>(() => $axios.put(`${API}/packages/${id}/cancel`, { reason }))

  // Axios-ийн `delete` нь body-г `{ data }`-аар авна
  const remove = (id: string, reason: string) =>
    call<{ deleted: boolean }>(() => $axios.delete(`${API}/packages/${id}`, { data: { reason } }))

  const moveLocation = (id: string, locationCode: string, reason?: string) =>
    call<{ package: CargoPackage; warnings: string[] }>(() =>
      $axios.put(`${API}/packages/${id}/location`, { locationCode, ...(reason ? { reason } : {}) })
    )

  const byPhone = (phone: string) =>
    call<{
      customer: { id: string; phone: string; name: string | null }
      packages: CargoPackage[]
      totals: { finalPrice: number; paidAmount: number; balance: number }
    }>(() => $axios.get(`${API}/packages/by-phone/${encodeURIComponent(phone)}`))

  /** §1.2 — бүртгэхийн ӨМНӨ үнийг харах. Юу ч хадгалахгүй. */
  const quote = (payload: Record<string, any>) =>
    call<{
      byWeight: number
      byVolume: number
      final: number
      source: 'weight' | 'volume' | 'minimum'
      volumeM3: number | null
      appliedBracket: { maxGrams: number; price: number } | null
      chargeableKg: number
    }>(() => $axios.post(`${API}/tariffs/quote`, payload))

  /** Ачааны төрлийн endpoint мөн хуудаслагдсан хэлбэртэй */
  async function cargoTypes() {
    try {
      const response = await $axios.get(`${API}/tariffs/cargo-types`, {
        params: { isActive: true },
      })
      return {
        data: (response.data.data ?? []) as Array<{
          id: string
          code: string
          name: string
          isActive: boolean
        }>,
      }
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  /** BR-23 — хоосон нүд санал болгоно. Санал ЗААВАЛ БИШ. */
  const suggestLocation = () =>
    call<{ code: string; currentCount: number; capacityCount: number | null } | null>(() =>
      $axios.get(`${API}/warehouse-locations/suggest`)
    )

  return {
    list,
    detail,
    getByTracking,
    create,
    createBulk,
    update,
    changeStatus,
    changeStatusBulk,
    overridePrice,
    completeArrival,
    cancel,
    remove,
    moveLocation,
    byPhone,
    quote,
    cargoTypes,
    suggestLocation,
  }
}
