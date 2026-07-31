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

// API key шаардахгүй Google Maps query embed. Админаас оруулсан хаяг өөрчлөгдвөл
// газрын зураг ч дагаж шинэчлэгдэнэ; Google Maps холбоос нь тусдаа "томоор нээх" үйлдэл хэвээр.
const mapEmbedUrl = computed(() =>
  props.contact?.address
    ? `https://www.google.com/maps?q=${encodeURIComponent(props.contact.address)}&output=embed`
    : null
)
</script>

<template>
  <section id="mongolia-warehouse" class="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
    <div class="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
      <div class="text-center lg:text-left">
        <p class="text-body-sm font-semibold text-primary-600">Хүлээн авах цэг</p>
        <h2 class="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Монгол дахь агуулах</h2>
        <p class="mx-auto mt-4 max-w-md text-body-lg leading-relaxed text-slate-500 lg:mx-0">Хүргэлт захиалахгүйгээр ачаагаа өөрөө ирж авах бол доорх хаягаар очно уу.</p>
        <a
          v-if="contact?.googleMapsUrl"
          :href="contact.googleMapsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-6 inline-flex items-center gap-1.5 text-body-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          Google Maps дээр томоор харах
          <ExternalLink :size="15" />
        </a>
      </div>

      <div class="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_42px_-20px_rgba(15,23,42,0.2)]">
        <!-- Хаяг байвал бодит Google Maps, байхгүй бол мэдээлэл оруулах хүртэлх саармаг төлөв. -->
        <div v-if="mapEmbedUrl" class="relative h-[260px] bg-slate-100 sm:h-[300px]">
          <iframe
            :src="mapEmbedUrl"
            title="Ивээл Карго агуулахын байршил"
            class="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          />
        </div>
        <div v-else class="relative flex min-h-[220px] items-center justify-center overflow-hidden bg-slate-50">
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
          <p class="max-w-[220px] text-body-sm text-slate-400">Агуулахын хаяг оруулмагц газрын зураг энд харагдана.</p>
        </div>
        </div>

        <div class="p-5 sm:p-6">
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
    </div>
  </section>
</template>
