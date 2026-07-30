import axios from 'axios'
import { CUSTOMER_TOKEN_KEY } from '~/stores/customer'

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
     * Токеныг ЗАМААР сонгоно — Phase 5.
     *
     * Систем хоёр өөр танилттай: ажилтан (`aud: 'staff'`) ба харилцагч
     * (`aud: 'customer'`). Хоёр токен нэг браузерт зэрэг байж болно
     * (жишээ: ажилтан ажлын компьютероосоо өөрийн ачаагаа хардаг).
     *
     * ЗАМААР сонгож байгаа шалтгаан: одоогийн хуудсаар (`route.path`)
     * шийдвэл нээлттэй хуудаснаас (`/track/...`) хийсэн хүсэлт аль
     * токеныг авахаа мэдэхгүй, мөн navigation дундуур route өөрчлөгдөх
     * үед хүсэлт буруу толгойтой явж болно. URL нь эргэлзээгүй:
     * `/api/v1/customer/*` бол харилцагчийнх, бусад нь ажилтных.
     */
    axiosInstance.interceptors.request.use((requestConfig: any) => {
      const url = requestConfig.url ?? ''
      const isCustomerApi = url.startsWith('/api/v1/customer/')

      let token: string | null = null

      try {
        token = isCustomerApi ? useCustomerStore().token : useAuthStore().token
      } catch {
        // Pinia хараахан активгүй — доор localStorage-оос уншина
      }

      // localStorage нь НӨӨЦ ЗАМ: апп эхлэх үед (`plugins/auth.client.ts` →
      // `checkAuth()`) Pinia бэлэн болоогүй байж `useAuthStore()` унадаг.
      // Тэр үед токен хавсаргагдахгүй бол `/auth/me` 401 буцааж,
      // хэрэглэгч хуудас сэргээх бүрт гарна.
      if (!token && import.meta.client) {
        token = localStorage.getItem(isCustomerApi ? CUSTOMER_TOKEN_KEY : 'auth_token')
      }

      if (token) {
        requestConfig.headers.Authorization = `Bearer ${token}`
      }

      return requestConfig
    })

    /**
     * 401 — токен хүчингүй. АЛЬ танилт унасныг хүсэлтийн замаар ялгана:
     * харилцагчийн 401-д ажилтныг гаргах (эсрэгээр нь ч) нь буруу.
     *
     * Нэвтрэх/бүртгүүлэх хүсэлтийн 401-д АВТОМАТААР ГАРГАХГҮЙ — тэр нь
     * "нууц үг буруу" гэсэн үг бөгөөд формын алдаа болж харагдах ёстой,
     * хуудас солих шалтгаан биш.
     */
    axiosInstance.interceptors.response.use(
      response => response,
      error => {
        const url: string = error.config?.url ?? ''
        const isAuthAttempt = /\/auth\/(login|register|google\/complete)$/.test(url)

        if (error.response?.status === 401 && !isAuthAttempt) {
          const isCustomerApi = url.startsWith('/api/v1/customer/')
          try {
            if (isCustomerApi) {
              useCustomerStore().clear()
              navigateTo('/login')
            } else {
              useAuthStore().clearAuth()
              navigateTo('/admin/login')
            }
          } catch {
            // Store бэлэн биш — навигацгүйгээр алдааг дамжуулна
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
