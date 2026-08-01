<script setup lang="ts">
import { Search } from 'lucide-vue-next'

/** §3 — ачаа хайх нээлттэй хуудас. Дугаар бичихэд `/track/[number]` руу шилжинэ. */
const query = ref('')

function search() {
  const value = query.value.trim()
  if (!value) return
  navigateTo(`/track/${encodeURIComponent(value)}`)
}

useHead({ title: 'Ачаа хайх — Ивээлт Карго' })
</script>

<template>
  <div class="mx-auto max-w-lg py-6 sm:py-12">
    <h1 class="text-h1 font-bold text-content">Ачаа хайх</h1>
    <p class="mt-2 text-body text-content-secondary">
      Ачааны дугаараа бичээд төлөвөө шалгана уу.
    </p>

    <form class="mt-6 flex gap-2" @submit.prevent="search">
      <UiTextInput
        v-model="query"
        placeholder="Ачааны дугаар"
        :icon="Search"
        autofocus
        class="flex-1"
        aria-label="Ачааны дугаар"
      />
      <UiBtn type="submit" :disabled="!query.trim()">Хайх</UiBtn>
    </form>
  </div>
</template>
