/**
 * Харилцагчийн хувийн хэсгийг (`/my/*`) хамгаална — introduction.md §3.
 *
 * Ажилтны `auth.ts`-ээс ТУСДАА: өөр store, өөр нэвтрэх хуудас. Энэ нь
 * зөвхөн эвгүй байдлаас сэргийлэх давхарга — жинхэнэ хамгаалалт нь
 * backend-ийн `authorizeCustomer()` (docs/security-and-permissions.md §2).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return

  const customer = useCustomerStore()

  if (!customer.isAuthenticated) {
    const authenticated = await customer.checkAuth()
    if (!authenticated) {
      // Нэвтэрсний дараа очих гэсэн хуудсаа алдахгүй
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    }
  }
})
