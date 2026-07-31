<script setup lang="ts">
import { Send, Warehouse, Wallet, PackageCheck } from 'lucide-vue-next'

/**
 * ⚠ Алхам #2-ыг "замд явж байгаа" мэт бичихгүй — систем ЗАМЫН ТӨЛӨВ хадгалдаггүй
 * (CLAUDE.md §1, introduction.md §1.1). Ачаа Монголд ирж, агуулахад
 * бүртгэгдсэний дараа л системд харагдана.
 */
const steps = [
  {
    icon: Send,
    title: 'Хаягаараа захиалга илгээ',
    body: 'Хятадын онлайн дэлгүүрээс худалдан авахдаа манай Эрээн дэх хаягаар хүргүүлнэ.',
  },
  {
    icon: Warehouse,
    title: 'Монголд ирж бүртгэгдэнэ',
    body: 'Ачаа Улаанбаатар дахь агуулахад хүрч ирмэгц ажилтан бүртгэж, танд мэдэгдэнэ.',
  },
  {
    icon: Wallet,
    title: 'Төлбөрөө төлнө',
    body: 'Жин эсвэл эзлэхүүнээр тооцсон дүнг онлайнаар эсвэл салбар дээр төлнө.',
  },
  {
    icon: PackageCheck,
    title: 'Хүлээн авна',
    body: 'Хүргэлтээр эсвэл салбар дээрээс өөрөө ирж ачаагаа авна.',
  },
]
</script>

<template>
  <section id="how-it-works" class="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
    <div class="mx-auto max-w-xl text-center">
      <h2 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Хэрхэн ажилладаг вэ</h2>
      <p class="mt-4 text-body-lg text-slate-500">Дөрвөн энгийн алхам — эхнээс төгсгөл хүртэл.</p>
    </div>

    <div class="relative mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <div
        class="pointer-events-none absolute top-6 left-0 right-0 hidden h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent lg:block"
      />

      <div v-for="(step, i) in steps" :key="step.title" class="relative text-center">
        <div class="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          <component :is="step.icon" :size="21" class="text-primary-600" :stroke-width="1.8" />
          <span
            class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-[11px] font-bold text-white"
          >
            {{ i + 1 }}
          </span>
        </div>
        <h3 class="mt-5 font-semibold text-slate-900">{{ step.title }}</h3>
        <p class="mx-auto mt-2 max-w-[220px] text-body-sm leading-relaxed text-slate-500">{{ step.body }}</p>
      </div>
    </div>
  </section>
</template>
