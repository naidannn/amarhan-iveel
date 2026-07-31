import type { PackageStatus, DeliveryStatus } from './useStatus'
// `Pagination` нь ажилтны талд аль хэдийн тодорхойлогдсон, бүтэц нь ижил —
// дахин экспортлобол Nuxt-ийн авто-импорт хоёр эх сурвалжийн аль нэгийг
// чимээгүй сонгож, засварлахад аль нь хүчинтэйг ойлгоход төвөгтэй болно.
import type { Pagination } from './usePackages'

/**
 * Харилцагчийн вэбийн серверийн өгөгдөл — introduction.md §3
 *
 * Архитектур §7-ийн дагуу сервер өгөгдөл нь Pinia store-д БИШ, composable-д
 * байрлана. `stores/customer.ts` нь зөвхөн НЭВТРЭЛТИЙН глобал төлөвийг барина.
 *
 * Шүүлт, хуудаслалт ҮРГЭЛЖ query параметрээр backend руу явна (§9.3) —
 * бүх ачааг татаж client талд шүүхийг хориглоно.
 */

export interface CustomerPackage {
  id: string
  trackingNumber: string
  status: PackageStatus
  quantity: number
  weightKg: number | null
  volumeM3: number | null
  cargoType: string | null
  finalPrice: number
  paidAmount: number
  balance: number
  paymentStatus: 'unpaid' | 'partial' | 'paid'
  arrivedAt: string | null
  createdAt: string
}

export interface CustomerPackageDetail extends CustomerPackage {
  statusHistory: { from: string | null; to: string; at: string }[]
  payments: { id: string; method: string; amount: number; createdAt: string }[]
  deliveries: {
    _id: string
    deliveryNumber: string
    status: DeliveryStatus
    address: string
    scheduledDate: string | null
    dispatchedAt: string | null
    deliveredAt: string | null
  }[]
}

export interface CustomerSummary {
  packages: {
    total: number
    awaitingPayment: number
    readyForPickup: number
    inDelivery: number
  }
  balance: number
}

export function useCustomerPortal() {
  const { $axios } = useNuxtApp()

  async function list<T>(
    path: string,
    params: Record<string, any> = {}
  ): Promise<{ data: T[]; pagination: Pagination }> {
    const res = await $axios.get(`/api/v1/customer/${path}`, { params: clean(params) })
    return { data: res.data.data, pagination: res.data.pagination }
  }

  async function summary(): Promise<CustomerSummary> {
    const res = await $axios.get('/api/v1/customer/summary')
    return res.data.data
  }

  function packages(params: { page?: number; limit?: number; status?: string } = {}) {
    return list<CustomerPackage>('packages', params)
  }

  async function packageDetail(id: string): Promise<CustomerPackageDetail> {
    const res = await $axios.get(`/api/v1/customer/packages/${id}`)
    return res.data.data
  }

  function payments(params: { page?: number; limit?: number } = {}) {
    return list<any>('payments', params)
  }

  function deliveries(params: { page?: number; limit?: number; status?: string } = {}) {
    return list<any>('deliveries', params)
  }

  return { summary, packages, packageDetail, payments, deliveries }
}

/**
 * Нээлттэй өгөгдөл — нэвтрэхгүйгээр (§3).
 * SSR-д ч ажиллах ёстой тул `useFetch`-ийн оронд шууд `$fetch` ашиглана.
 */
export function usePublicContent() {
  const config = useRuntimeConfig()
  const base = config.public.apiBase || 'http://localhost:4000'

  async function content() {
    return $fetch<{ data: any }>(`${base}/api/v1/public/content`).then(r => r.data)
  }

  /** Нүүр хуудасны "Энгийн, ил тод тариф" хэсэг — компанийн нийтэлсэн үнийн жагсаалт */
  async function pricing() {
    return $fetch<{ data: any }>(`${base}/api/v1/public/pricing`).then(r => r.data)
  }

  async function track(trackingNumber: string) {
    const res = await $fetch<{ data: any }>(
      `${base}/api/v1/public/track/${encodeURIComponent(trackingNumber)}`
    )
    return res.data
  }

  /**
   * Утасны дугаараар хайх (нүүр хуудасны хайлтын карт).
   * Backend `packageRepository.search`-тай ижил `{ data, pagination }` хэлбэртэй буцаана.
   */
  async function trackByPhone(phone: string, params: { page?: number; limit?: number } = {}) {
    const res = await $fetch<{ data: any[]; pagination: any }>(
      `${base}/api/v1/public/track-by-phone/${encodeURIComponent(phone)}`,
      { params }
    )
    return res
  }

  return { content, pricing, track, trackByPhone }
}

/** Хоосон/тодорхойгүй параметрийг query-д оруулахгүй */
function clean(params: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )
}
