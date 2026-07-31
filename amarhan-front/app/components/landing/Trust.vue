<script setup lang="ts">
import { ShieldCheck, ScrollText, Headset } from 'lucide-vue-next'

/**
 * "Компанийн статистик" хэсгийн оронд чанарын мессеж — эзэмшигчийн шийдвэр.
 * Шалтгаан: жилийн туршлага, хүргэсэн ачааны тоо мэт баталгаажаагүй бодит
 * тоог кодод хатуу бичих нь бизнесийн шийдвэр (CLAUDE.md §6), одоогоор
 * баталгаажаагүй тул орхив.
 */
const pillars = [
  {
    icon: ShieldCheck,
    title: 'Найдвартай процесс',
    body: 'Ачаа бүрийн төлөв, төлбөрийн хөдөлгөөн audit лог-д бүртгэгдэж хадгалагдана.',
  },
  {
    icon: ScrollText,
    title: 'Ил тод тооцоо',
    body: 'Үнэ хэрхэн бодогдсоныг ажилтан бүртгэлийн үед тодорхой харуулна.',
  },
  {
    icon: Headset,
    title: 'Хурдан хариу үйлчилгээ',
    body: 'Ачаа, төлбөртэй холбоотой асуултад ажилтнууд шуурхай хариу өгнө.',
  },
]
</script>

<template>
  <section class="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
    <div class="grid gap-6 rounded-[28px] bg-slate-900 p-7 sm:grid-cols-3 sm:p-9">
      <div v-for="item in pillars" :key="item.title" class="flex items-start gap-4">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-primary-200 ring-1 ring-white/10">
          <component :is="item.icon" :size="19" :stroke-width="1.8" />
        </div>
        <div class="min-w-0">
          <p class="font-semibold text-white">{{ item.title }}</p>
          <p class="mt-1 text-body-sm leading-relaxed text-slate-300">{{ item.body }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
