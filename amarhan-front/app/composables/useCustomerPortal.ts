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
  /** BR-46 — харилцагчийн өөрийн бичсэн тайлбар (ажилтны дотоод `note` БИШ) */
  customerNote: string | null
  registrationSource: 'staff' | 'customer'
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

/** Roadmap 5.8 — харилцагч өөрөө хүргэлт захиалах */
export interface DeliverableForDelivery {
  packages: CustomerPackage[]
  /** Хүргэлтийн тогтмол суурь хураамж (₮) — `DELIVERY_FEE_AMOUNT`, backend бодно */
  feeAmount: number
  /** "Данс" сонголтод харуулах дансны мэдээлэл (`payment.bank_account`) */
  bankAccount: {
    bankName: string
    accountNumber: string
    accountHolder: string
    note: string
  } | null
}

/** §7 (Phase 6) — хувийн (BR-35) болон идэвхтэй нийтийн (BR-36) мэдэгдэл нэг жагсаалтад */
export interface CustomerNotification {
  id: string
  title: string
  body: string
  entity: string | null
  entityId: string | null
  entityLabel: string | null
  audience: 'customer' | 'all'
  read: boolean
  createdAt: string
}

export interface CreatedDelivery {
  id: string
  deliveryNumber: string
  status: string
  address: string
  phone: string
  fee: number
  createdAt: string
  payment: {
    id: string
    amount: number
    method: string
    status: string
  }
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

  /**
   * BR-46 — ирэх ачаагаа урьдчилан бүртгүүлэх.
   *
   * Зөвхөн дугаар, тоо ширхэг, тайлбар илгээнэ: жин/үнэ/байршлыг компани
   * тодорхойлдог (§1.1), утас нь токеноос гардаг (дүрэм 14) тул энд
   * илгээх талбар БАЙХГҮЙ — backend илүү талбарыг 400-аар унагана.
   */
  async function registerPackage(payload: {
    trackingNumber: string
    quantity?: number
    note?: string
  }): Promise<CustomerPackage> {
    const res = await $axios.post('/api/v1/customer/packages', clean(payload))
    return res.data.data
  }

  /** Буруу бичсэн урьдчилсан бүртгэлээ буцаана (зөвхөн «Хүлээгдэж буй» үед) */
  async function cancelPackage(id: string): Promise<CustomerPackage> {
    const res = await $axios.post(`/api/v1/customer/packages/${id}/cancel`)
    return res.data.data
  }

  function payments(params: { page?: number; limit?: number } = {}) {
    return list<any>('payments', params)
  }

  function deliveries(params: { page?: number; limit?: number; status?: string } = {}) {
    return list<any>('deliveries', params)
  }

  /** Roadmap 5.8 — захиалж болох ачаа + тооцоолсон хураамж + дансны мэдээлэл */
  async function deliverableForDelivery(): Promise<DeliverableForDelivery> {
    const res = await $axios.get('/api/v1/customer/deliveries/deliverable')
    return res.data.data
  }

  /**
   * Хүргэлт захиална. `fee`/`method`/`customerId` илгээхгүй (дүрэм 14) —
   * backend `DELIVERY_FEE_AMOUNT`, "Данс"-аар дангаараа шийднэ (QPay ⛔).
   */
  async function createDelivery(payload: {
    packageIds: string[]
    address: string
    phone?: string
    note?: string
  }): Promise<CreatedDelivery> {
    const res = await $axios.post('/api/v1/customer/deliveries', clean(payload))
    return res.data.data
  }

  /** §7 — хувийн + идэвхтэй нийтийн мэдэгдэл, нэг хуудаслалтаар */
  function notifications(params: { page?: number; limit?: number } = {}) {
    return list<CustomerNotification>('notifications', params)
  }

  async function unreadNotificationCount(): Promise<number> {
    const res = await $axios.get('/api/v1/customer/notifications/unread-count')
    return res.data.data.count
  }

  async function markNotificationRead(id: string): Promise<void> {
    await $axios.put(`/api/v1/customer/notifications/${id}/read`)
  }

  async function markAllNotificationsRead(): Promise<void> {
    await $axios.put('/api/v1/customer/notifications/read-all')
  }

  return {
    summary,
    packages,
    packageDetail,
    registerPackage,
    cancelPackage,
    payments,
    deliveries,
    deliverableForDelivery,
    createDelivery,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  }
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

  /** §7, roadmap 6.3 — нэвтрээгүй зочны мэдэгдлийн хуудас (идэвхтэй нийтийн зарлал) */
  async function notifications(params: { page?: number; limit?: number } = {}) {
    const res = await $fetch<{ data: PublicNotification[]; pagination: any }>(
      `${base}/api/v1/public/notifications`,
      { params }
    )
    return res
  }

  return { content, pricing, track, trackByPhone, notifications }
}

/** §7 — зочинд харагдах цагаан жагсаалттай мэдэгдэл (уншсан төлөвгүй, зөвхөн текст) */
export interface PublicNotification {
  id: string
  title: string
  body: string
  createdAt: string
}

/** Хоосон/тодорхойгүй параметрийг query-д оруулахгүй */
function clean(params: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )
}
