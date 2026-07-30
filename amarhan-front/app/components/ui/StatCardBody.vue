<script setup lang="ts">
import type { Component } from 'vue'

/**
 * `UiStatCard`-ийн ДОТООД агуулга.
 *
 * Тусад нь компонент болгосон шалтгаан: StatCard нь `to` prop-оос хамаарч
 * `<NuxtLink>` эсвэл `<div>` болж хоёр салаанд хуваагддаг (`<component :is>`
 * нь NuxtLink-ыг ажиллах үед шийдүүлэхийг шаардаж эвддэг — StatCard.vue-ийн
 * тайлбар харах). Агуулгыг хоёр удаа хуулбарлахгүйн тулд энд гаргав.
 */
withDefaults(
  defineProps<{
    label: string
    value: number | string
    icon?: Component
    accent?: string
    hint?: string
    loading?: boolean
  }>(),
  { accent: '#355DFF' }
)

/** Мөнгө биш энгийн тоог мянгатаар тусгаарлана */
function display(value: number | string) {
  return typeof value === 'number' ? value.toLocaleString('mn-MN') : value
}
</script>

<template>
  <div class="flex items-start justify-between gap-4">
    <div class="min-w-0">
      <p class="text-body text-content-secondary">{{ label }}</p>

      <p v-if="loading" class="mt-2 h-9 w-24 animate-pulse rounded bg-surface-hover" />
      <p v-else class="tabular mt-1 text-h2 text-content">{{ display(value) }}</p>

      <p v-if="hint" class="mt-1 text-body-sm text-content-secondary">{{ hint }}</p>
    </div>

    <div
      v-if="icon"
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn"
      :style="{ backgroundColor: `${accent}14`, color: accent }"
    >
      <component :is="icon" :size="22" :stroke-width="2" />
    </div>
  </div>
</template>
