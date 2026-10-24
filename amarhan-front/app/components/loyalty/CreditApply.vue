<script setup lang="ts">
import { Coins, Minus, Plus, Sparkles, ArrowRight } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'
import { estimateEarn, formatRate } from '~/utils/loyalty'
import type { LoyaltyBalance } from '~/composables/useCustomerPortal'

/**
 * Төлбөрт кредит хэрэглэх хэсэг — BR-48 (`/my/pay`, `/my/deliveries/new`).
 *
 * UX-ийн шийдвэрүүд:
 *   - Кредит байвал ХАМГИЙН ИХ боломжит дүн АВТОМАТААР хэрэглэгдэнэ —
 *     хуримтлуулсан кредит "мартагдаж" үлдэхгүй (эзэмшигчийн хүсэлт). Харилцагч
 *     нэг товчоор унтраах эсвэл дүнг тааруулна.
 *   - 1 кредит = 1₮ гэдгийг үргэлж харуулна — "оноо" биш, мөнгө гэдгийг
 *     ойлгуулах нь ашиглалтыг нэмэгдүүлнэ.
 *   - Кредитгүй ч гэсэн хэсэг харагдана: "энэ төлбөрөөс +N кредит авна" —
 *     дараагийн удаа ашиглах хүсэл төрүүлнэ.
 *
 * Хязгаарыг (үлдэгдэл, `maxRedeemPercent`) энд зөвхөн UX-д тооцно — эцсийн
 * шалгалт backend-д (`payment.service.js#applyCredit`).
 */
const props = defineProps<{
  modelValue: number
  balance: LoyaltyBalance | null
  /** Кредит хэрэглэж болох дүн — сонгосон ачааны үлдэгдлийн нийлбэр (хураамж ОРОХГҮЙ) */
  payable: number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const credits = computed(() => Math.max(props.balance?.credits ?? 0, 0))
const enabled = computed(() => Boolean(props.balance?.enabled))
const max = computed(() => {
  const pct = props.balance?.maxRedeemPercent ?? 100
  return Math.max(0, Math.min(credits.value, Math.floor((props.payable * pct) / 100)))
})

const on = ref(true)

function set(value: number) {
  const clean = Math.round(Number.isFinite(value) ? value : 0)
  emit('update:modelValue', Math.min(Math.max(clean, 0), max.value))
}

// Сонголт өөрчлөгдөхөд (ачаа нэмэх/хасах) хязгаарт тааруулна; асаалттай бол
// боломжит дээд дүнг дахин санал болгоно
watch(
  max,
  value => {
    if (!on.value) return set(0)
    set(value)
  },
  { immediate: true }
)

function toggle() {
  on.value = !on.value
  set(on.value ? max.value : 0)
}

const STEP = 1000
const fullyCovered = computed(() => props.modelValue > 0 && props.modelValue >= props.payable)
const cashPart = computed(() => Math.max(props.payable - props.modelValue, 0))
const earnPreview = computed(() =>
  props.balance ? estimateEarn(cashPart.value, props.balance.tier.rateBps) : 0
)
const leftAfter = computed(() => credits.value - props.modelValue)
const sliderPercent = computed(() => (max.value ? (props.modelValue / max.value) * 100 : 0))
</script>

<template>
  <div v-if="balance && enabled" class="card space-y-3.5">
    <!-- Толгой: үлдэгдэл + асаах/унтраах -->
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-3">
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"
        >
          <Coins :size="20" :stroke-width="2" />
        </span>
        <div class="min-w-0">
          <p class="font-semibold text-content">Кредит ашиглах</p>
          <p class="text-body-sm text-content-secondary">
            Танд
            <LoyaltyCreditBadge
              size="sm"
              :credits="balance.credits"
              :delta="balance.lastTransaction?.amount ?? null"
            />
            байна · 1 кредит = 1₮
          </p>
        </div>
      </div>

      <button
        v-if="max > 0"
        type="button"
        role="switch"
        :aria-checked="on"
        aria-label="Кредит ашиглах"
        class="relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
        :class="on ? 'bg-amber-500' : 'bg-surface-border'"
        @click="toggle"
      >
        <span
          class="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
          :class="on ? 'translate-x-[22px]' : 'translate-x-0.5'"
        />
      </button>
    </div>

    <!-- Кредит байхгүй — дараагийн удаа ашиглах урам -->
    <div
      v-if="max === 0"
      class="flex items-start gap-2 rounded-btn bg-amber-50 px-3 py-2.5 text-body-sm text-amber-800"
    >
      <Sparkles :size="16" class="mt-0.5 shrink-0" />
      <span>
        <template v-if="credits === 0">Одоогоор кредит алга.</template>
        <template v-else>Сонгосон ачаанд кредит хэрэглэх боломжгүй.</template>
        Энэ төлбөрөөс
        <strong class="tabular">+{{ formatCurrency(earnPreview, { showSymbol: false }) }} кредит</strong>
        авч, дараагийн ачааны төлбөрт ашиглана.
        <NuxtLink to="/my/loyalty" class="font-medium underline">Дэлгэрэнгүй</NuxtLink>
      </span>
    </div>

    <!-- Дүн тааруулах -->
    <template v-else-if="on">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex h-control w-control shrink-0 items-center justify-center rounded-btn border border-surface-border text-content-secondary hover:bg-surface-hover disabled:opacity-40"
          :disabled="modelValue <= 0"
          aria-label="Багасгах"
          @click="set(modelValue - STEP)"
        >
          <Minus :size="16" />
        </button>
        <div class="relative min-w-0 flex-1">
          <input
            type="number"
            inputmode="numeric"
            min="0"
            :max="max"
            :value="modelValue"
            class="h-control w-full rounded-input border border-surface-border bg-surface-card px-3 pr-16 text-center text-body-lg font-bold tabular text-content focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            aria-label="Ашиглах кредит"
            @change="set(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-content-secondary">
            кредит
          </span>
        </div>
        <button
          type="button"
          class="flex h-control w-control shrink-0 items-center justify-center rounded-btn border border-surface-border text-content-secondary hover:bg-surface-hover disabled:opacity-40"
          :disabled="modelValue >= max"
          aria-label="Нэмэх"
          @click="set(modelValue + STEP)"
        >
          <Plus :size="16" />
        </button>
      </div>

      <input
        type="range"
        min="0"
        :max="max"
        step="100"
        :value="modelValue"
        class="credit-range w-full"
        :style="{ '--fill': `${sliderPercent}%` }"
        aria-label="Ашиглах кредитийн гулсуур"
        @input="set(Number(($event.target as HTMLInputElement).value))"
      />

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-body-sm font-medium transition-colors"
          :class="modelValue === max ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-surface-border text-content-secondary hover:bg-surface-hover'"
          @click="set(max)"
        >
          Бүгдийг · {{ formatCurrency(max, { showSymbol: false }) }}
        </button>
        <button
          v-if="max >= 200"
          type="button"
          class="rounded-full border border-surface-border px-3 py-1 text-body-sm font-medium text-content-secondary hover:bg-surface-hover"
          @click="set(Math.floor(max / 2))"
        >
          Хагас · {{ formatCurrency(Math.floor(max / 2), { showSymbol: false }) }}
        </button>
      </div>

      <div class="space-y-1 rounded-btn bg-surface-hover px-3 py-2.5 text-body-sm">
        <div class="flex justify-between gap-3">
          <span class="text-content-secondary">Кредитээр хасагдах</span>
          <span class="font-semibold tabular text-amber-700">−{{ formatCurrency(modelValue) }}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-content-secondary">Үлдэх кредит</span>
          <span class="tabular text-content">{{ formatCurrency(leftAfter, { showSymbol: false }) }} кредит</span>
        </div>
        <p v-if="fullyCovered" class="pt-1 font-medium text-success">
          Ачааны төлбөр кредитээр бүтэн төлөгдөнө 🎉
        </p>
      </div>
    </template>

    <p v-else class="text-body-sm text-content-secondary">
      Кредит ашиглахгүй — {{ formatCurrency(max, { showSymbol: false }) }} хүртэл кредит хэрэглэх
      боломжтой.
    </p>

    <!-- Энэ төлбөрөөс олгогдох кредит -->
    <div
      v-if="max > 0 && earnPreview > 0"
      class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-body-sm text-content-secondary"
    >
      <p class="min-w-0">
        <Sparkles :size="14" class="-mt-0.5 mr-1 inline text-amber-500" />
        Үлдсэн {{ formatCurrency(cashPart) }}-өөс
        <strong class="tabular text-success">+{{ formatCurrency(earnPreview, { showSymbol: false }) }} кредит</strong>
        ({{ formatRate(balance.tier.rateBps) }}) буцаан авна
      </p>
      <NuxtLink to="/my/loyalty" class="inline-flex shrink-0 items-center gap-0.5 font-medium text-primary-600 hover:underline">
        Урамшуулал <ArrowRight :size="13" />
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
/* Гулсуур — бөглөгдсөн хэсэг алтлаг, хоосон хэсэг гадаргын өнгө */
.credit-range {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 9999px;
  background: linear-gradient(
    to right,
    rgb(245 158 11) 0%,
    rgb(245 158 11) var(--fill),
    var(--color-surface-border) var(--fill),
    var(--color-surface-border) 100%
  );
}
.credit-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 20px;
  width: 20px;
  border-radius: 9999px;
  background: #fff;
  border: 2px solid rgb(245 158 11);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
  cursor: pointer;
}
.credit-range::-moz-range-thumb {
  height: 18px;
  width: 18px;
  border-radius: 9999px;
  background: #fff;
  border: 2px solid rgb(245 158 11);
  cursor: pointer;
}
</style>
