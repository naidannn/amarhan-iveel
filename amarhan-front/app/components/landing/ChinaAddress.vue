<script setup lang="ts">
import { Copy, Check, Info } from 'lucide-vue-next'

/**
 * Эрээн дэх хүлээн авах хаяг — `pages/address.vue`-тай ижил өгөгдлийн эх
 * үүсвэр (`content.erenhot_address`), нүүр хуудасны цагаан карт хэлбэрээр.
 *
 * ⚠ Энэ ЗӨВХӨН ХАРУУЛАХ ТЕКСТ — Хятадын онлайн дэлгүүрт бичих хаяг, системийн
 * агуулахын байршил (§8) БИШ. Утга Админ вэбээс засварлагдана (roadmap 5.10).
 *
 * Мөр тус бүрийг тусад нь хуулах биш, бүх хаягийг НЭГ дор хуулдаг болгосон —
 * харилцагч Хятадын дэлгүүрийн хаягийн талбарт шууд paste хийхэд зориулав.
 */
const props = defineProps<{
  address: {
    receiverName?: string
    phone?: string
    addressCn?: string
    addressMn?: string
    note?: string
  } | null
}>()

const isFilled = computed(() =>
  Boolean(props.address?.receiverName || props.address?.addressCn || props.address?.addressMn)
)

const rows = computed(() =>
  [
    { label: 'Хүлээн авагч', value: props.address?.receiverName },
    { label: 'Утас', value: props.address?.phone },
    { label: 'Хаяг (хятадаар)', value: props.address?.addressCn },
    { label: 'Хаяг (монголоор)', value: props.address?.addressMn },
  ].filter(row => row.value)
)

/**
 * Хуулах бүрэн текст — зөвхөн хаягийн мөрүүд (нэр, утас, хаяг), мөр мөрөөр.
 * Тэмдэглэл (`note`) энд ОРОХГҮЙ: энэ бол харилцагчид зориулсан заавар текст,
 * Хятадын дэлгүүрийн хаягийн талбарт paste хийх зүйл биш.
 */
const fullText = computed(() =>
  [
    props.address?.receiverName,
    props.address?.phone,
    props.address?.addressCn,
    props.address?.addressMn,
  ]
    .filter(Boolean)
    .join('\n')
)

const copied = ref(false)

async function copyAll() {
  try {
    await navigator.clipboard.writeText(fullText.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Clipboard эрх өгөөгүй — хэрэглэгч гараар сонгож хуулна
  }
}
</script>

<template>
  <section class="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
    <div class="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16">
      <div class="text-center lg:text-left">
        <h2 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Хятад дахь хүлээн авах хаяг</h2>
        <p class="mx-auto mt-4 max-w-md text-body-lg text-slate-500 lg:mx-0">
          Хятадын онлайн дэлгүүрээс захиалга хийхдээ хүргүүлэх хаягтаа доорх
          мэдээллийг бичээрэй. Ачаа Монголд ирж, агуулахад бүртгэгдсэний дараа
          систем дээр харагдана.
        </p>
        <NuxtLink
          to="/address"
          class="mt-6 inline-flex items-center gap-1.5 text-body-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          Дэлгэрэнгүй хуудас руу очих →
        </NuxtLink>
      </div>

      <div class="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)] sm:p-8">
        <div v-if="!isFilled" class="py-8 text-center">
          <Info :size="28" class="mx-auto text-slate-300" :stroke-width="1.6" />
          <p class="mt-3 text-body text-slate-700">Хаягийн мэдээлэл хараахан бэлэн болоогүй байна</p>
          <p class="mx-auto mt-1 max-w-sm text-body-sm text-slate-400">
            {{ address?.note || 'Ажилтантай холбогдож хаягаа авна уу.' }}
          </p>
        </div>

        <template v-else>
          <div class="flex items-center justify-between gap-3">
            <p class="text-body-sm font-semibold text-slate-900">Хаягийн мэдээлэл</p>
            <button
              type="button"
              class="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
              :class="copied ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-700 hover:bg-primary-100'"
              @click="copyAll"
            >
              <component :is="copied ? Check : Copy" :size="13" />
              {{ copied ? 'Хуулагдлаа' : 'Бүгдийг хуулах' }}
            </button>
          </div>

          <div class="mt-2 divide-y divide-slate-100">
            <div v-for="row in rows" :key="row.label" class="py-3.5 first:pt-3 last:pb-0">
              <p class="text-body-sm text-slate-400">{{ row.label }}</p>
              <p class="mt-0.5 break-words text-body font-medium text-slate-900">{{ row.value }}</p>
            </div>
          </div>

          <p v-if="address?.note" class="mt-5 whitespace-pre-line rounded-2xl bg-primary-50 px-4 py-3 text-body-sm text-primary-800">
            {{ address.note }}
          </p>
        </template>
      </div>
    </div>
  </section>
</template>
