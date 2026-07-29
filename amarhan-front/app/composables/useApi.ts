import { ref } from 'vue'

interface ApiState<T> {
  data: Ref<T | null>
  error: Ref<string | null>
  loading: Ref<boolean>
}

export function useApi<T = any>() {
  const data = ref<T | null>(null) as Ref<T | null>
  const error = ref<string | null>(null)
  const loading = ref(false)

  const { $axios } = useNuxtApp()

  async function get(url: string, params?: Record<string, any>): Promise<T | null> {
    loading.value = true
    error.value = null
    try {
      const response = await $axios.get(url, { params })
      data.value = response.data.data ?? response.data
      return data.value
    } catch (e: any) {
      error.value = e.response?.data?.message || e.message || 'Request failed'
      return null
    } finally {
      loading.value = false
    }
  }

  async function post(url: string, body?: any): Promise<T | null> {
    loading.value = true
    error.value = null
    try {
      const response = await $axios.post(url, body)
      data.value = response.data.data ?? response.data
      return data.value
    } catch (e: any) {
      error.value = e.response?.data?.message || e.message || 'Request failed'
      return null
    } finally {
      loading.value = false
    }
  }

  async function put(url: string, body?: any): Promise<T | null> {
    loading.value = true
    error.value = null
    try {
      const response = await $axios.put(url, body)
      data.value = response.data.data ?? response.data
      return data.value
    } catch (e: any) {
      error.value = e.response?.data?.message || e.message || 'Request failed'
      return null
    } finally {
      loading.value = false
    }
  }

  async function del(url: string): Promise<T | null> {
    loading.value = true
    error.value = null
    try {
      const response = await $axios.delete(url)
      data.value = response.data.data ?? response.data
      return data.value
    } catch (e: any) {
      error.value = e.response?.data?.message || e.message || 'Request failed'
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    data,
    error,
    loading,
    get,
    post,
    put,
    del,
  } as ApiState<T> & {
    get: typeof get
    post: typeof post
    put: typeof put
    del: typeof del
  }
}
