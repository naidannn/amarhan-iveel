/**
 * Харанхуй горим — ЗӨВХӨН харилцагчийн вэб (`layouts/default.vue`,
 * `layouts/landing.vue`). Админ хэсэгт БАЙХГҮЙ, тиймээс `dark` класс энд
 * зөвхөн эдгээр layout-ийн үндсэн элемент дээр залгагдана — `<html>`/`<body>`
 * дээр биш, ингэснээр админ layout-ийн модонд хэзээ ч уламжлагдахгүй.
 *
 * `isDark`-ыг `onMounted`-д л жинхэнэ утгаар (localStorage/systemийн
 * сонголтоор) дүүргэнэ — SSR ба клиентийн ЭХНИЙ рендер аль аль нь `false`-оор
 * ЯГ таарна. Setup үед шууд localStorage унших нь hydration mismatch үүсгэдэг
 * (Vue 3.4+ class mismatch-ыг performance-ийн үүднээс АВТОМАТААР засдаггүй —
 * зөвхөн warning гаргаад орхидог), үүний улмаас dark горим localStorage-д
 * хадгалагдсан ч дараагийн ачаалалт дээр UI гэрэлт хэвээрээ "царцдаг" байсан.
 * `onMounted`-ийн өөрчлөлт бол hydration-ийн ДАРАА жинхэнэ reactive update тул
 * Vue зөв patch хийнэ.
 */
const STORAGE_KEY = 'iveel:customer-theme'

export function useDarkMode() {
  const isDark = ref(false)

  onMounted(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    isDark.value =
      stored !== null ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  function toggle() {
    isDark.value = !isDark.value
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
  }

  return { isDark, toggle }
}
