<script setup lang="ts">
import { Weight, Box, Scale, ArrowRight } from 'lucide-vue-next'

/**
 * Тарифын хэсэг — BR-01/BR-02 (`domain/pricing.js`): жин, эзлэхүүнээс аль
 * ӨНДӨР гарсанаар нь тооцно.
 *
 * ₮/кг, ₮/м³ дүн бол системийн идэвхтэй тарифаас ирнэ (`public.service.js#pricing`,
 * "энгийн" ачааны төрөл) — кодод хатуу бичихгүй. Тариф идэвхгүй/олдоогүй үед
 * `tariff` нь `null` байх бөгөөд card дүнгийн оронд "лавлана уу" гэсэн
 * шударга харагдацтай.
 */
const props = defineProps<{
  tariff: {
    pricePerKgAbove: number | null
    pricePerM3: number | null
    weightBrackets?: { maxGrams: number; price: number }[]
  } | null
}>()

function formatPrice(value: number | null | undefined) {
  return value == null ? null : `${value.toLocaleString('mn-MN')}₮`
}

function formatGrams(g: number) {
  return g < 1000 ? `${g}гр` : `${g / 1000}кг`
}
</script>

<template>
  <section id="pricing" class="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
    <div class="overflow-hidden rounded-[32px] bg-slate-950 px-6 py-9 shadow-[0_28px_70px_-28px_rgba(15,23,42,0.55)] sm:px-10 sm:py-12">
      <div class="grid items-end gap-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div>
          <p class="text-body-sm font-semibold text-primary-300">Тариф</p>
          <h2 class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Үнэ хэд вэ?</h2>
          <p class="mt-4 max-w-md text-body-lg leading-relaxed text-slate-300">Ачааны жин болон эзлэхүүнийг автоматаар тооцоод, аль өндөр дүнгээр нь төлбөр гарна.</p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-[24px] bg-white p-6 shadow-xl">
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Weight :size="22" :stroke-width="1.8" />
        </div>
            <p class="mt-5 text-body-sm font-medium text-slate-500">1 кг-ийн үнэ</p>
            <p class="mt-1 text-4xl font-bold tracking-tight text-slate-900">
          {{ formatPrice(tariff?.pricePerKgAbove) ?? 'Лавлана уу' }}
        </p>
            <p class="mt-2 text-body-sm text-slate-400">Ачааны бодит жингээр</p>
          </div>

          <div class="rounded-[24px] border border-white/15 bg-white/10 p-6 text-white backdrop-blur-sm">
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-primary-200">
          <Box :size="22" :stroke-width="1.8" />
        </div>
            <p class="mt-5 text-body-sm font-medium text-slate-300">1 м³-ийн үнэ</p>
            <p class="mt-1 text-4xl font-bold tracking-tight text-white">
          {{ formatPrice(tariff?.pricePerM3) ?? 'Лавлана уу' }}
        </p>
            <p class="mt-2 text-body-sm text-slate-400">Урт × өргөн × өндрөөр</p>
          </div>
        </div>
      </div>

      <!-- Жижиг ачааны шатлал — 1кг хүрэхгүй бол тогтмол үнэ -->
      <div v-if="tariff?.weightBrackets?.length" class="mt-6 flex flex-wrap gap-2">
      <span
        v-for="bracket in tariff.weightBrackets"
        :key="bracket.maxGrams"
        class="rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-body-sm text-slate-200"
      >
        {{ formatGrams(bracket.maxGrams) }} хүртэл — <span class="font-semibold text-white">{{ formatPrice(bracket.price) }}</span>
      </span>
      </div>

      <div class="mt-6 flex items-start gap-3 rounded-2xl border border-primary-400/25 bg-primary-400/10 px-5 py-4">
        <Scale :size="18" class="mt-0.5 shrink-0 text-primary-200" />
        <p class="text-body-sm leading-relaxed text-slate-200">
          Жин болон эзлэхүүний <span class="font-semibold text-white">аль өндөр дүнгээр</span> төлбөр автоматаар бодогдоно. Тодорхой дүнг ачаа бүртгэх үед харуулна.
        </p>
      </div>

      <div class="mt-5">
        <NuxtLink to="/help" class="inline-flex items-center gap-1.5 text-body-sm font-semibold text-primary-200 hover:text-white">
        Тарифын дэлгэрэнгүйг лавлах
        <ArrowRight :size="15" />
      </NuxtLink>
      </div>
    </div>
  </section>
</template>
