<script setup lang="ts">
/**
 * Хуудсын толгой — гарчиг, тайлбар, баруун талд үйлдлүүд.
 * Бүх админ хуудсанд ижил бүтэцтэй байлгах зорилготой.
 */
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      <h1 class="text-h3 text-content">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-body text-content-secondary">
        {{ subtitle }}
      </p>
    </div>

    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
