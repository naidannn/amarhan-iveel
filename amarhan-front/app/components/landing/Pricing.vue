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
  <section id="pricing" class="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
    <div class="mx-auto max-w-xl text-center">
      <h2 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Энгийн, ил тод тариф</h2>
      <p class="mt-4 text-body-lg text-slate-500">Жин, эзлэхүүнээс аль өндөр гарсныг тулгуурлан тооцно.</p>
    </div>

    <div class="mt-14 grid gap-5 sm:grid-cols-2 lg:mx-auto lg:max-w-3xl">
      <div class="rounded-[24px] border border-slate-200/80 bg-white p-8 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)]">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Weight :size="22" :stroke-width="1.8" />
        </div>
        <p class="mt-6 text-body-sm font-medium text-slate-500">1 килограммаас</p>
        <p class="mt-1.5 text-4xl font-bold tracking-tight text-slate-900">
          {{ formatPrice(tariff?.pricePerKgAbove) ?? 'Лавлана уу' }}
        </p>
        <p class="mt-2 text-body-sm text-slate-400">Ачааны бодит жингээр тооцно</p>
      </div>

      <div class="rounded-[24px] border border-slate-200/80 bg-white p-8 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)]">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Box :size="22" :stroke-width="1.8" />
        </div>
        <p class="mt-6 text-body-sm font-medium text-slate-500">1 шоо метрээс</p>
        <p class="mt-1.5 text-4xl font-bold tracking-tight text-slate-900">
          {{ formatPrice(tariff?.pricePerM3) ?? 'Лавлана уу' }}
        </p>
        <p class="mt-2 text-body-sm text-slate-400">Урт × өргөн × өндрөөр бодсон эзлэхүүн</p>
      </div>
    </div>

    <!-- Жижиг ачааны шатлал — 1кг хүрэхгүй бол тогтмол үнэ -->
    <div
      v-if="tariff?.weightBrackets?.length"
      class="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2 lg:mx-auto"
    >
      <span
        v-for="bracket in tariff.weightBrackets"
        :key="bracket.maxGrams"
        class="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-body-sm text-slate-600 shadow-sm"
      >
        {{ formatGrams(bracket.maxGrams) }} хүртэл — <span class="font-semibold text-slate-900">{{ formatPrice(bracket.price) }}</span>
      </span>
    </div>

    <div class="mx-auto mt-6 flex max-w-3xl items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 px-5 py-4 lg:mx-auto">
      <Scale :size="18" class="mt-0.5 shrink-0 text-primary-600" />
      <p class="text-body-sm leading-relaxed text-slate-600">
        Жин, эзлэхүүнээр тооцсон дүнгээс <span class="font-semibold text-slate-900">аль өндөр</span> гарсныг
        эцсийн үнэ болгоно. Ачааны төрлөөс хамааран жингийн шатлал өөр байж
        болно — бүртгэлийн үед ажилтан тодорхой дүнг харуулна.
      </p>
    </div>

    <div class="mt-6 text-center">
      <NuxtLink to="/help" class="inline-flex items-center gap-1.5 text-body-sm font-semibold text-primary-600 hover:text-primary-700">
        Тарифын дэлгэрэнгүйг лавлах
        <ArrowRight :size="15" />
      </NuxtLink>
    </div>
  </section>
</template>
