import { ApiError } from './usePackages'

export interface CustomerSummary {
  id: string
  phone: string
  name: string | null
}

const API = '/api/v1/customers'

/** Харилцагчийн API — одоохондоор зөвхөн нэрээр/утсаар хайхад хэрэглэгдэнэ */
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

  /** Утас (угтвараар), нэр, имэйлээр хайна — backend `customerRepository.search` */
  async function search(query: string, limit = 5) {
    try {
      const response = await $axios.get(API, { params: { search: query, limit } })
      return (response.data.data ?? []) as CustomerSummary[]
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  return { search }
}
