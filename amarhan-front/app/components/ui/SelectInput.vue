<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'

/**
 * Сонголтын талбар.
 *
 * Төрөлх `<select>`-ийг ашиглаж байгаа шалтгаан: гар утсан дээр үйлдлийн
 * системийн уугуул сонголтын дэлгэц гарч ирдэг — өөрсдөө хийсэн dropdown-оос
 * хурдан, хүртээмжтэй (accessibility) бөгөөд гарын навигац шууд ажиллана.
 * Хайлттай сонголт хэрэгтэй болвол тусад нь Combobox компонент нэмнэ.
 */
export interface SelectOption {
  value: string | number | null
  label: string
  disabled?: boolean
}

withDefaults(
  defineProps<{
    modelValue?: string | number | null
    options: SelectOption[]
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    id?: string
  }>(),
  { placeholder: 'Сонгоно уу' }
)

const emit = defineEmits<{ 'update:modelValue': [value: string | number | null] }>()

function onChange(event: Event) {
  const raw = (event.target as HTMLSelectElement).value
  emit('update:modelValue', raw === '' ? null : raw)
}
</script>

<template>
  <div class="relative">
    <select
      :id="id"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      class="h-control w-full appearance-none rounded-input border bg-surface-card pl-3 pr-10 text-body text-content outline-none transition-colors duration-200 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-content-disabled"
      :class="[
        invalid
          ? 'border-error focus:border-error focus:ring-2 focus:ring-error/20'
          : 'border-surface-border hover:border-primary-300 focus:border-primary focus:ring-2 focus:ring-primary-200',
        modelValue == null || modelValue === '' ? 'text-content-disabled' : '',
      ]"
      @change="onChange"
    >
      <option value="" disabled>{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="String(option.value)"
        :value="option.value ?? ''"
        :disabled="option.disabled"
        class="text-content"
      >
        {{ option.label }}
      </option>
    </select>

    <ChevronDown
      :size="17"
      :stroke-width="2"
      class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-content-secondary"
    />
  </div>
</template>
