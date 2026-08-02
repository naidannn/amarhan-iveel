<script setup lang="ts">
import { BookImage, ArrowUpRight } from 'lucide-vue-next'

/**
 * Хятадын онлайн дэлгүүр тус бүрт (Taobao, Pinduoduo гэх мэт) манай Эрээний
 * хаягийг хэрхэн холбохыг зааж өгөх карт жагсаалт — `content.address_guides`
 * (Тохиргоо > Вэбийн агуулга, Админ чөлөөтэй нэмэх/засах/устгах).
 *
 * Нүүр хуудас (`LandingChinaAddress`-ийн дараа) болон `/address` хуудсанд
 * ижилхэн ашиглагдана.
 */
interface Guide {
  id: string
  platform?: string
  thumbnailUrl?: string
  blocks?: { imageUrl?: string; text?: string }[]
}

const props = defineProps<{ guides: Guide[] | null }>()

const config = useRuntimeConfig()
const apiBase = config.public.apiBase || 'http://localhost:4000'
function imageSrc(url?: string) {
  return url ? `${apiBase}${url}` : ''
}

const list = computed(() => props.guides ?? [])

const activeGuide = ref<Guide | null>(null)
const showModal = ref(false)
function openGuide(guide: Guide) {
  activeGuide.value = guide
  showModal.value = true
}
</script>

<template>
  <section v-if="list.length" class="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
    <div class="mx-auto max-w-xl text-center">
      <h2 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        Хаяг холбох заавар
      </h2>
      <p class="mt-4 text-body-lg text-slate-500">
        Хятадын онлайн дэлгүүр тус бүрт манай хаягийг хэрхэн холбохыг алхам
        алхмаар үзнэ үү.
      </p>
    </div>

    <div class="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <button
        v-for="guide in list"
        :key="guide.id"
        type="button"
        class="group flex flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-white text-left shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-14px_rgba(15,23,42,0.16)]"
        @click="openGuide(guide)"
      >
        <div class="flex h-36 items-center justify-center overflow-hidden bg-slate-50">
          <img
            v-if="guide.thumbnailUrl"
            :src="imageSrc(guide.thumbnailUrl)"
            :alt="guide.platform"
            class="h-full w-full object-cover"
          />
          <BookImage v-else :size="28" class="text-slate-300" :stroke-width="1.6" />
        </div>

        <div class="p-5">
          <h3 class="text-lg font-semibold text-slate-900">{{ guide.platform }}</h3>
          <span
            class="mt-2 inline-flex items-center gap-1 text-body-sm font-semibold text-primary-600 group-hover:text-primary-700"
          >
            Зааврыг харах <ArrowUpRight :size="15" />
          </span>
        </div>
      </button>
    </div>

    <LandingAddressGuideModal v-model="showModal" :guide="activeGuide" />
  </section>
</template>
