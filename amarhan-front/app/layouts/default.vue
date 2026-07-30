<script setup lang="ts">
import { Menu, X, User, LogOut, Package, Wallet, MapPin, LayoutDashboard } from 'lucide-vue-next'

/**
 * Харилцагчийн вэбийн layout — introduction.md §3
 *
 * Админ хэсгээс (`layouts/admin.vue`) ялгаатай: sidebar байхгүй, дээд
 * навигацитай, нээлттэй хуудсууд (нүүр, ачаа хайх, Эрээний хаяг) зочинд
 * ч харагдана. Мобайл дээр ашиглагдах нь ихээхэн тул цэс нь хураагддаг.
 */
const customer = useCustomerStore()
const route = useRoute()

const menuOpen = ref(false)

const publicNav = [
  { label: 'Ачаа хайх', to: '/track' },
  { label: 'Хүлээн авах хаяг', to: '/address' },
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
  }
)
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface-bg">
    <header class="sticky top-0 z-30 border-b border-surface-border bg-surface-card">
      <div class="mx-auto flex h-navbar max-w-6xl items-center gap-3 px-4 sm:px-6">
        <NuxtLink to="/" class="flex shrink-0 items-center gap-2.5">
          <img src="/logo-mark.png" alt="Ивээлт Карго" class="h-9 w-9 rounded-btn object-cover" width="36" height="36" />
          <span class="font-bold text-content">Ивээл Карго</span>
        </NuxtLink>

        <nav class="ml-6 hidden items-center gap-1 md:flex">
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

        <div class="ml-auto flex items-center gap-2">
          <template v-if="customer.isAuthenticated">
            <NuxtLink
              to="/my"
              class="hidden items-center gap-2.5 rounded-btn px-2 py-1.5 hover:bg-surface-hover sm:flex"
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
            <UiBtn variant="ghost" size="sm" :icon="LogOut" class="hidden sm:inline-flex" @click="logout">
              Гарах
            </UiBtn>
          </template>

          <template v-else>
            <UiBtn variant="ghost" size="sm" to="/login" class="hidden sm:inline-flex">Нэвтрэх</UiBtn>
            <UiBtn size="sm" to="/register" class="hidden sm:inline-flex">Бүртгүүлэх</UiBtn>
          </template>

          <button
            class="rounded-btn p-2 text-content-secondary hover:bg-surface-hover md:hidden"
            :aria-label="menuOpen ? 'Цэс хаах' : 'Цэс нээх'"
            @click="menuOpen = !menuOpen"
          >
            <X v-if="menuOpen" :size="20" />
            <Menu v-else :size="20" />
          </button>
        </div>
      </div>

      <!-- Мобайл цэс -->
      <div v-if="menuOpen" class="border-t border-surface-border bg-surface-card md:hidden">
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
            <NuxtLink
              v-for="item in accountNav"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 rounded-btn px-3 py-2.5 text-body font-medium"
              :class="
                isActive(item.to)
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-content-secondary hover:bg-surface-hover'
              "
            >
              <component :is="item.icon" :size="18" :stroke-width="2" />
              {{ item.label }}
            </NuxtLink>
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

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <slot />
    </main>

    <footer class="border-t border-surface-border bg-surface-card">
      <div
        class="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-body-sm text-content-secondary sm:flex-row sm:items-center sm:justify-between sm:px-6"
      >
        <p>© {{ new Date().getFullYear() }} Ивээл Карго</p>
        <nav class="flex gap-4">
          <NuxtLink to="/track" class="hover:text-content">Ачаа хайх</NuxtLink>
          <NuxtLink to="/address" class="hover:text-content">Хүлээн авах хаяг</NuxtLink>
          <NuxtLink to="/help" class="hover:text-content">Тусламж</NuxtLink>
        </nav>
      </div>
    </footer>

    <UiToastHost />
  </div>
</template>
