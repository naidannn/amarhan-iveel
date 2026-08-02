<script setup lang="ts">
/**
 * Хаяг холбох зааврын дэлгэрэнгүй попап — `content.address_guides` (Тохиргоо >
 * Вэбийн агуулга, Админ засна). Алхам бүрийг зураг+текст блок хэлбэрээр,
 * бичигдсэн дараалалаар нь харуулна.
 */
const props = defineProps<{
  modelValue: boolean
  guide: {
    platform?: string
    blocks?: { imageUrl?: string; text?: string }[]
  } | null
}>()

defineEmits<{ 'update:modelValue': [value: boolean] }>()

const config = useRuntimeConfig()
const apiBase = config.public.apiBase || 'http://localhost:4000'
function imageSrc(url?: string) {
  return url ? `${apiBase}${url}` : ''
}

const blocks = computed(() => props.guide?.blocks ?? [])
</script>

<template>
  <UiModal
    :model-value="modelValue"
    :title="guide?.platform"
    subtitle="Хаяг холбох заавар"
    size="md"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="space-y-5">
      <div v-for="(block, index) in blocks" :key="index" class="space-y-2">
        <img
          v-if="block.imageUrl"
          :src="imageSrc(block.imageUrl)"
          :alt="`${guide?.platform} — алхам ${index + 1}`"
          class="w-full rounded-btn border border-surface-border object-cover"
        />
        <p v-if="block.text" class="text-body text-content-secondary">
          <span class="mr-1.5 font-semibold text-content">{{ index + 1 }}.</span>{{ block.text }}
        </p>
      </div>

      <p v-if="!blocks.length" class="text-body-sm text-content-secondary">
        Энэ заавар дэлгэрэнгүй алхамгүй байна.
      </p>
    </div>
  </UiModal>
</template>
