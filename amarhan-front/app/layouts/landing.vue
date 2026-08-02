<script setup lang="ts">
import { Facebook, Mail, MapPin, MessageCircle, Send } from 'lucide-vue-next'

/**
 * Нүүр хуудасны premium landing layout — зөвхөн `pages/index.vue`-д ашиглагдана.
 *
 * Санаатайгаар `layouts/default.vue`-ээс тусгаарлав: нүүр хуудас маркетингийн
 * зорилготой (цагаан, glass, том типографи), бусад хуудас (`/track`, `/my/*`)
 * бол өдөр тутмын ажлын дэлгэц тул `default.vue`-ийн нягт дизайныг хэвээр үлдээв.
 */
const { content } = usePublicContent()

// Footer дээрх холбоо барих сувгууд нь админ тохиргооноос ирнэ. Өгөгдөл хоосон
// үед хоосон social link гаргахгүй, харин тусламжийн хуудсаар чиглүүлнэ.
const { data: footerSite } = await useAsyncData('landing-footer-content', () => content(), {
  default: () => null,
})
const footerContact = computed(() => footerSite.value?.contact ?? null)
const yuanTransfer = computed(() => footerSite.value?.yuan_transfer ?? null)
const socialLinks = computed(() =>
  [
    { label: 'Facebook', value: footerContact.value?.facebook, icon: Facebook },
    { label: 'Messenger', value: footerContact.value?.messenger, icon: MessageCircle },
    { label: 'WeChat', value: footerContact.value?.wechat, icon: Send },
  ]
    .filter(link => link.value)
    .map(link => ({
      ...link,
      href: /^(https?:\/\/|weixin:\/\/)/.test(link.value.trim()) ? link.value.trim() : undefined,
    }))
)

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

    <PublicHeader :yuan-transfer="yuanTransfer" />

    <main class="relative">
      <slot />
    </main>

    <footer class="relative mt-4 border-t border-slate-200/70 px-5 py-12 sm:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="grid gap-10 lg:grid-cols-[1fr_1.25fr]">
          <div class="max-w-xs">
            <div class="flex items-center">
              <LandingBrandLogo compact aria-label="ИВЭЭЛТ КАРГО" />
            </div>
            <p class="mt-3 text-body-sm text-slate-500">
              Хятад — Монгол чиглэлийн ачаа тээврийг ойлгомжтой, хялбар болгож байна.
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

        <div class="mt-10 grid gap-3 border-y border-slate-200/70 py-6 sm:grid-cols-2 lg:grid-cols-3">
          <component
            v-for="link in socialLinks"
            :key="link.label"
            :is="link.href ? 'a' : 'div'"
            :href="link.href"
            :target="link.href ? '_blank' : undefined"
            :rel="link.href ? 'noopener noreferrer' : undefined"
            class="group flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-slate-100"
          >
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-transform group-hover:scale-105">
              <component :is="link.icon" :size="18" :stroke-width="1.8" />
            </span>
            <span>
              <span class="block text-body-sm font-semibold text-slate-900">{{ link.label }}</span>
              <span class="block text-[12px] text-slate-500">{{ link.href ? 'Бидэнтэй холбогдох' : link.value }}</span>
            </span>
          </component>

          <a
            v-if="footerContact?.email"
            :href="`mailto:${footerContact.email}`"
            class="group flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-slate-100"
          >
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-transform group-hover:scale-105"><Mail :size="18" :stroke-width="1.8" /></span>
            <span class="min-w-0"><span class="block text-body-sm font-semibold text-slate-900">Имэйл</span><span class="block truncate text-[12px] text-slate-500">{{ footerContact.email }}</span></span>
          </a>

          <a
            v-if="footerContact?.address"
            :href="footerContact.googleMapsUrl || '/help'"
            :target="footerContact.googleMapsUrl ? '_blank' : undefined"
            :rel="footerContact.googleMapsUrl ? 'noopener noreferrer' : undefined"
            class="group flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-slate-100"
          >
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-transform group-hover:scale-105"><MapPin :size="18" :stroke-width="1.8" /></span>
            <span class="min-w-0"><span class="block text-body-sm font-semibold text-slate-900">Агуулахын хаяг</span><span class="block truncate text-[12px] text-slate-500">{{ footerContact.address }}</span></span>
          </a>
        </div>

        <div
          class="mt-6 flex flex-col gap-2 text-body-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>© {{ new Date().getFullYear() }} Ивээлт Карго. Бүх эрх хуулиар хамгаалагдсан.</p>
        </div>

        <div class="mt-6 border-t border-slate-200/70 pt-4 text-center">
          <DeveloperCredit />
        </div>
      </div>
    </footer>

    <UiToastHost />
  </div>
</template>
