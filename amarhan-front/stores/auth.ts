import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as any,
    token: null as string | null,
    isAuthenticated: false,
    loading: false
  }),

  getters: {
    isAdmin: (state) => state.user?.role === 'admin',
    isManager: (state) => ['admin', 'manager', 'senior_manager'].includes(state.user?.role),
    userFullName: (state) => {
      if (!state.user) return ''
      const firstName = state.user.firstname || state.user.firstName || ''
      const lastName = state.user.lastname || state.user.lastName || ''
      return `${firstName} ${lastName}`.trim() || 'Админ'
    }
  },

  actions: {
    async login(email: string, password: string) {
      this.loading = true
      try {
        const { $axios } = useNuxtApp()
        const response = await $axios.post('/api/v1/auth/login', {
          email,
          password
        })
        
        this.token = response.data.token
        this.user = response.data.user
        this.isAuthenticated = true
        
        console.log('Auth store updated:', {
          token: this.token ? 'present' : 'missing',
          user: this.user,
          isAuthenticated: this.isAuthenticated
        })
        
        // Store in localStorage (only on client side)
        if (typeof window !== 'undefined') {
          if (this.token) {
            localStorage.setItem('auth_token', this.token)
          }
          if (this.user) {
            localStorage.setItem('auth_user', JSON.stringify(this.user))
          }
        }
        
        // Set axios default header
        if (this.token) {
          $axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
        }
        
        return response.data
      } catch (error: any) {
        // Demo mode: If network error, use mock login
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          console.warn('API connection failed, using demo mode')
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
      } catch (error) {
        console.error('Logout error:', error)
      } finally {
        this.clearAuth()
      }
    },

    clearAuth() {
      this.user = null
      this.token = null
      this.isAuthenticated = false
      
      // Clear localStorage (only on client side)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        localStorage.removeItem('demo_mode')
      }
      
      // Clear axios header
      const { $axios } = useNuxtApp()
      delete $axios.defaults.headers.common['Authorization']
    },

    async checkAuth() {
      // Check if we're on the client side
      if (typeof window === 'undefined') {
        return false
      }
      
      const token = localStorage.getItem('auth_token')
      const userStr = localStorage.getItem('auth_user')
      const isDemoMode = localStorage.getItem('demo_mode') === 'true'
      
      if (token && userStr) {
        try {
          this.token = token
          this.user = JSON.parse(userStr)
          this.isAuthenticated = true
          
          // Set axios header
          const { $axios } = useNuxtApp()
          if (token) {
            $axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
          }
          
          // If demo mode, skip server verification
          if (isDemoMode) {
            return true
          }
          
          // Verify token with server
          try {
            await $axios.get('/api/v1/auth/me')
            return true
          } catch (error: any) {
            // If network error in demo mode, keep user logged in
            if (error.code === 'ERR_NETWORK' && isDemoMode) {
              return true
            }
            throw error
          }
        } catch (error) {
          console.error('Auth check failed:', error)
          // Only clear auth if not in demo mode
          if (!isDemoMode) {
            this.clearAuth()
          }
          return false
        }
      }
      
      return false
    },

    async refreshUser() {
      if (!this.isAuthenticated) return
      
      try {
        const { $axios } = useNuxtApp()
        const response = await $axios.get('/api/v1/auth/me')
        this.user = response.data.user
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_user', JSON.stringify(this.user))
        }
      } catch (error) {
        console.error('Failed to refresh user:', error)
        this.clearAuth()
      }
    }
  }
})