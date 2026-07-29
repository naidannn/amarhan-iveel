<script setup lang="ts">
/**
 * Урт текст оролт — шалтгаан, тайлбар бичихэд.
 *
 * Шалтгаан бичих талбар нь системд ХАМГИЙН ЧУХАЛ оролтуудын нэг: үнэ override,
 * хүчингүй болгох, давхар бүртгэх бүх үйлдэлд шалтгаан заавал (BR-04, BR-11).
 * Тиймээс жижиг, санамсаргүй дарагдах товшилт болгохгүй, бүтэн талбар болгов.
 */
withDefaults(
  defineProps<{
    modelValue?: string | null
    placeholder?: string
    rows?: number
    disabled?: boolean
    invalid?: boolean
    maxlength?: number
    id?: string
  }>(),
  { rows: 3, maxlength: 500 }
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <textarea
    :id="id"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :rows="rows"
    :disabled="disabled"
    :maxlength="maxlength"
    :aria-invalid="invalid || undefined"
    class="w-full resize-y rounded-input border bg-surface-card px-3 py-2.5 text-body leading-relaxed text-content outline-none transition-colors duration-200 placeholder:text-content-disabled disabled:cursor-not-allowed disabled:bg-surface-hover"
    :class="
      invalid
        ? 'border-error focus:border-error focus:ring-2 focus:ring-error/20'
        : 'border-surface-border hover:border-primary-300 focus:border-primary focus:ring-2 focus:ring-primary-200'
    "
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
