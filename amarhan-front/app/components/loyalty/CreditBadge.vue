<script setup lang="ts">
import { formatCurrency } from '~/utils/currency'

/**
 * Кредитийн үлдэгдэл + ХАМГИЙН СҮҮЛИЙН өөрчлөлт — Faceit ELO-гийн хэв маяг:
 *
 *   4,500 кредит ⁺³⁵⁰
 *
 * Сүүлийн гүйлгээний дүн ард нь жижгээр, өнгөөр (нэмэгдсэн — ногоон,
 * хасагдсан — улаан) харагдана — харилцагч "яагаад өөрчлөгдсөн бэ"-г
 * түүх нээлгүйгээр мэдэрнэ (эзэмшигчийн хүсэлт, 2026-10-24).
 *
 * `inverse` — өнгөт градиент карт дээр (цагаан текст, цайвар delta).
 */
const props = withDefaults(
  defineProps<{
    credits: number
    delta?: number | null
    size?: 'sm' | 'md' | 'lg' | 'xl'
    unit?: boolean
    inverse?: boolean
  }>(),
  { delta: null, size: 'md', unit: true, inverse: false }
)

const SIZES = {
  sm: { value: 'text-body font-bold', unit: 'text-[11px]', delta: 'text-[10px]' },
  md: { value: 'text-body-lg font-bold', unit: 'text-body-sm', delta: 'text-[11px]' },
  lg: { value: 'text-h3 font-bold', unit: 'text-body', delta: 'text-body-sm' },
  xl: { value: 'text-[44px] leading-[48px] font-extrabold tracking-tight', unit: 'text-body-lg', delta: 'text-body-lg' },
} as const

const s = computed(() => SIZES[props.size])
const negative = computed(() => props.credits < 0)
const value = computed(() => formatCurrency(Math.abs(props.credits), { showSymbol: false }))
const deltaText = computed(() => {
  if (!props.delta) return ''
  const sign = props.delta > 0 ? '+' : '−'
  return `${sign}${formatCurrency(Math.abs(props.delta), { showSymbol: false })}`
})

const deltaClass = computed(() => {
  if (!props.delta) return ''
  if (props.inverse) return props.delta > 0 ? 'text-emerald-200' : 'text-rose-200'
  return props.delta > 0 ? 'text-success' : 'text-error'
})
</script>

<template>
  <span class="inline-flex items-start gap-1 tabular" :title="delta ? `Сүүлийн өөрчлөлт: ${deltaText}` : undefined">
    <span class="inline-flex items-baseline gap-1">
      <span :class="[s.value, inverse ? 'text-white' : 'text-content']">
        <template v-if="negative">−</template>{{ value }}
      </span>
      <span v-if="unit" :class="[s.unit, inverse ? 'text-white/75' : 'text-content-secondary']" class="font-medium">
        кредит
      </span>
    </span>
    <span v-if="delta" :class="[s.delta, deltaClass]" class="-mt-0.5 font-bold leading-none">
      {{ deltaText }}
    </span>
  </span>
</template>
