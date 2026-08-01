<script setup lang="ts">
import type { Component } from 'vue'
import {
  LayoutDashboard,
  Package,
  Wallet,
  Truck,
  Warehouse,
  Users,
  BarChart3,
  Bell,
  Settings,
  ShieldCheck,
  UserCog,
  Menu,
  X,
  LogOut,
  Banknote,
} from 'lucide-vue-next'

/**
 * Админ системийн бүтэц — introduction.md §9.1
 *
 * Sidebar цагаан, идэвхтэй цэс цэнхэр, идэвхгүй нь саарал.
 * Navbar цагаан, доор нимгэн border, баруун талд хэрэглэгч.
 *
 * Цэс ролиос хамаарч шүүгдэнэ — гэхдээ энэ нь ЗӨВХӨН эвгүй байдлаас
 * сэргийлэх зорилготой. Жинхэнэ хамгаалалт нь backend-ийн authorize()
 * (docs/security-and-permissions.md §2).
 */
const auth = useAuthStore()
const route = useRoute()

const sidebarOpen = ref(false)

interface NavItem {
  label: string
  to: string
  icon: Component
  roles?: string[]
}

const navigation: NavItem[] = [
  { label: 'Хяналтын самбар', to: '/admin', icon: LayoutDashboard },
  { label: 'Ачаа', to: '/admin/packages', icon: Package },
  { label: 'Тариф', to: '/admin/settings/tariffs', icon: Banknote, roles: ['admin'] },
  { label: 'Төлбөр', to: '/admin/payments', icon: Wallet },
  { label: 'Хүргэлт', to: '/admin/deliveries', icon: Truck },
  { label: 'Агуулах', to: '/admin/warehouse', icon: Warehouse },
  { label: 'Харилцагч', to: '/admin/customers', icon: Users },
  { label: 'Системийн хэрэглэгч', to: '/admin/users', icon: UserCog, roles: ['admin'] },
  { label: 'Тайлан', to: '/admin/reports', icon: BarChart3, roles: ['admin', 'manager'] },
  { label: 'Мэдэгдэл', to: '/admin/notifications', icon: Bell, roles: ['admin', 'manager'] },
  { label: 'Хяналтын бүртгэл', to: '/admin/audit', icon: ShieldCheck, roles: ['admin', 'manager'] },
  { label: 'Вэбийн агуулга', to: '/admin/settings/content', icon: Settings, roles: ['admin'] },
  { label: 'Ерөнхий тохиргоо', to: '/admin/settings/general', icon: Settings, roles: ['admin'] },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ',
  manager: 'Менежер',
  staff: 'Ажилтан',
}

const visibleNav = computed(() =>
  navigation.filter(item => !item.roles || item.roles.includes(auth.user?.role ?? ''))
)

const roleLabel = computed(() => ROLE_LABELS[auth.user?.role ?? ''] ?? '')

const initials = computed(() => {
  const first = auth.user?.firstname?.[0] ?? ''
  const last = auth.user?.lastname?.[0] ?? ''
  return (first + last).toUpperCase() || 'А'
})

function isActive(to: string) {
  return to === '/admin' ? route.path === '/admin' : route.path.startsWith(to)
}

async function logout() {
  await auth.logout()
  await navigateTo('/admin/login')
}

// Хуудас солигдоход мобайл цэсийг хаана
watch(
  () => route.path,
  () => {
    sidebarOpen.value = false
  }
)
</script>

<template>
  <div class="admin-shell min-h-screen bg-surface-bg">
    <!-- Мобайл дэвсгэр -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-30 bg-black/20 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-surface-border bg-surface-card transition-transform duration-200 ease-out lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-14 shrink-0 items-center gap-2 px-4">
        <div class="min-w-0">
          <LandingBrandLogo compact />
          <p class="truncate text-body-sm leading-tight text-content-secondary">
            Удирдлагын систем
          </p>
        </div>

        <button
          class="ml-auto rounded-btn p-1.5 text-content-secondary hover:bg-surface-hover lg:hidden"
          aria-label="Цэс хаах"
          @click="sidebarOpen = false"
        >
          <X :size="20" />
        </button>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NuxtLink
          v-for="item in visibleNav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-btn px-3 py-2.5 text-[14px] leading-5 font-medium transition-colors duration-200"
          :class="
            isActive(item.to)
              ? 'bg-primary-50 text-primary-600'
              : 'text-content-secondary hover:bg-surface-hover hover:text-content'
          "
        >
          <component :is="item.icon" :size="19" :stroke-width="2" />
          <span class="truncate">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <div class="shrink-0 border-t border-surface-border p-3">
        <button
          class="flex w-full items-center gap-3 rounded-btn px-3 py-2.5 text-[14px] leading-5 font-medium text-content-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-error"
          @click="logout"
        >
          <LogOut :size="19" :stroke-width="2" />
          Гарах
        </button>
      </div>
    </aside>

    <!-- Үндсэн хэсэг -->
    <div class="lg:pl-60">
      <header
        class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-surface-border bg-surface-card px-3 sm:px-4"
      >
        <button
          class="rounded-btn p-2 text-content-secondary hover:bg-surface-hover lg:hidden"
          aria-label="Цэс нээх"
          @click="sidebarOpen = true"
        >
          <Menu :size="20" />
        </button>

        <div class="ml-auto flex items-center gap-2">
          <button
            class="rounded-btn p-2 text-content-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-content"
            aria-label="Мэдэгдэл"
          >
            <Bell :size="19" :stroke-width="2" />
          </button>

          <div class="flex items-center gap-2.5 pl-2">
            <div class="hidden text-right sm:block">
              <p class="text-body font-semibold leading-tight text-content">
                {{ auth.userFullName || 'Ажилтан' }}
              </p>
              <p class="text-body-sm leading-tight text-content-secondary">{{ roleLabel }}</p>
            </div>
            <div
              class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-body font-bold text-primary-600"
            >
              {{ initials }}
            </div>
          </div>
        </div>
      </header>

      <main class="p-3 sm:p-4">
        <slot />
      </main>
    </div>

    <!-- Toast-ууд layout бүрт НЭГ удаа -->
    <UiToastHost />
  </div>
</template>
