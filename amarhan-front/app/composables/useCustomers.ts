import { ApiError } from './usePackages'

export interface CustomerSummary {
  id: string
  phone: string
  name: string | null
}

export interface AdminCustomer extends CustomerSummary {
  phoneVerified: boolean
  email: string | null
  hasAccount: boolean
  loyaltyTier: 'bronze' | 'silver' | 'gold'
  loyaltyPoints: number
  lifetimeSpent: number
  status: 'active' | 'blocked'
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminCustomerPayload {
  phone: string
  name: string | null
  email: string | null
  note: string | null
  status?: 'active' | 'blocked'
}

export interface CustomerPagination {
  page: number
  pages: number
  total: number
  limit: number
}

export interface CustomerFilters {
  search?: string
  loyaltyTier?: string | null
  status?: string | null
  hasAccount?: boolean | 'true' | 'false' | null
  page: number
  limit: number
}

const API = '/api/v1/customers'

/** Харилцагчийн API — нэр, утас, бүртгэл, төлөвийн удирдлага. */
export function useCustomers() {
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

  /** §9.3 — шүүлт, хуудаслалт бүгд сервер талд хийгдэнэ. */
  async function list(filters: CustomerFilters) {
    const params: Record<string, string | number | boolean> = {}
    for (const [key, value] of Object.entries(filters)) {
      if (value === '' || value == null) continue
      params[key] = value
    }

    try {
      const response = await $axios.get(API, { params })
      return {
        data: (response.data.data ?? []) as AdminCustomer[],
        pagination: (response.data.pagination ?? {
          page: 1,
          pages: 1,
          total: 0,
          limit: filters.limit,
        }) as CustomerPagination,
      }
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  /** Утас (угтвараар), нэр, имэйлээр хайна — backend `customerRepository.search` */
  async function search(query: string, limit = 5) {
    const result = await list({ search: query, page: 1, limit })
    return result.data as CustomerSummary[]
  }

  const get = (id: string) => call<AdminCustomer>(() => $axios.get(`${API}/${id}`))
  const create = (payload: AdminCustomerPayload) =>
    call<AdminCustomer>(() => $axios.post(API, payload))
  const update = (id: string, payload: AdminCustomerPayload) =>
    call<AdminCustomer>(() => $axios.put(`${API}/${id}`, payload))

  return { search, list, get, create, update }
}
