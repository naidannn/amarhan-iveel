<script setup lang="ts">
import { Box, House, MapPin, Truck, Warehouse } from 'lucide-vue-next'

/**
 * Hero дахь чиглэлийн зураглал. Бодит GPS map биш: систем ачааг Монголд
 * бүртгэсний дараа л төлөв харуулдаг тул Хятад–Монгол тээврийн урсгалыг
 * ойлгомжтой, гэхдээ бодит цагийн байршил мэт бус байдлаар үзүүлнэ.
 */
const stops = [
  { icon: Warehouse, place: 'Эрээн агуулах', country: 'Хятад', side: 'left', tone: 'blue' },
  { icon: MapPin, place: 'Хил', country: 'Шалган нэвтрүүлэх', side: 'right', tone: 'amber' },
  { icon: Warehouse, place: 'УБ агуулах', country: 'Монгол', side: 'left', tone: 'blue' },
  { icon: House, place: 'Хүлээн авах', country: 'Хүргэлт / салбар', side: 'right', tone: 'slate' },
]
</script>

<template>
  <div class="relative mx-auto max-w-[460px] overflow-hidden rounded-[32px] border border-white/80 bg-slate-950 p-6 shadow-[0_30px_80px_-28px_rgba(15,23,42,0.5)]">
    <div class="absolute inset-0 opacity-50" style="background-image: radial-gradient(circle at 15% 15%, rgba(96,165,250,.55), transparent 30%), radial-gradient(circle at 85% 75%, rgba(99,102,241,.4), transparent 28%), linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px); background-size: auto, auto, 36px 36px, 36px 36px;" />

    <div class="relative flex items-center justify-between">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-200">Тээврийн чиглэл</p>
        <p class="mt-1 text-lg font-bold text-white">Хятад → Монгол</p>
      </div>
      <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-primary-200 ring-1 ring-white/15">
        <Box :size="20" :stroke-width="1.8" />
      </div>
    </div>

    <div class="relative mt-7">
      <div class="absolute bottom-8 left-1/2 top-8 w-px -translate-x-1/2 bg-gradient-to-b from-primary-300 via-primary-400 to-slate-500" />
      <div class="route-truck absolute left-1/2 top-8 z-10 -translate-x-1/2">
        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-400 text-slate-950 shadow-[0_0_0_6px_rgba(15,23,42,.8),0_8px_22px_rgba(96,165,250,.6)]">
          <Truck :size="18" :stroke-width="2.4" />
        </div>
      </div>

      <div v-for="(stop, index) in stops" :key="stop.place" class="relative grid min-h-[76px] grid-cols-[1fr_42px_1fr] items-center">
        <div :class="stop.side === 'left' ? 'col-start-1 pr-5 text-right' : 'col-start-3 pl-5'">
          <p class="text-body-sm font-semibold text-white">{{ stop.place }}</p>
          <p class="mt-0.5 text-[12px] text-slate-400">{{ stop.country }}</p>
        </div>
        <div class="col-start-2 row-start-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-slate-900 text-white shadow-lg" :class="{ 'text-primary-300': stop.tone === 'blue', 'text-amber-300': stop.tone === 'amber' }">
          <component :is="stop.icon" :size="18" :stroke-width="1.9" />
        </div>
      </div>
    </div>

    <div class="relative mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-body-sm text-slate-300">
      <span class="h-2 w-2 animate-pulse rounded-full bg-primary-300" />
      Өдөр бүр тээвэр гарна
    </div>
  </div>
</template>

<style scoped>
.route-truck {
  animation: route-travel 7s ease-in-out infinite;
}

@keyframes route-travel {
  0%, 8% { top: 2rem; }
  35%, 45% { top: 8.7rem; }
  68%, 78% { top: 14.1rem; }
  100% { top: 19rem; }
}

@media (prefers-reduced-motion: reduce) {
  .route-truck { animation: none; }
}
</style>
