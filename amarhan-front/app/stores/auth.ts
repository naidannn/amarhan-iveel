import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as any,
    token: null as string | null,
    isAuthenticated: false,
    loading: false,
  }),

  getters: {
    isAdmin: (state) => state.user?.role === 'admin',
    isManager: (state) => ['admin', 'manager', 'senior_manager'].includes(state.user?.role),
    userFullName: (state) => {
      if (!state.user) return ''
      const firstName = state.user.firstname || state.user.firstName || ''
      const lastName = state.user.lastname || state.user.lastName || ''
      return `${firstName} ${lastName}`.trim() || 'Админ'
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
      } catch (error: any) {
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          return this.demoLogin(email, password)
        }
        throw error
      } finally {
        this.loading = false
      }
    },

    async logout() {
      try {
        const { $axios } = useNuxtApp()
        await $axios.post('/api/v1/auth/logout')
      } catch {
        // Ignore logout errors
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
        localStorage.removeItem('demo_mode')
      }

      try {
        const { $axios } = useNuxtApp()
        delete $axios.defaults.headers.common['Authorization']
      } catch {
        // axios not available
      }
    },

    async checkAuth(): Promise<boolean> {
      if (!import.meta.client) return false

      const token = localStorage.getItem('auth_token')
      const userStr = localStorage.getItem('auth_user')
      const isDemoMode = localStorage.getItem('demo_mode') === 'true'

      if (!token || !userStr) return false

      try {
        this.token = token
        this.user = JSON.parse(userStr)
        this.isAuthenticated = true

        if (isDemoMode) return true

        // Verify token with server
        const { $axios } = useNuxtApp()
        $axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
        await $axios.get('/api/v1/auth/me')
        return true
      } catch {
        if (!isDemoMode) {
          this.clearAuth()
        }
        return isDemoMode
      }
    },

    async refreshUser() {
      if (!this.isAuthenticated) return

      try {
        const { $axios } = useNuxtApp()
        const response = await $axios.get('/api/v1/auth/me')
        this.user = response.data.data.user
        if (import.meta.client) {
          localStorage.setItem('auth_user', JSON.stringify(this.user))
        }
      } catch {
        this.clearAuth()
      }
    },

    async demoLogin(email: string, password: string) {
      if (email === 'admin@amarhan.mn' && password === 'REDACTED_PASSWORD') {
        this.token = 'demo-token-' + Date.now()
        this.user = {
          id: 'demo-user-1',
          email: 'admin@amarhan.mn',
          role: 'admin',
          firstname: 'Admin',
          lastname: 'User',
        }
        this.isAuthenticated = true

        if (import.meta.client) {
          localStorage.setItem('auth_token', this.token!)
          localStorage.setItem('auth_user', JSON.stringify(this.user))
          localStorage.setItem('demo_mode', 'true')
        }

        return { token: this.token, user: this.user }
      }

      throw new Error('Invalid demo credentials. Use admin@amarhan.mn / REDACTED_PASSWORD')
    },
  },
})
