import { CUSTOMER_TOKEN_KEY } from '~/stores/customer'

/**
 * Апп эхлэхэд нэвтрэлтийн төлөвийг localStorage-оос сэргээнэ.
 *
 * `dependsOn` нь ХОЁУЛАНГ хүлээх ёстой:
 *   pinia — `useAuthStore()` дуудахад бэлэн байх
 *   axios — `checkAuth()` доторх `$axios` бэлэн байх
 *
 * Nuxt plugin-уудыг файлын нэрээр эрэмбэлдэг тул `auth.client.ts` нь
 * `axios.ts`-ээс ӨМНӨ ажиллана. `axios`-ыг хүлээхгүй бол `$axios` undefined
 * болж `checkAuth()` унаж, хуудсыг сэргээх бүрт хэрэглэгч гардаг байсан.
 */
export default defineNuxtPlugin({
  name: 'auth-init',
  dependsOn: ['pinia', 'axios'],

  async setup() {
    const authStore = useAuthStore()
    const customerStore = useCustomerStore()

    /**
     * Хоёр танилтыг ЗЭРЭГ сэргээнэ — нэг браузерт ажилтны ба харилцагчийн
     * нэвтрэлт зэрэг байж болно (Phase 5).
     *
     * Токен БАЙВАЛ л сервер рүү явна: нээлттэй хуудас (нүүр, `/track/...`)
     * зочны хувьд ямар ч нэмэлт хүсэлтгүй ачаалагдах ёстой.
     */
    await Promise.all([
      localStorage.getItem('auth_token') ? authStore.checkAuth() : Promise.resolve(false),
      localStorage.getItem(CUSTOMER_TOKEN_KEY)
        ? customerStore.checkAuth()
        : Promise.resolve(false),
    ])

    customerStore.ready = true
  },
})
