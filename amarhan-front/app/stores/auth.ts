import { defineStore } from 'pinia'

export type StaffRole = 'admin' | 'manager' | 'staff'

export interface StaffUser {
  id: string
  email: string
  firstname: string
  lastname: string
  role: StaffRole
  branchId?: string | null
  status: 'active' | 'deactive'
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as StaffUser | null,
    token: null as string | null,
    isAuthenticated: false,
    loading: false,
  }),

  getters: {
    isAdmin: (state) => state.user?.role === 'admin',
    // Менежерийн эрх — өдөр тутмын удирдлага (introduction.md §9.1)
    isManager: (state) => ['admin', 'manager'].includes(state.user?.role ?? ''),
    userFullName: (state) => {
      if (!state.user) return ''
      return `${state.user.firstname ?? ''} ${state.user.lastname ?? ''}`.trim()
    },
  },

  actions: {
    async login(email: string, password: string) {
      this.loading = true
      try {
        const { $axios } = useNuxtApp()
        const response = await $axios.post('/api/v1/auth/login', { email, password })

        const { token, user } = response.data.data
        this.token = token
        this.user = user
        this.isAuthenticated = true

        if (import.meta.client) {
          localStorage.setItem('auth_token', token)
          localStorage.setItem('auth_user', JSON.stringify(user))
        }

        return response.data.data
      } finally {
        this.loading = false
      }
    },

    async logout() {
      try {
        const { $axios } = useNuxtApp()
        await $axios.post('/api/v1/auth/logout')
      } catch {
        // Серверийн хариу ямар ч байсан локал төлөвийг цэвэрлэнэ
      } finally {
        this.clearAuth()
      }
    },

    clearAuth() {
      this.user = null
      this.token = null
      this.isAuthenticated = false

      if (import.meta.client) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
      }
    },

    /**
     * localStorage-оос төлөв сэргээж, токеныг сервер дээр баталгаажуулна.
     * Сервер баталгаажуулаагүй бол нэвтрэлт хүчингүй — локал өгөгдөлд итгэхгүй.
     */
    async checkAuth(): Promise<boolean> {
      if (!import.meta.client) return false

      const token = localStorage.getItem('auth_token')
      const userStr = localStorage.getItem('auth_user')

      if (!token || !userStr) return false

      try {
        this.token = token
        this.user = JSON.parse(userStr)
        this.isAuthenticated = true

        const { $axios } = useNuxtApp()
        const response = await $axios.get('/api/v1/auth/me')

        // Серверийн мэдээллийг эх сурвалж болгоно (эрх өөрчлөгдсөн байж болно)
        this.user = response.data.data.user ?? this.user
        if (this.user) {
          localStorage.setItem('auth_user', JSON.stringify(this.user))
        }
        return true
      } catch (e: any) {
        // ЗӨВХӨН эрхийн алдаанд гаргана. Сүлжээний тасалдал, серверийн 500,
        // эсвэл програмын алдаа (`$axios` бэлэн болоогүй гэх мэт) нь токен
        // хүчингүй гэсэн үг БИШ — тэр бүрт гаргавал ажилтан ажлын дундуур
        // санамсаргүй гарч, §1.4-ийн бүртгэлийн урсгал тасална.
        const status = e?.response?.status
        if (status === 401 || status === 403) {
          this.clearAuth()
          return false
        }

        // Локалаас сэргээсэн төлөвөө үлдээнэ. Токен үнэхээр хүчингүй бол
        // дараагийн хүсэлтэд axios-ийн 401 interceptor барина.
        console.warn('[auth] Токен баталгаажуулж чадсангүй, локал төлөвөөр үргэлжилнэ', e?.message)
        return true
      }
    },

    async refreshUser() {
      if (!this.isAuthenticated) return

      try {
        const { $axios } = useNuxtApp()
        const response = await $axios.get('/api/v1/auth/me')
        this.user = response.data.data.user
        if (import.meta.client && this.user) {
          localStorage.setItem('auth_user', JSON.stringify(this.user))
        }
      } catch {
        this.clearAuth()
      }
    },
  },
})
