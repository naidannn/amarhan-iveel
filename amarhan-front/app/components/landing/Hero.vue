<script setup lang="ts">
import { ArrowRight, MessageCircle } from 'lucide-vue-next'

defineProps<{ notice?: string | null }>()
</script>

<template>
  <section class="relative mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 sm:pt-16 lg:pb-28 lg:pt-20">
    <!-- Зарлал -->
    <div
      v-if="notice"
      class="mx-auto mb-8 flex max-w-xl items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <MessageCircle :size="17" class="mt-0.5 shrink-0 text-amber-500" />
      <p class="text-body-sm text-amber-800">{{ notice }}</p>
    </div>

    <div class="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
      <div class="text-center lg:text-left">
        <div
          class="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-body-sm text-slate-500 shadow-sm"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-primary-500" />
          Хятад → Монгол
        </div>

        <h1 class="text-balance text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[56px]">
          Хятадаас Монгол руу ачаа,
          <span
            class="bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-500 bg-clip-text text-transparent"
          >
            хурдан бөгөөд ухаалгаар
          </span>
        </h1>

        <p class="mx-auto mt-6 max-w-lg text-body-lg leading-relaxed text-slate-500 lg:mx-0">
          Ачаагаа бүртгүүлээд, Монголд ирсэн даруйд мэдэгдэл авч, дугаар эсвэл
          утасны дугаараараа хэдийд ч хянана. Нэвтрэх шаардлагагүй.
        </p>

        <div class="mx-auto mt-9 max-w-xl lg:mx-0">
          <LandingSearchCard />
        </div>

        <div class="mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-center gap-3 lg:mx-0 lg:justify-start">
          <UiBtn to="/register" :icon-right="ArrowRight">Бүртгүүлэх</UiBtn>
          <a
            href="#mongolia-warehouse"
            class="inline-flex h-control items-center gap-2 rounded-btn border border-slate-200 bg-white px-4 text-body font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            Бидэнтэй холбогдох
          </a>
        </div>
      </div>

      <div class="hidden lg:block">
        <LandingRouteIllustration />
      </div>
    </div>
  </section>
</template>
