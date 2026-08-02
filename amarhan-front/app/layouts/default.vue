<script setup lang="ts">
import { Menu, X, User, LogOut, Package, Wallet, MapPin, LayoutDashboard, Bell, Sun, Moon } from 'lucide-vue-next'

/**
 * Харилцагчийн вэбийн layout — introduction.md §3
 *
 * Нээлттэй хуудсууд (нүүр, ачаа хайх, Эрээний хаяг) зочинд ч харагдана.
 * Нэвтэрсэн харилцагч desktop дээр sidebar, харин утсан дээр доод tab-аар
 * үндсэн таван хуудсаа хурдан сольдог.
 */
const customer = useCustomerStore()
const route = useRoute()

const menuOpen = ref(false)
const { isDark, toggle: toggleDark } = useDarkMode()

/**
 * `customer.isAuthenticated`-г sidebar/header-ийн бүтэц, class-д ШУУД
 * ашиглаж болохгүй. `plugins/auth.client.ts` нь mount-аас ӨМНӨ шийддэг тул
 * буцаж ирсэн (already logged-in) харилцагчид эхний КЛИЕНТ рендер дээр
 * `isAuthenticated` аль хэдийн `true` байдаг — харин серверт localStorage
 * байхгүй тул SSR HTML үргэлж `false`-оор гардаг. Энэ зөрүү `useDarkMode`-
 * ийн `isDark`-тай яг адил hydration mismatch үүсгэдэг бөгөөд Vue 3.4+ үүнийг
 * class/style attribute дээр АВТОМАТААР засдаггүй (зөвхөн `v-if` мэт бүтцийн
 * зөрүүг л зассан DOM бичдэг) — тиймээс sidebar ХАРАГДАЖ БАЙХАД header
 * hidden болохгүй "царцаж", 2 лого зэрэг харагдаж, агуулга sidebar-аар
 * дарагддаг байсан. Иймд layout-ийн бүтэц ШИЙДЭХ бүх газарт (sidebar/header
 * v-if, lg:hidden, lg:pl-60, max-w) энэ mount-ийн ДАРАА синхрончилсон
 * хувьсагчийг ашиглана — `customer.isAuthenticated`-ийг ӨӨРИЙГ нь ЗӨВХӨН
 * бодит өгөгдөл (нэр, тоо г.м.) харуулахад шууд ашиглаж болно, тэдгээр нь
 * `v-if`-ээр хамгаалагдсан тул аль хэдийн зөв hydrate хийгддэг.
 */
const authLayout = ref(false)
onMounted(() => {
  watch(() => customer.isAuthenticated, v => (authLayout.value = v), { immediate: true })
})

// `UiModal`/`UiToastHost` нь `Teleport to="body"`-оор ЭНЭ layout-ийн DOM
// модноос гардаг тул `.dark` класс тэдэнд DOM-оор УЛАМЖЛАГДАХГҮЙ. Vue-ийн
// provide/inject нь Teleport-оор БУСДААГГҮЙ (логик компонентын мод хэвээрээ)
// тул тэднийг харанхуй горимд оруулах цорын ганц найдвартай зам.
provide('customerDark', isDark)

// Header дэх юанийн ханшийн тэмдэглэгээ — нээлттэй мэдээлэл тул нэвтрээгүй
// зочинд ч харагдана (§3, "Туслах үйлчилгээ").
const { content } = usePublicContent()
const { data: headerSite } = await useAsyncData('default-layout-content', () => content(), {
  default: () => null,
})
const yuanTransfer = computed(() => headerSite.value?.yuan_transfer ?? null)

// §7 (Phase 6) — Bell дэх уншаагүй тоо. Хуудас солигдох бүрт дахин татна
// (доорх `watch(route.path)`-д аль хэдийн байгаа) — тусдаа polling механизм
// шаардлагагүй, харилцагч /my/notifications-руу орох бүрт өөрөө шинэчлэгдэнэ.
const unreadCount = ref(0)

async function loadUnreadCount() {
  if (!customer.isAuthenticated) return
  try {
    unreadCount.value = await useCustomerPortal().unreadNotificationCount()
  } catch {
    // Чимээгүй алгасна — bell дэх тоо гоёл чимэглэл, урсгалыг блоклохгүй
  }
}

const publicNav = [
  { label: 'Ачаа хайх', to: '/track' },
  { label: 'Хүлээн авах хаяг', to: '/address' },
  { label: 'Мэдэгдэл', to: '/notifications' },
  { label: 'Тусламж', to: '/help' },
]

const accountNav = [
  { label: 'Хяналт', to: '/my', icon: LayoutDashboard },
  { label: 'Миний ачаа', to: '/my/packages', icon: Package },
  { label: 'Төлбөр', to: '/my/payments', icon: Wallet },
  { label: 'Хүргэлт', to: '/my/deliveries', icon: MapPin },
  { label: 'Профайл', to: '/my/profile', icon: User },
]

const initials = computed(() => {
  const name = customer.customer?.name?.trim()
  if (name) return name.slice(0, 1).toUpperCase()
  return customer.customer?.phone?.slice(0, 1) ?? 'Х'
})

function isActive(to: string) {
  return to === '/my' ? route.path === '/my' : route.path.startsWith(to)
}

async function logout() {
  await customer.logout()
  await navigateTo('/')
}

watch(
  () => route.path,
  () => {
    menuOpen.value = false
    loadUnreadCount()
  }
)
onMounted(loadUnreadCount)
</script>

<template>
  <div class="min-h-screen bg-surface-bg" :class="{ dark: isDark }">
    <!-- Нэвтэрсэн харилцагчийн desktop sidebar -->
    <aside
      v-if="authLayout"
      class="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-surface-border bg-surface-card lg:flex"
    >
      <div class="flex h-navbar shrink-0 items-center justify-between px-4">
        <NuxtLink to="/" class="flex items-center">
          <img
            src="/logo-full.png"
            alt="ИВЭЭЛТ КАРГО"
            class="h-9 w-[172px] rounded-md object-contain object-left dark:bg-white dark:px-2 dark:py-1"
            width="172"
            height="36"
          />
        </NuxtLink>

        <div class="flex shrink-0 items-center gap-1">
          <button
            class="rounded-btn p-2 text-content-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-content"
            :aria-label="isDark ? 'Гэрэлт горим руу шилжих' : 'Харанхуй горим руу шилжих'"
            @click="toggleDark"
          >
            <Sun v-if="isDark" :size="19" :stroke-width="2" />
            <Moon v-else :size="19" :stroke-width="2" />
          </button>

          <NuxtLink
            to="/my/notifications"
            class="relative rounded-btn p-2 text-content-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-content"
            aria-label="Мэдэгдэл"
          >
            <Bell :size="19" :stroke-width="2" />
            <span
              v-if="unreadCount > 0"
              class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-white"
            >
              {{ unreadCount > 9 ? '9+' : unreadCount }}
            </span>
          </NuxtLink>
        </div>
      </div>

      <div v-if="yuanTransfer" class="border-b border-surface-border px-3 py-3">
        <ServicesExchangeRateBadge class="w-full justify-center" :data="yuanTransfer" />
      </div>

      <nav class="flex-1 space-y-1 px-3 py-4" aria-label="Хэрэглэгчийн цэс">
        <NuxtLink
          v-for="item in accountNav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-btn px-3 py-2.5 text-body font-medium transition-colors duration-200"
          :class="
            isActive(item.to)
              ? 'bg-primary-50 text-primary-600'
              : 'text-content-secondary hover:bg-surface-hover hover:text-content'
          "
        >
          <component :is="item.icon" :size="19" :stroke-width="2" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <div class="border-t border-surface-border p-3">
        <NuxtLink
          to="/my/profile"
          class="flex items-center gap-2.5 rounded-btn px-3 py-2.5 hover:bg-surface-hover"
        >
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-body font-bold text-primary-600"
          >
            {{ initials }}
          </div>
          <span class="min-w-0 flex-1 truncate text-body font-medium text-content">
            {{ customer.displayName }}
          </span>
        </NuxtLink>
        <button
          class="mt-1 flex w-full items-center gap-3 rounded-btn px-3 py-2.5 text-body font-medium text-content-secondary hover:bg-surface-hover hover:text-error"
          @click="logout"
        >
          <LogOut :size="19" :stroke-width="2" />
          Гарах
        </button>
      </div>
    </aside>

    <div class="flex min-h-screen flex-col" :class="authLayout ? 'lg:pl-60' : ''">
      <header
        class="sticky top-0 z-30 border-b border-surface-border bg-surface-card"
        :class="authLayout ? 'lg:hidden' : ''"
      >
        <div
          class="mx-auto flex h-navbar items-center gap-3 px-4 sm:px-6"
          :class="authLayout ? 'max-w-none' : 'max-w-6xl'"
        >
          <NuxtLink
            to="/"
            class="flex shrink-0 items-center"
            :class="authLayout ? 'lg:hidden' : ''"
          >
            <img
              src="/logo-full.png"
              alt="ИВЭЭЛТ КАРГО"
              class="h-9 w-[172px] rounded-md object-contain object-left dark:bg-white dark:px-2 dark:py-1"
              width="172"
              height="36"
            />
          </NuxtLink>

          <nav v-if="!authLayout" class="ml-6 hidden items-center gap-1 lg:flex">
            <NuxtLink
              v-for="item in publicNav"
              :key="item.to"
              :to="item.to"
              class="rounded-btn px-3 py-2 text-body font-medium transition-colors duration-200"
              :class="
                isActive(item.to)
                  ? 'text-primary-600'
                  : 'text-content-secondary hover:bg-surface-hover hover:text-content'
              "
            >
              {{ item.label }}
            </NuxtLink>
          </nav>

          <ServicesExchangeRateBadge class="ml-2 hidden sm:inline-flex" :data="yuanTransfer" />

          <div class="ml-auto flex items-center gap-2">
            <button
              class="rounded-btn p-2 text-content-secondary hover:bg-surface-hover"
              :class="authLayout ? 'lg:hidden' : ''"
              :aria-label="isDark ? 'Гэрэлт горим руу шилжих' : 'Харанхуй горим руу шилжих'"
              @click="toggleDark"
            >
              <Sun v-if="isDark" :size="20" :stroke-width="2" />
              <Moon v-else :size="20" :stroke-width="2" />
            </button>

            <template v-if="authLayout">
              <NuxtLink
                to="/my/notifications"
                class="relative rounded-btn p-2 text-content-secondary hover:bg-surface-hover lg:hidden"
                aria-label="Мэдэгдэл"
              >
                <Bell :size="20" :stroke-width="2" />
                <span
                  v-if="unreadCount > 0"
                  class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-white"
                >
                  {{ unreadCount > 9 ? '9+' : unreadCount }}
                </span>
              </NuxtLink>

              <NuxtLink
                to="/my/profile"
                class="hidden items-center gap-2.5 rounded-btn px-2 py-1.5 hover:bg-surface-hover sm:flex lg:hidden"
              >
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-body font-bold text-primary-600"
                >
                  {{ initials }}
                </div>
                <span class="max-w-[10rem] truncate text-body font-medium text-content">
                  {{ customer.displayName }}
                </span>
              </NuxtLink>
            </template>

            <template v-else>
              <UiBtn variant="ghost" size="sm" to="/login" class="hidden sm:inline-flex">Нэвтрэх</UiBtn>
              <UiBtn size="sm" to="/register" class="hidden sm:inline-flex">Бүртгүүлэх</UiBtn>
            </template>

            <button
              class="rounded-btn p-2 text-content-secondary hover:bg-surface-hover lg:hidden"
              :aria-label="menuOpen ? 'Цэс хаах' : 'Цэс нээх'"
              @click="menuOpen = !menuOpen"
            >
              <X v-if="menuOpen" :size="20" />
              <Menu v-else :size="20" />
            </button>
          </div>
        </div>

        <!-- Мобайл нэмэлт цэс: account-ийн 5 хуудас нь доод tab-д байна. -->
        <div v-if="menuOpen" class="border-t border-surface-border bg-surface-card lg:hidden">
          <nav class="mx-auto max-w-6xl space-y-1 px-4 py-3">
            <NuxtLink
              v-for="item in publicNav"
              :key="item.to"
              :to="item.to"
              class="block rounded-btn px-3 py-2.5 text-body font-medium text-content-secondary hover:bg-surface-hover"
            >
              {{ item.label }}
            </NuxtLink>

            <div class="my-2 border-t border-surface-border" />

            <template v-if="customer.isAuthenticated">
              <button
                class="flex w-full items-center gap-3 rounded-btn px-3 py-2.5 text-body font-medium text-content-secondary hover:bg-surface-hover hover:text-error"
                @click="logout"
              >
                <LogOut :size="18" :stroke-width="2" />
                Гарах
              </button>
            </template>

            <template v-else>
              <NuxtLink
                to="/login"
                class="block rounded-btn px-3 py-2.5 text-body font-medium text-content-secondary hover:bg-surface-hover"
              >
                Нэвтрэх
              </NuxtLink>
              <NuxtLink
                to="/register"
                class="block rounded-btn px-3 py-2.5 text-body font-semibold text-primary-600 hover:bg-surface-hover"
              >
                Бүртгүүлэх
              </NuxtLink>
            </template>
          </nav>
        </div>
      </header>

      <main
        class="mx-auto w-full flex-1 px-4 py-6 sm:px-6 sm:py-8"
        :class="authLayout ? 'max-w-7xl pb-24 lg:pb-8' : 'max-w-6xl'"
      >
        <slot />
      </main>

      <footer class="border-t border-surface-border bg-surface-card">
        <div
          class="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-body-sm text-content-secondary sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <p>© {{ new Date().getFullYear() }} Ивээлт Карго</p>
          <nav class="flex gap-4">
            <NuxtLink to="/track" class="hover:text-content">Ачаа хайх</NuxtLink>
            <NuxtLink to="/address" class="hover:text-content">Хүлээн авах хаяг</NuxtLink>
            <NuxtLink to="/notifications" class="hover:text-content">Мэдэгдэл</NuxtLink>
            <NuxtLink to="/help" class="hover:text-content">Тусламж</NuxtLink>
          </nav>
        </div>
      </footer>
    </div>

    <!-- Гар утасны 5 tab: доод талд үргэлж харагдана. -->
    <nav
      v-if="authLayout"
      class="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-surface-border bg-surface-card pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(15,23,42,0.06)] lg:hidden"
      aria-label="Хэрэглэгчийн үндсэн цэс"
    >
      <NuxtLink
        v-for="item in accountNav"
        :key="item.to"
        :to="item.to"
        class="flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-center text-[10px] font-medium leading-3"
        :class="isActive(item.to) ? 'text-primary-600' : 'text-content-secondary'"
      >
        <component :is="item.icon" :size="20" :stroke-width="isActive(item.to) ? 2.5 : 2" />
        <span class="truncate">{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <UiToastHost />
  </div>
</template>
