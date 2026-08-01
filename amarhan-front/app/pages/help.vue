<script setup lang="ts">
import { Phone, Mail, MapPin, Clock, ChevronDown, Globe, Map } from 'lucide-vue-next'

/**
 * Тусламж — түгээмэл асуулт ба холбоо барих (roadmap 5.10).
 * Агуулгыг Админ вэбээс засварлана, кодод хатуу бичихгүй.
 */
const { content } = usePublicContent()

const { data: site } = await useAsyncData('public-content-help', () => content(), {
  default: () => null,
})

const faq = computed<{ question: string; answer: string }[]>(() => site.value?.faq ?? [])
const contact = computed(() => site.value?.contact ?? null)

const contactRows = computed(() =>
  [
    { icon: Phone, label: 'Утас', value: contact.value?.phone },
    { icon: Mail, label: 'Имэйл', value: contact.value?.email },
    { icon: MapPin, label: 'Хаяг', value: contact.value?.address },
    { icon: Clock, label: 'Ажиллах цаг', value: contact.value?.workingHours },
    { icon: Globe, label: 'Вэб хуудас', value: contact.value?.website },
    { icon: Map, label: 'Google Maps', value: contact.value?.googleMapsUrl },
  ].filter(row => row.value)
)

const open = ref<number | null>(null)

useHead({ title: 'Тусламж — Ивээлт Карго' })
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <h1 class="text-h1 font-bold text-content">Тусламж</h1>

    <!-- Түгээмэл асуулт -->
    <section v-if="faq.length">
      <h2 class="font-semibold text-content">Түгээмэл асуулт</h2>
      <div class="mt-3 divide-y divide-surface-border rounded-card border border-surface-border bg-surface-card">
        <div v-for="(item, index) in faq" :key="index">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors duration-200 hover:bg-surface-hover"
            :aria-expanded="open === index"
            @click="open = open === index ? null : index"
          >
            <span class="text-body font-medium text-content">{{ item.question }}</span>
            <ChevronDown
              :size="18"
              class="shrink-0 text-content-secondary transition-transform duration-200"
              :class="open === index && 'rotate-180'"
            />
          </button>
          <p
            v-if="open === index"
            class="whitespace-pre-line px-5 pb-4 text-body leading-relaxed text-content-secondary"
          >
            {{ item.answer }}
          </p>
        </div>
      </div>
    </section>

    <!-- Холбоо барих -->
    <section v-if="contactRows.length">
      <h2 class="font-semibold text-content">Холбоо барих</h2>
      <div class="mt-3 divide-y divide-surface-border rounded-card border border-surface-border bg-surface-card">
        <div v-for="row in contactRows" :key="row.label" class="flex gap-3 px-5 py-4">
          <component :is="row.icon" :size="18" class="mt-0.5 shrink-0 text-content-secondary" />
          <div class="min-w-0">
            <p class="text-body-sm text-content-secondary">{{ row.label }}</p>
            <p class="break-words text-body text-content">{{ row.value }}</p>
          </div>
        </div>
      </div>
    </section>

    <p
      v-if="!faq.length && !contactRows.length"
      class="rounded-card border border-surface-border bg-surface-card px-5 py-12 text-center text-body text-content-secondary"
    >
      Тусламжийн мэдээлэл хараахан бэлэн болоогүй байна.
    </p>
  </div>
</template>
