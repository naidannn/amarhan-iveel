<script setup lang="ts">
import { Award, Medal, Crown, Gem, Lock } from 'lucide-vue-next'

/**
 * Түвшний медаль — §4. Түвшин бүр өөр дүрс + градиенттай: ахих тусам
 * "үнэ цэнэтэй" харагдана (Хүрэл → Мөнгө → Алт → Платинум).
 * `locked` — хүрээгүй түвшин (шатны жагсаалтад).
 */
const props = withDefaults(
  defineProps<{
    code: string
    size?: number
    locked?: boolean
  }>(),
  { size: 48, locked: false }
)

const ICONS: Record<string, any> = { bronze: Award, silver: Medal, gold: Crown, platinum: Gem }
const { gradient } = useLoyaltyTier()

const icon = computed(() => (props.locked ? Lock : (ICONS[props.code] ?? Award)))
const background = computed(() => (props.locked ? undefined : gradient(props.code)))
</script>

<template>
  <span
    class="relative inline-flex shrink-0 items-center justify-center rounded-full shadow-sm ring-2 ring-white/60"
    :class="locked ? 'bg-surface-hover text-content-disabled' : 'text-white'"
    :style="{ width: `${size}px`, height: `${size}px`, background }"
  >
    <component :is="icon" :size="Math.round(size * 0.5)" :stroke-width="2" />
    <!-- Гялбаа — медаль мэт харагдуулна -->
    <span
      v-if="!locked"
      class="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/35 to-transparent"
      style="clip-path: ellipse(70% 45% at 50% 0%)"
    />
  </span>
</template>
