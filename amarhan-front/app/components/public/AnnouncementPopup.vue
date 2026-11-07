<script setup lang="ts">
import { X } from 'lucide-vue-next'

/**
 * Вэб рүү ороход гарч ирэх зурагтай зарлал (`content.home_popup`).
 *
 * Админ "Статик агуулга > Popup зарлал"-аас тохируулна. Зураг Cloudinary-д
 * байрладаг (сервер дээр хадгалахгүй). Backend унтраасан/хугацаа дууссан
 * popup-ыг `null` болгож илгээдэг тул энд дахин шүүхгүй.
 *
 * Хаасны дараа ТЭР ЗУРГИЙГ тухайн browser session-д дахин харуулахгүй — хуудас
 * солих бүрт гарвал залхаана. Админ шинэ зураг оруулбал `imageUrl` өөрчлөгдөж,
 * дахин гарна. Storage ажиллахгүй (private горим) бол зүгээр л дахин гарна.
 */
export interface AnnouncementPopupData {
  imageUrl: string
  title: string
  body: string
  linkUrl: string
  linkText: string
}

const props = defineProps<{ popup: AnnouncementPopupData | null }>()

const STORAGE_KEY = 'iveel:popup-dismissed'
const open = ref(false)

function wasDismissed(imageUrl: string) {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === imageUrl
  } catch {
    return false
  }
}

function close() {
  open.value = false
  try {
    if (props.popup) sessionStorage.setItem(STORAGE_KEY, props.popup.imageUrl)
  } catch {
    // Storage хаалттай — дараагийн хуудсанд дахин гарна, урсгалыг блоклохгүй
  }
}

// SSR дээр нээхгүй (sessionStorage зөвхөн клиентэд) — hydrate-ийн дараа шийднэ
onMounted(() => {
  watch(
    () => props.popup?.imageUrl,
    imageUrl => {
      open.value = Boolean(imageUrl && !wasDismissed(imageUrl))
    },
    { immediate: true }
  )
})

/**
 * Cloudinary-ийн зургийг хөтөчид тохирох формат (WebP/AVIF), чанар, өргөнөөр
 * авна — гар утсанд эх 1280px PNG-г татуулахгүй. Бусад host-ын URL хэвээр.
 */
const imageSrc = computed(() => {
  const url = props.popup?.imageUrl ?? ''
  return url.includes('res.cloudinary.com/') && url.includes('/image/upload/')
    ? url.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_900/')
    : url
})

const isExternalLink = computed(() => /^https?:\/\//.test(props.popup?.linkUrl ?? ''))
</script>

<template>
  <UiModal
    v-if="popup"
    :model-value="open"
    size="sm"
    @update:model-value="value => (value ? (open = true) : close())"
  >
    <div class="relative -mx-card -mt-5">
      <img
        :src="imageSrc"
        :alt="popup.title || 'Зарлал'"
        class="block max-h-[60vh] w-full bg-surface-hover object-contain"
      />
      <button
        type="button"
        class="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors duration-200 hover:bg-black/70"
        aria-label="Хаах"
        @click="close"
      >
        <X :size="18" />
      </button>
    </div>

    <div v-if="popup.title || popup.body" class="mt-4 space-y-2">
      <h2 v-if="popup.title" class="text-h4 text-content">{{ popup.title }}</h2>
      <p v-if="popup.body" class="whitespace-pre-line text-body text-content-secondary">
        {{ popup.body }}
      </p>
    </div>

    <div class="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
      <UiBtn
        v-if="popup.linkUrl"
        :to="popup.linkUrl"
        :target="isExternalLink ? '_blank' : undefined"
        block
        @click="close"
      >
        {{ popup.linkText || 'Дэлгэрэнгүй' }}
      </UiBtn>
      <UiBtn :variant="popup.linkUrl ? 'secondary' : 'primary'" block @click="close">Хаах</UiBtn>
    </div>
  </UiModal>
</template>
