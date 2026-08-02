<script setup lang="ts">
import { LayoutDashboard, Menu, X } from 'lucide-vue-next'

defineProps<{
  yuanTransfer: {
    rate?: number | null
    bankAccount?: string
    accountHolder?: string
    transferNote?: string
    facebookUrl?: string
    instructions?: string
  } | null
}>()

const customer = useCustomerStore()
const menuOpen = ref(false)

const navLinks = [
  { label: 'Тариф', to: { path: '/', hash: '#pricing' } },
  { label: 'Ачаа хайх', to: '/track' },
  { label: 'Хүлээн авах хаяг', to: '/address' },
  { label: 'Тусламж', to: '/help' },
]
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/85">
    <div class="mx-auto flex h-[72px] max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-8">
      <NuxtLink to="/" class="flex shrink-0 items-center" aria-label="Нүүр хуудас">
        <LandingBrandLogo compact class="sm:hidden" />
        <LandingBrandLogo class="hidden sm:flex" />
      </NuxtLink>

      <nav class="ml-5 hidden items-center gap-1 lg:flex" aria-label="Үндсэн цэс">
        <NuxtLink
          v-for="item in navLinks"
          :key="item.label"
          :to="item.to"
          class="rounded-full px-3.5 py-2 text-body-sm font-medium text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- Ханш нь нэвтрэх хуудаснаас ч үргэлж шууд харагдана. -->
      <ServicesExchangeRateBadge class="ml-auto" :data="yuanTransfer" />

      <div class="flex shrink-0 items-center gap-2">
        <ClientOnly>
          <UiBtn v-if="customer.isAuthenticated" size="sm" to="/my" :icon="LayoutDashboard" class="hidden sm:inline-flex">
            Хэрэглэгчийн вэб
          </UiBtn>
          <template v-else>
            <NuxtLink
              to="/login"
              class="hidden rounded-full px-4 py-2 text-body-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white sm:inline-flex"
            >
              Нэвтрэх
            </NuxtLink>
            <UiBtn size="sm" to="/register" class="hidden sm:inline-flex">Бүртгүүлэх</UiBtn>
          </template>

          <template #fallback>
            <NuxtLink
              to="/login"
              class="hidden rounded-full px-4 py-2 text-body-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white sm:inline-flex"
            >
              Нэвтрэх
            </NuxtLink>
            <UiBtn size="sm" to="/register" class="hidden sm:inline-flex">Бүртгүүлэх</UiBtn>
          </template>
        </ClientOnly>

        <button
          class="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
          :aria-label="menuOpen ? 'Цэс хаах' : 'Цэс нээх'"
          @click="menuOpen = !menuOpen"
        >
          <X v-if="menuOpen" :size="20" />
          <Menu v-else :size="20" />
        </button>
      </div>
    </div>

    <div v-if="menuOpen" class="border-t border-slate-200/70 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95 lg:hidden">
      <nav class="mx-auto max-w-7xl space-y-1 px-5 py-4" aria-label="Гар утасны цэс">
        <NuxtLink
          v-for="item in navLinks"
          :key="item.label"
          :to="item.to"
          class="block rounded-xl px-3 py-2.5 text-body font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          @click="menuOpen = false"
        >
          {{ item.label }}
        </NuxtLink>
        <div class="my-2 border-t border-slate-200 dark:border-slate-700" />
        <ClientOnly>
          <NuxtLink
            v-if="!customer.isAuthenticated"
            to="/login"
            class="block rounded-xl px-3 py-2.5 text-body font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            @click="menuOpen = false"
          >
            Нэвтрэх
          </NuxtLink>
          <NuxtLink
            :to="customer.isAuthenticated ? '/my' : '/register'"
            class="block rounded-xl px-3 py-2.5 text-body font-semibold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40"
            @click="menuOpen = false"
          >
            {{ customer.isAuthenticated ? 'Хэрэглэгчийн вэб' : 'Бүртгүүлэх' }}
          </NuxtLink>
        </ClientOnly>
      </nav>
    </div>
  </header>
</template>
