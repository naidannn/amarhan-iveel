<script setup lang="ts">
/**
 * Оролтын талбарын хүрээ — шошго, заавал тэмдэг, алдаа, тусламж.
 *
 * Талбар бүр өөрөө шошго зурахгүй — энэ бүрхүүл нэгдсэн зай, өнгө, алдааны
 * байрлалыг хариуцна. Ингэснээр форм бүр ижил төрхтэй болно.
 */
defineProps<{
  label?: string
  required?: boolean
  error?: string | null
  hint?: string
  /** <label for> — оролтын id-тай тааруулна */
  for?: string
}>()
</script>

<template>
  <div>
    <label v-if="label" :for="$props.for" class="mb-1.5 block text-body font-medium text-content">
      {{ label }}
      <span v-if="required" class="text-error" aria-hidden="true">*</span>
    </label>

    <slot />

    <p v-if="error" class="mt-1.5 text-body-sm text-error">{{ error }}</p>
    <p v-else-if="hint" class="mt-1.5 text-body-sm text-content-secondary">{{ hint }}</p>
  </div>
</template>
