/**
 * Тариф ба ачааны төрлийн API — introduction.md §1.2, roadmap 1.11
 *
 * `usePackages`-ийн ижил хэв: `ApiError`-оор `code`/`details`-ыг хамгаална.
 * Тариф ЗАСАХ endpoint-ууд (`createCargoType`, `changeTariff`) зөвхөн Админд
 * нээлттэй (§9.1, backend `ROLE_GROUP.ADMIN`) — энэ файл өөрөө эрх шалгахгүй,
 * зөвхөн дуудна.
 */

import { ApiError, type Pagination } from './usePackages'

export interface CargoType {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
}

export interface WeightBracket {
  maxGrams: number
  price: number
}

export interface TariffVersion {
  id: string
  cargoTypeId: string | CargoType
  weightBrackets: WeightBracket[]
  pricePerKgAbove: number
  pricePerM3: number
  minimumCharge: number
  effectiveFrom: string
  effectiveTo: string | null
  createdBy: { firstname?: string; lastname?: string } | string | null
  note: string | null
  createdAt: string
}

const API = '/api/v1/tariffs'

export function useTariffs() {
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

  async function listCargoTypes(filters: Record<string, any> = {}) {
    const params: Record<string, any> = {}
    for (const [key, value] of Object.entries(filters)) {
      if (value === '' || value == null) continue
      params[key] = value
    }

    try {
      const response = await $axios.get(`${API}/cargo-types`, { params })
      return {
        data: (response.data.data ?? []) as CargoType[],
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

  const getCargoType = (id: string) =>
    call<CargoType>(() => $axios.get(`${API}/cargo-types/${id}`))

  /** Шинэ ачааны төрөл + анхны тариф НЭГ дор үүсгэнэ (Админ) */
  const createCargoType = (payload: {
    code: string
    name: string
    description?: string | null
    isActive?: boolean
    weightBrackets?: WeightBracket[]
    pricePerKgAbove: number
    pricePerM3: number
    minimumCharge?: number
  }) =>
    call<{ cargoType: CargoType; tariff: TariffVersion }>(() =>
      $axios.post(`${API}/cargo-types`, payload)
    )

  /** Ачааны төрлийн нэр/тайлбар/идэвх засах (Админ) — тариф ОРОЛЦОХГҮЙ */
  const updateCargoType = (
    id: string,
    payload: { name?: string; description?: string | null; isActive?: boolean }
  ) => call<CargoType>(() => $axios.put(`${API}/cargo-types/${id}`, payload))

  /** Бүх ачааны төрлийн ОДООГИЙН идэвхтэй тариф, `cargoTypeId` populated */
  const listActiveTariffs = () => call<TariffVersion[]>(() => $axios.get(`${API}/active`))

  const listTariffHistory = (cargoTypeId: string) =>
    call<TariffVersion[]>(() => $axios.get(`${API}/cargo-types/${cargoTypeId}/tariff`))

  /**
   * BR-02 — тариф өөрчлөх. Хуучин хувилбарыг дарж бичихгүй, шинэ хувилбар
   * үүсгэнэ (Админ). Өмнөх ачааны үнэ хөдлөхгүй.
   */
  const changeTariff = (
    cargoTypeId: string,
    payload: {
      weightBrackets: WeightBracket[]
      pricePerKgAbove: number
      pricePerM3: number
      minimumCharge: number
      note?: string | null
    }
  ) => call<TariffVersion>(() => $axios.post(`${API}/cargo-types/${cargoTypeId}/tariff`, payload))

  return {
    listCargoTypes,
    getCargoType,
    createCargoType,
    updateCargoType,
    listActiveTariffs,
    listTariffHistory,
    changeTariff,
  }
}
