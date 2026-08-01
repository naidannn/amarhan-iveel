<script setup lang="ts">
import { Search, ArrowRight } from 'lucide-vue-next'

/**
 * Нүүр хуудасны glass хайлтын карт — ачааны дугаараар тухайн ачааны
 * төлөвийн хуудас (`/track/[number]`) руу шилжинэ.
 */
const trackingQuery = ref('')

function searchTracking() {
  const value = trackingQuery.value.trim()
  if (!value) return
  navigateTo(`/track/${encodeURIComponent(value)}`)
}

</script>

<template>
  <div
    class="w-full rounded-[28px] border border-white/80 bg-white/95 p-3 shadow-[0_28px_70px_-24px_rgba(15,23,42,0.26)] ring-1 ring-slate-200/70 backdrop-blur-2xl sm:p-4"
  >
    <div class="px-1 pb-3 pt-1">
      <p class="text-lg font-bold tracking-tight text-slate-900">Ачаагаа хайх</p>
      <p class="mt-0.5 text-body-sm text-slate-500">Ачааны дугаараа оруулна уу</p>
    </div>
    <form class="flex flex-col gap-2 pt-3 sm:flex-row" @submit.prevent="searchTracking">
      <UiTextInput
        v-model="trackingQuery"
        placeholder="Жишээ: TRK20260731001"
        :icon="Search"
        class="flex-1"
        aria-label="Ачааны дугаар"
      />
      <UiBtn type="submit" size="md" :icon-right="ArrowRight" :disabled="!trackingQuery.trim()" class="sm:w-auto">
        Ачаа хайх
      </UiBtn>
    </form>

  </div>
</template>
