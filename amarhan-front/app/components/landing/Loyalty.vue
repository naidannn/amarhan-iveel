<script setup lang="ts">
import { ArrowRight, Coins, Info } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'
import { estimateEarn, formatRate } from '~/utils/loyalty'
import type { PublicLoyalty } from '~/composables/useCustomerPortal'

/**
 * Урамшууллын хэсэг — introduction.md §4, BR-30…BR-33, BR-48.
 *
 * Түвшний нэр, босго, хувь бол Админы тохиргооноос ирнэ
 * (`public.service.js#loyalty`) — кодод хатуу бичихгүй. Хөтөлбөр унтраалттай
 * эсвэл backend хариу өгөөгүй үед `program` нь `null` бөгөөд хэсэг бүхэлдээ
 * нуугдана: байхгүй урамшууллыг амлахгүй.
 */
const props = defineProps<{ program: PublicLoyalty | null }>()

/** Карт бүрийн "жишээ" — бүх түвшинд ижил дүнгээр харьцуулна */
const EXAMPLE_AMOUNT = 100000

const { gradient } = useLoyaltyTier()

const windowLabel = computed(() => {
  const days = props.program?.windowDays ?? 365
  return days === 365 ? 'сүүлийн 12 сард' : `сүүлийн ${days} хоногт`
})

const redeemLabel = computed(() => {
  const pct = props.program?.maxRedeemPercent ?? 100
  return pct >= 100 ? 'бүтэн' : `${pct}% хүртэл`
})
</script>

<template>
  <section v-if="program?.tiers?.length" id="loyalty" class="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
    <div class="mx-auto max-w-2xl text-center">
      <p class="text-body-sm font-semibold text-primary-600">Урамшуулал</p>
      <h2 class="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Ачаа бүрээрээ кредит цуглуул</h2>
      <p class="mt-4 text-body-lg text-slate-500">
        Ачааны төлбөр бүрийн тодорхой хувь кредит болж буцна. Дараагийн ачааны төлбөрөө кредитээр
        {{ redeemLabel }} төлнө — <span class="font-semibold text-slate-700">1 кредит = 1₮</span>.
      </p>
    </div>

    <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <article
        v-for="tier in program.tiers"
        :key="tier.code"
        class="group relative overflow-hidden rounded-[24px] bg-white p-6 ring-1 ring-slate-200/80 shadow-[0_8px_26px_-16px_rgba(15,23,42,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_36px_-18px_rgba(15,23,42,0.26)]"
      >
        <!-- Түвшний өнгөт зурвас -->
        <span class="absolute inset-x-0 top-0 h-1.5" :style="{ background: gradient(tier.code, 90) }" />

        <div class="flex items-center gap-3">
          <LoyaltyTierEmblem :code="tier.code" :size="48" />
          <div>
            <h3 class="text-lg font-bold tracking-tight text-slate-900">{{ tier.name }}</h3>
            <p class="text-body-sm text-slate-500">
              <template v-if="tier.minSpent > 0">
                {{ windowLabel }} {{ formatCurrency(tier.minSpent) }}+
              </template>
              <template v-else>Бүртгүүлмэгц</template>
            </p>
          </div>
        </div>

        <p class="mt-6 text-4xl font-bold tracking-tight text-slate-900">{{ formatRate(tier.rateBps) }}</p>
        <p class="mt-1 text-body-sm text-slate-500">төлбөр бүрээс кредитээр буцна</p>

        <div class="mt-5 flex items-center gap-2 rounded-2xl bg-slate-50 px-3.5 py-2.5 text-body-sm text-slate-600">
          <Coins :size="16" class="shrink-0 text-amber-500" />
          <span>
            {{ formatCurrency(EXAMPLE_AMOUNT) }} төлбөрт
            <span class="font-semibold text-slate-900">
              +{{ formatCurrency(estimateEarn(EXAMPLE_AMOUNT, tier.rateBps), { showSymbol: false }) }} кредит
            </span>
          </span>
        </div>
      </article>
    </div>

    <div class="mt-6 flex flex-col gap-4 rounded-[24px] bg-primary-50 px-6 py-5 ring-1 ring-primary-100 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-start gap-3">
        <Info :size="18" class="mt-0.5 shrink-0 text-primary-600" />
        <p class="text-body-sm leading-relaxed text-slate-600">
          Кредит ачааны төлбөр <span class="font-semibold text-slate-900">бүрэн төлөгдсөний дараа</span> олгогдоно.
          Түвшин {{ windowLabel }} ачаандаа төлсөн дүнгээр автоматаар тогтоно — хүргэлтийн хураамж болон кредитээр төлсөн хэсэг тооцогдохгүй.
        </p>
      </div>
      <NuxtLink
        to="/register"
        class="inline-flex shrink-0 items-center gap-1.5 text-body-sm font-semibold text-primary-700 hover:text-primary-900"
      >
        Бүртгүүлээд эхлэх
        <ArrowRight :size="15" />
      </NuxtLink>
    </div>
  </section>
</template>
