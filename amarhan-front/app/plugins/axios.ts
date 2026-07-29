import axios from 'axios'

/**
 * `name` ба object хэлбэр ЗААВАЛ: Nuxt plugin-уудыг файлын нэрээр эрэмбэлдэг тул
 * `auth.client.ts` нь `axios.ts`-ээс ӨМНӨ ажиллаж, `$axios` бэлэн болоогүй
 * байдаг. Ингэснээр эхлэх үеийн `checkAuth()` унаж, хэрэглэгчийг чимээгүй
 * гаргадаг байсан. Нэр өгснөөр auth plugin `dependsOn: ['axios']`-оор хүлээнэ.
 */
export default defineNuxtPlugin({
  name: 'axios',

  setup() {
    const config = useRuntimeConfig()

    const axiosInstance = axios.create({
      baseURL: config.public.apiBase || 'http://localhost:4000',
    })

    /**
     * Токеныг хүсэлт бүрт хавсаргана.
     *
     * localStorage-ыг НӨӨЦ ЗАМ болгож байгаа шалтгаан: апп эхлэх үед
     * (`plugins/auth.client.ts` → `checkAuth()`) Pinia-гийн активчлал хараахан
     * бэлэн болоогүй байж `useAuthStore()` унадаг. Тэр үед токен хавсаргагдахгүй
     * тул `/auth/me` нь 401 буцааж, 401 interceptor хэрэглэгчийг гаргадаг —
     * хуудсыг сэргээх бүрт нэвтрэлт унана.
     */
    axiosInstance.interceptors.request.use((requestConfig: any) => {
      let token: string | null = null

      try {
        token = useAuthStore().token
      } catch {
        // Pinia хараахан активгүй — доор localStorage-оос уншина
      }

      if (!token && import.meta.client) {
        token = localStorage.getItem('auth_token')
      }

      if (token) {
        requestConfig.headers.Authorization = `Bearer ${token}`
      }

      return requestConfig
    })

    // Response interceptor — handle 401
    axiosInstance.interceptors.response.use(
      response => response,
      error => {
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
  },
})
