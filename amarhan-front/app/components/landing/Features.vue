<script setup lang="ts">
import { Zap, Eye, ShieldCheck, Wallet } from 'lucide-vue-next'

const features = [
  {
    icon: Zap,
    title: 'Хурдан хүргэлт',
    body: 'Хятадаас Монгол хүртэл 3–5 хоногийн дотор ачаагаа хүлээн авна.',
  },
  {
    icon: Eye,
    title: 'Ил тод хяналт',
    body: 'Ачаа Монголд ирж бүртгэгдсэн мөчөөс эхлэн төлөвийг бодит цагт харна.',
  },
  {
    icon: ShieldCheck,
    title: 'Аюулгүй тээвэрлэлт',
    body: 'Ачаа бүр хамгаалалттай агуулахад хадгалагдаж, аудит бүртгэлтэйгээр шилждэг.',
  },
  {
    icon: Wallet,
    title: 'Уян хатан төлбөр',
    body: 'Жингийн болон эзлэхүүний тарифаас аль өндөр гарсанаар нь тодорхой тооцно.',
  },
]
</script>

<template>
  <section class="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
    <div class="mx-auto max-w-xl text-center">
      <h2 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Яагаад биднийг сонгох вэ</h2>
      <p class="mt-4 text-body-lg text-slate-500">
        Карго тээврийг хялбар, ил тод, найдвартай болгохын төлөө бүтээсэн.
      </p>
    </div>

    <div class="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="item in features"
        :key="item.title"
        class="group rounded-[20px] border border-slate-200/80 bg-white p-6 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-12px_rgba(15,23,42,0.14)]"
      >
        <div
          class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600 transition-transform duration-300 group-hover:scale-110"
        >
          <component :is="item.icon" :size="21" :stroke-width="1.8" />
        </div>
        <h3 class="mt-5 font-semibold text-slate-900">{{ item.title }}</h3>
        <p class="mt-2 text-body-sm leading-relaxed text-slate-500">{{ item.body }}</p>
      </div>
    </div>
  </section>
</template>
