<script setup lang="ts">
import { TrendingUp, Sparkles } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'
import { formatRate, packagesToGo } from '~/utils/loyalty'
import type { LoyaltyOverview } from '~/composables/useCustomerPortal'

/**
 * Дараагийн түвшин хүртэлх зам — §4 "дараагийн түвшин хүртэл хэд үлдсэн".
 *
 * Прогресс нь ОДООГИЙН шатнаас тоологдоно (backend `progressBps`) — Алт
 * түвшинд хүрсэн хүн Платинум руу 0%-иас эхэлнэ, 66% биш. Хэдэн ₮ дутуу +
 * "≈ N ачаа" + тэнд хүрвэл юу өөрчлөгдөх (хувь) — гурвуулаа нэг дор: юуны
 * төлөө хичээж байгаагаа харилцагч шууд ойлгоно.
 */
const props = withDefaults(
  defineProps<{
    data: Pick<
      LoyaltyOverview,
      'tier' | 'nextTier' | 'spent' | 'remainingToNext' | 'progressBps' | 'averagePackageValue' | 'windowDays'
    >
    compact?: boolean
  }>(),
  { compact: false }
)

const { style, gradient } = useLoyaltyTier()

const percent = computed(() => Math.min(100, Math.max(0, props.data.progressBps / 100)))
const toGo = computed(() => packagesToGo(props.data.remainingToNext, props.data.averagePackageValue))
const months = computed(() => Math.round(props.data.windowDays / 30))
</script>

<template>
  <div>
    <!-- Хамгийн дээд түвшин -->
    <div v-if="!data.nextTier" class="flex items-center gap-2 text-body text-content">
      <Sparkles :size="18" :style="{ color: style(data.tier.code).color }" />
      <span>
        Та хамгийн дээд <strong>{{ data.tier.name }}</strong> түвшинд байна — төлбөр бүрийн
        <strong>{{ formatRate(data.tier.rateBps) }}</strong> кредитээр буцна.
      </span>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p class="text-body text-content">
          <span class="font-semibold">{{ data.nextTier.name }}</span>
          <span class="text-content-secondary"> түвшин хүртэл </span>
          <strong class="tabular">{{ formatCurrency(data.remainingToNext) }}</strong>
          <span v-if="toGo" class="text-content-secondary"> · ≈ {{ toGo }} ачаа</span>
        </p>
        <p v-if="!compact" class="text-body-sm tabular text-content-secondary">
          {{ formatCurrency(data.spent) }} / {{ formatCurrency(data.nextTier.minSpent) }}
        </p>
      </div>

      <div
        class="relative mt-2.5 h-3 overflow-hidden rounded-full bg-surface-hover"
        role="progressbar"
        :aria-valuenow="Math.round(percent)"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`${data.nextTier.name} түвшин хүртэлх прогресс`"
      >
        <div
          class="h-full rounded-full transition-[width] duration-700 ease-out"
          :style="{ width: `${Math.max(percent, 2)}%`, background: gradient(data.nextTier.code, 90) }"
        />
      </div>

      <div v-if="!compact" class="mt-2 flex items-start gap-2 text-body-sm text-content-secondary">
        <TrendingUp :size="15" class="mt-0.5 shrink-0 text-success" />
        <span>
          {{ data.nextTier.name }} түвшинд хүрмэгц кредит
          <strong class="text-content">{{ formatRate(data.tier.rateBps) }}</strong>
          →
          <strong :style="{ color: style(data.nextTier.code).color }">{{ formatRate(data.nextTier.rateBps) }}</strong>
          болж өснө. Түвшин сүүлийн {{ months }} сарын төлбөрөөр тооцогдоно.
        </span>
      </div>
    </template>
  </div>
</template>
