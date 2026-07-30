import { defineStore } from 'pinia'

/**
 * Харилцагчийн нэвтрэлт — introduction.md §3 (Phase 5)
 *
 * АЖИЛТНЫ `auth` store-ООС ТУСДАА байх ёстой. Нэг компьютер дээр ажилтан
 * админ систем рүү, харилцагч вэб рүү зэрэг нэвтэрсэн байж болно —
 * нэг store, нэг `localStorage` түлхүүр хуваалцвал хоёр дахь нэвтрэлт
 * эхнийхийг чимээгүй унтраана.
 *
 * Токен нь тусдаа түлхүүрт (`customer_token`) хадгалагдана; `plugins/axios.ts`
 * хүсэлтийн ЗАМААР аль токеныг хавсаргахаа сонгоно.
 */

export interface CustomerAddress {
  label?: string
  address: string
  note?: string
}

export interface Customer {
  id: string
  phone: string
  phoneVerified: boolean
  name: string | null
  email: string | null
  hasGoogle: boolean
  hasPassword: boolean
  addresses: CustomerAddress[]
  loyaltyTier: 'bronze' | 'silver' | 'gold'
  loyaltyPoints: number
  status: 'active' | 'blocked'
  createdAt: string
}

export const CUSTOMER_TOKEN_KEY = 'customer_token'
const CUSTOMER_USER_KEY = 'customer_user'

export const useCustomerStore = defineStore('customer', {
  state: () => ({
    customer: null as Customer | null,
    token: null as string | null,
    isAuthenticated: false,
    loading: false,
    /** `checkAuth()` дуусаагүй байхад middleware дүгнэлт хийхээс сэргийлнэ */
    ready: false,
  }),

  getters: {
    displayName: (state) => state.customer?.name || state.customer?.phone || 'Харилцагч',
  },

  actions: {
    async register(payload: { phone: string; password: string; name?: string; email?: string }) {
      this.loading = true
      try {
        const { $axios } = useNuxtApp()
        const { data } = await $axios.post('/api/v1/customer/auth/register', payload)
        this.apply(data.data.token, data.data.customer)
        return data.data
      } finally {
        this.loading = false
      }
    },

    async login(identifier: string, password: string) {
      this.loading = true
      try {
        const { $axios } = useNuxtApp()
        const { data } = await $axios.post('/api/v1/customer/auth/login', {
          identifier,
          password,
        })
        this.apply(data.data.token, data.data.customer)
        return data.data
      } finally {
        this.loading = false
      }
    },

    /** Google-ээр орсон шинэ хэрэглэгч утсаа өгч бүртгэлээ дуусгана */
    async completeGoogle(pendingToken: string, phone: string, name?: string) {
      this.loading = true
      try {
        const { $axios } = useNuxtApp()
        const { data } = await $axios.post('/api/v1/customer/auth/google/complete', {
          pendingToken,
          phone,
          ...(name ? { name } : {}),
        })
        this.apply(data.data.token, data.data.customer)
        return data.data
      } finally {
        this.loading = false
      }
    },

    /** Google-ийн redirect-ээс шууд ирсэн токеныг хүлээж авна */
    async adoptToken(token: string) {
      this.token = token
      this.isAuthenticated = true
      if (import.meta.client) localStorage.setItem(CUSTOMER_TOKEN_KEY, token)
      await this.refresh()
    },

    async logout() {
      try {
        const { $axios } = useNuxtApp()
        await $axios.post('/api/v1/customer/auth/logout')
      } catch {
        // Серверийн хариу ямар ч байсан локал төлөвийг цэвэрлэнэ
      } finally {
        this.clear()
      }
    },

    clear() {
      this.customer = null
      this.token = null
      this.isAuthenticated = false
      this.ready = true

      if (import.meta.client) {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY)
        localStorage.removeItem(CUSTOMER_USER_KEY)
      }
    },

    apply(token: string, customer: Customer) {
      this.token = token
      this.customer = customer
      this.isAuthenticated = true
      this.ready = true

      if (import.meta.client) {
        localStorage.setItem(CUSTOMER_TOKEN_KEY, token)
        localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(customer))
      }
    },

    /**
     * localStorage-оос сэргээж, серверээр баталгаажуулна.
     *
     * `auth` store-ийн адил: ЗӨВХӨН 401/403-д гаргана. Сүлжээний тасалдал
     * эсвэл серверийн 500 нь токен хүчингүй гэсэн үг БИШ — тэр бүрт
     * хэрэглэгчийг гаргавал холболт тогтворгүй үед байнга гарна.
     */
    async checkAuth(): Promise<boolean> {
      if (!import.meta.client) return false
      if (this.ready && this.isAuthenticated) return true

      const token = localStorage.getItem(CUSTOMER_TOKEN_KEY)
      if (!token) {
        this.ready = true
        return false
      }

      this.token = token
      this.isAuthenticated = true

      const cached = localStorage.getItem(CUSTOMER_USER_KEY)
      if (cached) {
        try {
          this.customer = JSON.parse(cached)
        } catch {
          // Гэмтсэн кэш — сервер дээрх мэдээллээр солигдоно
        }
      }

      try {
        await this.refresh()
        return true
      } catch (e: any) {
        const status = e?.response?.status
        if (status === 401 || status === 403) {
          this.clear()
          return false
        }
        this.ready = true
        return true
      } finally {
        this.ready = true
      }
    },

    async refresh() {
      const { $axios } = useNuxtApp()
      const { data } = await $axios.get('/api/v1/customer/auth/me')
      this.customer = data.data.customer
      this.ready = true
      if (import.meta.client && this.customer) {
        localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(this.customer))
      }
    },
  },
})
