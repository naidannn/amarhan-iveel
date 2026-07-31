/**
 * Агуулахын байршлын API — §8
 *
 * Ачаа бүртгэх/ирц гүйцээх маягтад байршлын кодыг чөлөөтэй БИЧИХГҮЙ, зөвхөн
 * бодит оршин байгаа байршлаас СОНГОХ болгосон (2026-07-31 шийдвэр) — эндхийн
 * `list()`-ийг тэр select-ийн сонголтуудыг татахад ашиглана. Админы агуулах
 * дэлгэц нь ижил API-г хуудаслалт болон тохиргооны үйлдэлтэй ашиглана.
 */

import { ApiError } from './usePackages'

export interface WarehouseLocation {
  id: string
  code: string
  branchId: string
  branchCode: string
  room: string
  shelf: string
  row: number
  cell: number
  currentCount: number
  capacityCount: number | null
  currentM3: number
  capacityM3: number | null
  isActive: boolean
  isFull: boolean
}

const API = '/api/v1'

export interface WarehousePagination {
  page: number
  pages: number
  total: number
  limit: number
}

export interface WarehouseFilters {
  code?: string
  room?: string
  shelf?: string
  isActive?: boolean | null
  onlyFree?: boolean
  page?: number
  limit?: number
}

export interface ShelfPayload {
  room: number
  shelf: string
  rows: number
  cells: number
  capacityCount?: number | null
  capacityM3?: number | null
}

export interface LocationUpdatePayload {
  capacityCount?: number | null
  capacityM3?: number | null
  isActive?: boolean
}

export function useWarehouseLocations() {
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

  /**
   * `list()` нь хуудаслалтын мэдээллийг хамт буцаана. Ачаа бүртгэх select
   * хуучин адил `result.data`-г авч ашиглана.
   */
  async function list(params: WarehouseFilters = {}) {
    const query: Record<string, any> = { isActive: true, limit: 100, ...params }
    for (const [key, value] of Object.entries(query)) {
      if (value === '' || value == null) delete query[key]
    }

    try {
      const response = await $axios.get(`${API}/warehouse-locations`, { params: query })
      return {
        data: (response.data.data ?? []) as WarehouseLocation[],
        pagination: (response.data.pagination ?? {
          page: 1,
          pages: 1,
          total: 0,
          limit: query.limit ?? 100,
        }) as WarehousePagination,
      }
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  async function createShelf(payload: ShelfPayload) {
    try {
      const response = await $axios.post(`${API}/warehouse-locations/shelf`, payload)
      return response.data.data as {
        created: number
        skipped: number
        locations: WarehouseLocation[]
      }
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  async function update(id: string, payload: LocationUpdatePayload) {
    try {
      const response = await $axios.put(`${API}/warehouse-locations/${id}`, payload)
      return response.data.data as WarehouseLocation
    } catch (e: any) {
      throw toApiError(e)
    }
  }

  return { list, createShelf, update }
}
