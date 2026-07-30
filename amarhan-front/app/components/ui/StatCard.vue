<script setup lang="ts">
import type { Component } from 'vue'

/**
 * Тоон үзүүлэлтийн карт — dashboard-ийн үндсэн бүтэц.
 *
 *   ┌───────────────────┐
 *   │ 🚛  125           │
 *   │ Хүргэлтэнд гарсан │
 *   └───────────────────┘
 *
 * Агуулга нь `UiStatCardBody`-д — доорх template-ийн тайлбар харах.
 */
withDefaults(
  defineProps<{
    label: string
    value: number | string
    icon?: Component
    /** Iconны өнгө — өгөөгүй бол брэндийн цэнхэр */
    accent?: string
    hint?: string
    loading?: boolean
    to?: string
  }>(),
  { accent: '#355DFF' }
)
</script>

<!--
  `resolveComponent('NuxtLink')`-ыг template-ээс дуудахгүй — `<script setup>`-ийн
  scope-д байхгүй тул "Failed to resolve component" гарч, `to` prop-той карт
  эвдэрдэг. `<NuxtLink>`-ыг тагаар бичихэд компилятор build үед шийднэ
  (Btn.vue-ийн ижил тайлбар харах).
-->
<template>
  <NuxtLink
    v-if="to"
    :to="to"
    class="card block transition-all duration-200 ease-out hover:shadow-raised"
  >
    <UiStatCardBody
      :label="label"
      :value="value"
      :hint="hint"
      :icon="icon"
      :accent="accent"
      :loading="loading"
    />
  </NuxtLink>

  <div v-else class="card block">
    <UiStatCardBody
      :label="label"
      :value="value"
      :hint="hint"
      :icon="icon"
      :accent="accent"
      :loading="loading"
    />
  </div>
</template>
