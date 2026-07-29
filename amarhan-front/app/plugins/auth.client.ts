/**
 * Апп эхлэхэд нэвтрэлтийн төлөвийг localStorage-оос сэргээнэ.
 *
 * Өмнөх хувилбар `enforce: 'pre'` + `setTimeout(50)` ашиглаж байсан нь Pinia
 * суулгагдахаас ӨМНӨ ажиллаж, "getActivePinia() was called but there was no
 * active Pinia" алдаа өгдөг байсан. `dependsOn` нь Nuxt-д Pinia-гийн plugin
 * бэлэн болсны дараа ажиллуулахыг баталгаажуулна — цаг хугацааны таамаг хэрэггүй.
 */
export default defineNuxtPlugin({
  name: 'auth-init',
  dependsOn: ['pinia'],

  async setup() {
    const authStore = useAuthStore()
    await authStore.checkAuth()
  },
})
