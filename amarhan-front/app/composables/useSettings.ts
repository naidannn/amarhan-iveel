/**
 * Системийн тохиргоо/агуулга — `GET /settings` нь STAFF-д нээлттэй,
 * `PUT /settings/:key` зөвхөн Админ (backend `setting.route.js`).
 */

const API = '/api/v1/settings'

export function useSettings() {
  const { $axios } = useNuxtApp()

  const list = async (): Promise<Record<string, any>> => {
    const { data } = await $axios.get(API)
    return data.data ?? {}
  }

  const update = async (key: string, value: unknown) => {
    const { data } = await $axios.put(`${API}/${key}`, { value })
    return data.data
  }

  return { list, update }
}
