<script setup lang="ts">
import type { Component } from 'vue'

/**
 * Текст оролт — Design System v1
 * Өндөр 40px · radius 10px · фокуст брэндийн цагираг.
 */
const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null
    type?: 'text' | 'number' | 'tel' | 'email' | 'password' | 'search' | 'date'
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    invalid?: boolean
    icon?: Component
    /** Баруун талд харагдах тогтмол текст — жишээ: "кг", "₮" */
    suffix?: string
    /** Тоог зэрэгцүүлэх (мөнгө, жин, дугаар) */
    tabular?: boolean
    id?: string
    autofocus?: boolean
  }>(),
  { type: 'text' }
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  enter: []
}>()

const el = ref<HTMLInputElement | null>(null)

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  if (props.type === 'number') {
    emit('update:modelValue', target.value === '' ? null : Number(target.value))
    return
  }
  emit('update:modelValue', target.value)
}

/** Ачаа бүртгэх дэлгэцэд дараагийн талбар руу фокус шилжүүлэхэд хэрэгтэй (§1.4) */
defineExpose({
  focus: () => el.value?.focus(),
  select: () => el.value?.select(),
})
</script>

<template>
  <div class="relative">
    <component
      v-if="icon"
      :is="icon"
      :size="17"
      :stroke-width="2"
      class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-disabled"
    />

    <input
      ref="el"
      :id="id"
      :type="type"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :autofocus="autofocus"
      :aria-invalid="invalid || undefined"
      class="h-control w-full rounded-input border bg-surface-card text-body text-content transition-colors duration-200 placeholder:text-content-disabled disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-content-disabled"
      :class="[
        icon ? 'pl-10' : 'pl-3',
        suffix ? 'pr-12' : 'pr-3',
        invalid
          ? 'border-error focus:border-error focus:ring-2 focus:ring-error/20'
          : 'border-surface-border hover:border-primary-300 focus:border-primary focus:ring-2 focus:ring-primary-200',
        tabular && 'tabular',
        'outline-none',
      ]"
      @input="onInput"
      @keyup.enter="emit('enter')"
    />

    <span
      v-if="suffix"
      class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body text-content-secondary"
    >
      {{ suffix }}
    </span>
  </div>
</template>
