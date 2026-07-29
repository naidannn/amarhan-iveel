export default defineNuxtPlugin({
  name: 'auth-init',
  enforce: 'pre', // Run before other plugins to initialize auth early
  async setup() {
    // Initialize auth state on app startup (client-side only)
    if (process.client) {
      // Wait a bit to ensure Pinia is initialized by @pinia/nuxt
      await new Promise(resolve => setTimeout(resolve, 50))
      
      try {
        const authStore = useAuthStore()
        // Restore auth state from localStorage before any navigation
        await authStore.checkAuth()
      } catch (error: any) {
        // If Pinia is not ready, try again after a short delay
        if (error?.message?.includes('getActivePinia')) {
          await new Promise(resolve => setTimeout(resolve, 100))
          try {
            const authStore = useAuthStore()
            await authStore.checkAuth()
          } catch (retryError) {
            console.error('Failed to initialize auth after retry:', retryError)
          }
        } else {
          console.error('Failed to initialize auth:', error)
        }
      }
    }
  }
})
