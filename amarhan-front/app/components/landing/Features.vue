<script setup lang="ts">
import { BellRing, CreditCard, PackageSearch, Warehouse } from 'lucide-vue-next'

const features = [
  {
    icon: PackageSearch,
    title: 'Ачааны дугаараар төлвөө шалгана',
    body: 'Монголд бүртгэгдсэн ачааг дугаар эсвэл утасны дугаараар хайна.',
    accent: 'bg-white text-slate-900 ring-1 ring-slate-200/80',
    iconStyle: 'bg-primary-50 text-primary-600',
  },
  {
    icon: BellRing,
    title: 'Ирсэн даруйд мэдэгдэл авна',
    body: 'Улаанбаатар агуулахад бүртгэгдмэгц ачааны төлөв танд харагдана.',
    accent: 'bg-white text-slate-900 ring-1 ring-slate-200/80',
    iconStyle: 'bg-amber-50 text-amber-600',
  },
  {
    icon: Warehouse,
    title: 'Улаанбаатар агуулахаас авна',
    body: 'Өөрөө ирж авах эсвэл хүргэлт захиалах боломжтой.',
    accent: 'bg-white text-slate-900 ring-1 ring-slate-200/80',
    iconStyle: 'bg-primary-50 text-primary-600',
  },
  {
    icon: CreditCard,
    title: 'Төлбөрийн сонголттой',
    body: 'QPay, банкаар шилжүүлэх эсвэл бэлэн мөнгөөр төлнө.',
    accent: 'bg-primary-50 text-slate-900 ring-1 ring-primary-100',
    iconStyle: 'bg-primary-100 text-primary-700',
  },
]
</script>

<template>
  <section class="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
    <div class="mx-auto max-w-2xl text-center">
      <p class="text-body-sm font-semibold text-primary-600">Үйлчилгээ</p>
      <h2 class="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Ивээл Карго ямар үйлчилгээ үзүүлдэг вэ</h2>
      <p class="mt-4 text-body-lg text-slate-500">
        Ачаагаа хүлээн авах хүртэл хэрэгтэй мэдээллийг товч, ойлгомжтой харуулна.
      </p>
    </div>

    <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="item in features"
        :key="item.title"
        class="group min-h-[218px] rounded-[24px] p-6 shadow-[0_8px_26px_-16px_rgba(15,23,42,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_36px_-18px_rgba(15,23,42,0.26)]"
        :class="item.accent"
      >
        <div
          class="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
          :class="item.iconStyle"
        >
          <component :is="item.icon" :size="23" :stroke-width="1.8" />
        </div>
        <h3 class="mt-7 text-lg font-bold tracking-tight">{{ item.title }}</h3>
        <p class="mt-2 text-body-sm leading-relaxed" :class="item.accent.includes('text-white') ? 'text-slate-200' : 'text-slate-500'">{{ item.body }}</p>
      </div>
    </div>
  </section>
</template>
