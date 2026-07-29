export default defineNuxtRouteMiddleware(async (to) => {
  // Only run on client side
  if (!import.meta.client) return

  const authStore = useAuthStore()

  // If not authenticated, try to restore from localStorage
  if (!authStore.isAuthenticated) {
    const authenticated = await authStore.checkAuth()
    if (!authenticated) {
      if (to.path !== '/admin/login') {
        return navigateTo('/admin/login')
      }
      return
    }
  }

  // Check role access
  const allowedRoles = ['admin', 'manager', 'senior_manager', 'user']
  if (!authStore.user || !allowedRoles.includes(authStore.user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Та энэ хуудас руу хандах эрхгүй байна',
    })
  }
})
