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
    await authStore.checkAuth()
  },
})
