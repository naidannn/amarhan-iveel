<script setup lang="ts">
import { Menu, X } from 'lucide-vue-next'

/**
 * Нүүр хуудасны premium landing layout — зөвхөн `pages/index.vue`-д ашиглагдана.
 *
 * Санаатайгаар `layouts/default.vue`-ээс тусгаарлав: нүүр хуудас маркетингийн
 * зорилготой (цагаан, glass, том типографи), бусад хуудас (`/track`, `/my/*`)
 * бол өдөр тутмын ажлын дэлгэц тул `default.vue`-ийн нягт дизайныг хэвээр үлдээв.
 */
const customer = useCustomerStore()
const menuOpen = ref(false)

const navLinks = [
  { label: 'Тариф', to: '/#pricing' },
  { label: 'Хэрхэн ажилладаг вэ', to: '/#how-it-works' },
  { label: 'Түгээмэл асуулт', to: '/#faq' },
  { label: 'Хүлээн авах хаяг', to: '/address' },
]
</script>

<template>
  <div class="relative min-h-screen overflow-x-clip bg-white text-slate-900">
    <!-- Далд, өнгөлөг цацраг (глобал арын дэвсгэр) -->
    <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-white">
      <div
        class="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-primary-100/70 blur-[120px]"
      />
      <div
        class="absolute top-[45%] -right-40 h-[420px] w-[420px] rounded-full bg-primary-100/60 blur-[110px]"
      />
      <div
        class="absolute bottom-[-10%] -left-32 h-[480px] w-[480px] rounded-full bg-indigo-100/50 blur-[120px]"
      />
      <div
        class="absolute inset-0 opacity-[0.045]"
        style="
          background-image: linear-gradient(#0f172a 1px, transparent 1px),
            linear-gradient(90deg, #0f172a 1px, transparent 1px);
          background-size: 64px 64px;
        "
      />
    </div>

    <header class="sticky top-0 z-40 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
      <div class="mx-auto flex h-[72px] max-w-7xl items-center gap-3 px-5 sm:px-8">
        <NuxtLink to="/" class="flex shrink-0 items-center">
          <img
            src="/logo-full.png"
            alt="ИВЭЭЛТ КАРГО"
            class="h-9 w-[172px] object-contain object-left"
            width="172"
            height="36"
          />
        </NuxtLink>

        <nav class="ml-8 hidden items-center gap-1 lg:flex">
          <a
            v-for="item in navLinks"
            :key="item.to"
            :href="item.to"
            class="rounded-full px-3.5 py-2 text-body-sm font-medium text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900"
          >
            {{ item.label }}
          </a>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <template v-if="customer.isAuthenticated">
            <UiBtn size="sm" to="/my" class="hidden sm:inline-flex">Хяналтын самбар</UiBtn>
          </template>
          <template v-else>
            <NuxtLink
              to="/login"
              class="hidden rounded-full px-4 py-2 text-body-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:inline-flex"
            >
              Нэвтрэх
            </NuxtLink>
            <UiBtn size="sm" to="/register" class="hidden sm:inline-flex">Бүртгүүлэх</UiBtn>
          </template>

          <button
            class="rounded-full p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            :aria-label="menuOpen ? 'Цэс хаах' : 'Цэс нээх'"
            @click="menuOpen = !menuOpen"
          >
            <X v-if="menuOpen" :size="20" />
            <Menu v-else :size="20" />
          </button>
        </div>
      </div>

      <div v-if="menuOpen" class="border-t border-slate-200/70 bg-white/95 lg:hidden">
        <nav class="mx-auto max-w-7xl space-y-1 px-5 py-4">
          <a
            v-for="item in navLinks"
            :key="item.to"
            :href="item.to"
            class="block rounded-xl px-3 py-2.5 text-body font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            @click="menuOpen = false"
          >
            {{ item.label }}
          </a>
          <div class="my-2 border-t border-slate-200" />
          <NuxtLink
            v-if="!customer.isAuthenticated"
            to="/login"
            class="block rounded-xl px-3 py-2.5 text-body font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            Нэвтрэх
          </NuxtLink>
          <NuxtLink
            :to="customer.isAuthenticated ? '/my' : '/register'"
            class="block rounded-xl px-3 py-2.5 text-body font-semibold text-primary-600 hover:bg-slate-100"
          >
            {{ customer.isAuthenticated ? 'Хяналтын самбар' : 'Бүртгүүлэх' }}
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main class="relative">
      <slot />
    </main>

    <footer class="relative border-t border-slate-200/70 px-5 py-12 sm:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div class="max-w-xs">
            <div class="flex items-center">
              <img
                src="/logo-full.png"
                alt="ИВЭЭЛТ КАРГО"
                class="h-8 w-[154px] object-contain object-left"
                width="154"
                height="32"
              />
            </div>
            <p class="mt-3 text-body-sm text-slate-500">
              Хятад — Монгол чиглэлийн ачаа тээврийг илүү хурдан, илүү ил тод болгож байна.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <p class="text-body-sm font-semibold text-slate-900">Үйлчилгээ</p>
              <ul class="mt-3 space-y-2 text-body-sm text-slate-500">
                <li><a href="/#pricing" class="hover:text-slate-900">Тариф</a></li>
                <li><NuxtLink to="/track" class="hover:text-slate-900">Ачаа хайх</NuxtLink></li>
                <li><NuxtLink to="/address" class="hover:text-slate-900">Хүлээн авах хаяг</NuxtLink></li>
              </ul>
            </div>
            <div>
              <p class="text-body-sm font-semibold text-slate-900">Компани</p>
              <ul class="mt-3 space-y-2 text-body-sm text-slate-500">
                <li><a href="/#faq" class="hover:text-slate-900">Түгээмэл асуулт</a></li>
                <li><NuxtLink to="/help" class="hover:text-slate-900">Тусламж</NuxtLink></li>
              </ul>
            </div>
            <div>
              <p class="text-body-sm font-semibold text-slate-900">Бүртгэл</p>
              <ul class="mt-3 space-y-2 text-body-sm text-slate-500">
                <li><NuxtLink to="/login" class="hover:text-slate-900">Нэвтрэх</NuxtLink></li>
                <li><NuxtLink to="/register" class="hover:text-slate-900">Бүртгүүлэх</NuxtLink></li>
              </ul>
            </div>
          </div>
        </div>

        <div
          class="mt-10 flex flex-col gap-2 border-t border-slate-200/70 pt-6 text-body-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>© {{ new Date().getFullYear() }} Ивээл Карго. Бүх эрх хуулиар хамгаалагдсан.</p>
        </div>
      </div>
    </footer>

    <UiToastHost />
  </div>
</template>
