/**
 * Агуулахын байршлын API — §8
 *
 * Ачаа бүртгэх/ирц гүйцээх маягтад байршлын кодыг чөлөөтэй БИЧИХГҮЙ, зөвхөн
 * бодит оршин байгаа байршлаас СОНГОХ болгосон (2026-07-31 шийдвэр) — эндхийн
 * `list()`-ийг тэр select-ийн сонголтуудыг татахад ашиглана.
 */

export interface WarehouseLocation {
  id: string
  code: string
  branchId: string
  currentCount: number
  capacityCount: number | null
  isActive: boolean
  isFull: boolean
}

const API = '/api/v1'

export function useWarehouseLocations() {
  const { $axios } = useNuxtApp()

  async function list(params: Record<string, any> = {}) {
    const query: Record<string, any> = { isActive: true, limit: 100, ...params }
    for (const [key, value] of Object.entries(query)) {
      if (value === '' || value == null) delete query[key]
    }

    const response = await $axios.get(`${API}/warehouse-locations`, { params: query })
    return (response.data.data ?? []) as WarehouseLocation[]
  }

  return { list }
}
