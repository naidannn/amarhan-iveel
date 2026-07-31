<script setup lang="ts">
import { Phone, Mail, MapPin, Clock, Globe, ExternalLink, Map as MapIcon } from 'lucide-vue-next'

/** Монгол дахь агуулах/оффис — `content.contact`-той ижил эх үүсвэр (`pages/help.vue`). */
const props = defineProps<{
  contact: {
    phone?: string
    email?: string
    address?: string
    workingHours?: string
    facebook?: string
    website?: string
    googleMapsUrl?: string
  } | null
}>()

const rows = computed(() =>
  [
    { icon: Phone, label: 'Утас', value: props.contact?.phone },
    { icon: Mail, label: 'Имэйл', value: props.contact?.email },
    { icon: MapPin, label: 'Хаяг', value: props.contact?.address },
    { icon: Clock, label: 'Ажиллах цаг', value: props.contact?.workingHours },
    { icon: Globe, label: 'Вэбсайт', value: props.contact?.website },
  ].filter(row => row.value)
)
</script>

<template>
  <section id="mongolia-warehouse" class="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
    <div class="mx-auto max-w-xl text-center">
      <h2 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Монгол дахь агуулах</h2>
      <p class="mt-4 text-body-lg text-slate-500">Хүргэлт захиалахгүйгээр ачаагаа өөрөө ирж авах бол энд.</p>
    </div>

    <div class="mt-14 grid gap-5 lg:grid-cols-[1fr_1fr] lg:items-stretch">
      <!-- Газрын зураг (жинхэнэ Google Maps холбоос байвал шинэ табаар нээнэ) -->
      <div class="relative flex min-h-[280px] items-center justify-center overflow-hidden rounded-[24px] border border-slate-200/80 bg-slate-50">
        <div
          class="absolute inset-0 opacity-70"
          style="
            background-image: radial-gradient(circle at 30% 30%, rgba(53,93,255,0.12), transparent 55%),
              linear-gradient(rgba(15,23,42,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(15,23,42,0.05) 1px, transparent 1px);
            background-size: auto, 36px 36px, 36px 36px;
          "
        />
        <div class="relative flex flex-col items-center gap-3 text-center">
          <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <MapIcon :size="24" class="text-primary-600" :stroke-width="1.7" />
          </div>
          <a
            v-if="contact?.googleMapsUrl"
            :href="contact.googleMapsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-body-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
          >
            Google Maps дээр харах
            <ExternalLink :size="14" />
          </a>
          <p v-else class="max-w-[220px] text-body-sm text-slate-400">Байршлын зураг удахгүй нэмэгдэнэ</p>
        </div>
      </div>

      <div class="rounded-[24px] border border-slate-200/80 bg-white p-7 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)]">
        <div v-if="rows.length" class="divide-y divide-slate-100">
          <div v-for="row in rows" :key="row.label" class="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
            <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <component :is="row.icon" :size="15" :stroke-width="1.8" />
            </div>
            <div class="min-w-0">
              <p class="text-body-sm text-slate-400">{{ row.label }}</p>
              <p class="mt-0.5 break-words text-body font-medium text-slate-900">{{ row.value }}</p>
            </div>
          </div>
        </div>
        <p v-else class="py-6 text-center text-body-sm text-slate-400">
          Холбоо барих мэдээлэл хараахан бөглөгдөөгүй байна.
        </p>
      </div>
    </div>
  </section>
</template>
