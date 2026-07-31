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
  <section class="mx-auto max-w-7xl px-5 py-16 sm:px-8">
    <div class="grid gap-5 rounded-[24px] border border-slate-200/80 bg-slate-50 p-8 sm:grid-cols-3 sm:p-10">
      <div v-for="item in pillars" :key="item.title" class="flex items-start gap-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
          <component :is="item.icon" :size="19" :stroke-width="1.8" />
        </div>
        <div class="min-w-0">
          <p class="font-semibold text-slate-900">{{ item.title }}</p>
          <p class="mt-1 text-body-sm leading-relaxed text-slate-500">{{ item.body }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
