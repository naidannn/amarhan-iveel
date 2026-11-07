<script setup lang="ts">
import { X } from 'lucide-vue-next'

/**
 * Вэб рүү ороход гарч ирэх зурагтай зарлал (`GET /public/content`-ийн `home_popup`).
 *
 * Эх сурвалж нь Мэдэгдэл модуль: Админ/Менежер зарлал илгээхдээ «Popup-аар
 * харуулах»-ыг сонгоно — хамгийн сүүлийн идэвхтэй нь гарна. Зураг Cloudinary-д.
 * Backend зогсоосон/хугацаа дууссан зарлалыг `null` болгож илгээдэг.
 *
 * Хаасны дараа ТЭР ЗАРЛАЛЫГ тухайн browser session-д дахин харуулахгүй — хуудас
 * солих бүрт гарвал залхаана. Шинэ зарлал илгээвэл `id` өөрчлөгдөж дахин гарна.
 * Storage ажиллахгүй (private горим) бол зүгээр л дахин гарна.
 */
export interface AnnouncementPopupData {
  id: string
  imageUrl: string
  title: string
  body: string
  linkUrl: string
  linkText: string
}

const props = defineProps<{ popup: AnnouncementPopupData | null }>()

const STORAGE_KEY = 'iveel:popup-dismissed'
const open = ref(false)

function wasDismissed(id: string) {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === id
  } catch {
    return false
  }
}

function close() {
  open.value = false
  try {
    if (props.popup) sessionStorage.setItem(STORAGE_KEY, props.popup.id)
  } catch {
    // Storage хаалттай — дараагийн хуудсанд дахин гарна, урсгалыг блоклохгүй
  }
}

// SSR дээр нээхгүй (sessionStorage зөвхөн клиентэд) — hydrate-ийн дараа шийднэ
onMounted(() => {
  watch(
    () => props.popup?.id,
    id => {
      open.value = Boolean(id && !wasDismissed(id))
    },
    { immediate: true }
  )
})

const imageSrc = computed(() => optimizedImage(props.popup?.imageUrl))

const isExternalLink = computed(() => /^https?:\/\//.test(props.popup?.linkUrl ?? ''))
</script>

<template>
  <UiModal
    v-if="popup"
    :model-value="open"
    size="sm"
    centered
    @update:model-value="value => (value ? (open = true) : close())"
  >
    <div class="relative -mx-card -mt-5">
      <img
        :src="imageSrc"
        :alt="popup.title || 'Зарлал'"
        class="block max-h-[45dvh] w-full bg-surface-hover object-contain sm:max-h-[55vh]"
      />
      <!-- Ямар ч зураг дээр тод харагдах цагаан дугуй (хар/бараан зурагт ч алга болохгүй) -->
      <button
        type="button"
        class="absolute top-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg ring-1 ring-black/10 transition-transform duration-200 hover:scale-105"
        aria-label="Хаах"
        @click="close"
      >
        <X :size="20" :stroke-width="2.5" />
      </button>
    </div>

    <div v-if="popup.title || popup.body" class="mt-4 space-y-2">
      <h2 v-if="popup.title" class="text-h4 text-content">{{ popup.title }}</h2>
      <p v-if="popup.body" class="whitespace-pre-line text-body text-content-secondary">
        {{ popup.body }}
      </p>
    </div>

    <!-- Footer нь `centered` үед доод талдаа наалттай — текст урт ч «Хаах» үргэлж харагдана -->
    <template #footer>
      <div class="flex w-full flex-col gap-2 sm:flex-row-reverse">
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
    </template>
  </UiModal>
</template>
