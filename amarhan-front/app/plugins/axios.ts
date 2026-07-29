import axios from 'axios'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const axiosInstance = axios.create({
    baseURL: config.public.apiBase || 'http://localhost:4000',
  })

  // Request interceptor — attach token
  axiosInstance.interceptors.request.use((requestConfig: any) => {
    try {
      const authStore = useAuthStore()
      if (authStore.token) {
        requestConfig.headers.Authorization = `Bearer ${authStore.token}`
      }
    } catch {
      // Pinia not initialized yet, skip
    }
    return requestConfig
  })

  // Response interceptor — handle 401
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        try {
          const authStore = useAuthStore()
          authStore.clearAuth()
          navigateTo('/admin/login')
        } catch {
          // Store not available
        }
      }
      return Promise.reject(error)
    }
  )

  return {
    provide: {
      axios: axiosInstance,
    },
  }
})
