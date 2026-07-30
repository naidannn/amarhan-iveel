<script setup lang="ts">
import type { Component } from 'vue'
import { Loader2 } from 'lucide-vue-next'

/**
 * Товч — Design System v1
 *
 * Өндөр 40px · radius 12px · 200ms шилжилт.
 * Улаан (`danger`) нь ЗӨВХӨН устгах/сэрэмжлүүлэх үйлдэлд.
 */
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
    size?: 'sm' | 'md'
    type?: 'button' | 'submit' | 'reset'
    icon?: Component
    iconRight?: Component
    loading?: boolean
    disabled?: boolean
    block?: boolean
    to?: string
  }>(),
  { variant: 'primary', size: 'md', type: 'button' }
)

const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-600 active:bg-primary-700 shadow-sm',
  secondary:
    'bg-surface-card text-content border border-surface-border hover:bg-surface-hover active:bg-surface-border',
  danger: 'bg-error text-white hover:brightness-95 active:brightness-90 shadow-sm',
  success: 'bg-success text-white hover:brightness-95 active:brightness-90 shadow-sm',
  ghost: 'bg-transparent text-content-secondary hover:bg-surface-hover hover:text-content',
} as const

const SIZES = {
  sm: 'h-8 px-3 text-body-sm gap-1.5',
  md: 'h-control px-4 text-body gap-2',
} as const

const isDisabled = computed(() => props.disabled || props.loading)
const iconSize = computed(() => (props.size === 'sm' ? 15 : 17))
</script>

<!--
  ЯАГААД `<component :is>` БИШ, харин хоёр тодорхой салаа:

  `:is="... ? NuxtLink : 'button'"` гэж бичих нь NuxtLink-ыг АЖИЛЛАХ ҮЕД
  шийдүүлэхийг шаарддаг. `resolveComponent('NuxtLink')` нь `<script setup>`-ийн
  scope-д байхгүй, `#components`-ээс импортлосон хувилбар нь SSR-д зөв шийдэгдэхгүй
  — хоёр тохиолдолд ч "Failed to resolve component: NuxtLink" гарч, `to` prop-той
  товч бүр эвдэрдэг (сайдбарын навигаци, жагсаалтын товчнууд).

  `<NuxtLink>`-ыг ТАГААР бичихэд Vue-ийн компилятор нь BUILD үед шийддэг —
  ажиллах үеийн шийдэлт байхгүй, тиймээс эвдэх зүйл ч байхгүй.

  Дотоод агуулга нь хоёр салаанд давтагдахгүйн тулд `#inner` slot-д байна.
-->
<template>
  <NuxtLink
    v-if="to && !isDisabled"
    :to="to"
    :aria-busy="loading || undefined"
    class="inline-flex items-center justify-center rounded-btn font-semibold transition-all duration-200 ease-out"
    :class="[VARIANTS[variant], SIZES[size], block && 'w-full']"
  >
    <Loader2 v-if="loading" :size="iconSize" :stroke-width="2.4" class="animate-spin" />
    <component v-else-if="icon" :is="icon" :size="iconSize" :stroke-width="2.2" />
    <slot />
    <component v-if="iconRight && !loading" :is="iconRight" :size="iconSize" :stroke-width="2.2" />
  </NuxtLink>

  <button
    v-else
    :type="type"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
    class="inline-flex items-center justify-center rounded-btn font-semibold transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
    :class="[VARIANTS[variant], SIZES[size], block && 'w-full']"
  >
    <Loader2 v-if="loading" :size="iconSize" :stroke-width="2.4" class="animate-spin" />
    <component v-else-if="icon" :is="icon" :size="iconSize" :stroke-width="2.2" />
    <slot />
    <component v-if="iconRight && !loading" :is="iconRight" :size="iconSize" :stroke-width="2.2" />
  </button>
</template>
