<script setup lang="ts">
import { Copy, Check, Info } from 'lucide-vue-next'

/**
 * Эрээн дэх хүлээн авах хаяг — introduction.md §3 (roadmap 5.9)
 *
 * ⚠ Энэ бол ЗӨВХӨН ХАРУУЛАХ ТЕКСТ: харилцагч Хятадын онлайн дэлгүүрт бичих
 * хаяг. Системийн агуулахын байршлын код (§8) нь МОНГОЛ дахь агуулахыг
 * заадаг, өөр зүйл — Эрээний тал систем дээр огт бүртгэлгүй (§1.1).
 *
 * Утгыг Админ вэбээс засварлана (roadmap 5.10) — кодод хатуу бичихгүй.
 */
const { content } = usePublicContent()

const { data: site } = await useAsyncData('public-content-address', () => content(), {
  default: () => null,
})

const address = computed(() => site.value?.erenhot_address ?? null)

/** Бөглөгдсөн талбар байгаа эсэх — хоосон хаягийг хуулуулах утгагүй */
const isFilled = computed(() =>
  Boolean(address.value?.receiverName || address.value?.addressCn || address.value?.addressMn)
)

const rows = computed(() =>
  [
    { label: 'Хүлээн авагч', value: address.value?.receiverName },
    { label: 'Утас', value: address.value?.phone },
    { label: 'Хаяг (хятадаар)', value: address.value?.addressCn },
    { label: 'Хаяг (монголоор)', value: address.value?.addressMn },
  ].filter(row => row.value)
)

const copied = ref<string | null>(null)

async function copy(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = label
    setTimeout(() => {
      if (copied.value === label) copied.value = null
    }, 2000)
  } catch {
    // Clipboard эрх өгөөгүй — хэрэглэгч гараар сонгож хуулна
  }
}

useHead({ title: 'Хүлээн авах хаяг — Ивээл Карго' })
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4">
    <div>
      <h1 class="text-h1 font-bold text-content">Хүлээн авах хаяг</h1>
      <p class="mt-2 text-body text-content-secondary">
        Хятадын онлайн дэлгүүрээс захиалга хийхдээ хүргүүлэх хаягтаа доорх
        мэдээллийг бичнэ үү.
      </p>
    </div>

    <!-- Хаяг бөглөгдөөгүй үе -->
    <div
      v-if="!isFilled"
      class="rounded-card border border-surface-border bg-surface-card px-5 py-12 text-center"
    >
      <Info :size="32" class="mx-auto text-content-disabled" :stroke-width="1.6" />
      <p class="mt-3 text-body text-content">Хаягийн мэдээлэл хараахан бэлэн болоогүй байна</p>
      <p class="mx-auto mt-1 max-w-sm text-body-sm text-content-secondary">
        {{ address?.note || 'Ажилтантай холбогдож хаягаа авна уу.' }}
      </p>
    </div>

    <template v-else>
      <div class="divide-y divide-surface-border rounded-card border border-surface-border bg-surface-card">
        <div
          v-for="row in rows"
          :key="row.label"
          class="flex items-start justify-between gap-3 px-5 py-4"
        >
          <div class="min-w-0">
            <p class="text-body-sm text-content-secondary">{{ row.label }}</p>
            <p class="mt-0.5 break-words text-body font-medium text-content">{{ row.value }}</p>
          </div>

          <UiBtn
            variant="ghost"
            size="sm"
            :icon="copied === row.label ? Check : Copy"
            :aria-label="`${row.label} хуулах`"
            @click="copy(row.label, row.value!)"
          >
            {{ copied === row.label ? 'Хуулагдлаа' : 'Хуулах' }}
          </UiBtn>
        </div>
      </div>

      <div
        v-if="address?.note"
        class="flex items-start gap-2.5 rounded-card border border-primary-200 bg-primary-50 px-4 py-3"
      >
        <Info :size="17" class="mt-0.5 shrink-0 text-primary-600" />
        <p class="whitespace-pre-line text-body-sm text-content">{{ address.note }}</p>
      </div>

      <div class="rounded-card border border-surface-border bg-surface-card p-5">
        <h2 class="font-semibold text-content">Анхаарах зүйл</h2>
        <ul class="mt-2 space-y-1.5 text-body-sm text-content-secondary">
          <li>· Хаягийн мэдээллийг яг байгаагаар нь хуулж бичнэ үү.</li>
          <li>
            · Утасны дугаараа өөрийнхөөрөө бичээрэй — ачаа тань энэ дугаараар
            танигдана.
          </li>
          <li>· Ачаа Монголд ирж, агуулахад бүртгэгдсэний дараа системд харагдана.</li>
        </ul>
      </div>
    </template>
  </div>
</template>
