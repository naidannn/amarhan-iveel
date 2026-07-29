<script setup lang="ts">
import { encodeCode128 } from '~/utils/barcode'

/**
 * Code 128 зураасан код — §1.10
 *
 * SVG-ээр зурж байгаа шалтгаан: хэвлэхэд ямар ч DPI-д хурц гарна. Canvas/PNG
 * бол принтерийн 600 dpi дээр бүдэгширч, скайнер уншихгүй болох эрсдэлтэй.
 */
const props = withDefaults(
  defineProps<{
    value: string
    /** Зурвасын өндөр (px) */
    height?: number
    /** Нэг модулийн өргөн (px). Скайнерт 1px-ээс багагүй байх ёстой */
    moduleWidth?: number
    /** Доор текстээр дугаарыг хэвлэх — скайнер уншихгүй бол хүн уншина */
    showText?: boolean
  }>(),
  { height: 48, moduleWidth: 2, showText: true }
)

const encoded = computed(() => {
  try {
    return encodeCode128(props.value)
  } catch {
    return null
  }
})
</script>

<template>
  <div class="flex flex-col items-center">
    <svg
      v-if="encoded"
      :width="encoded.totalModules * moduleWidth"
      :height="height"
      :viewBox="`0 0 ${encoded.totalModules} ${height}`"
      preserveAspectRatio="none"
      role="img"
      :aria-label="`Зураасан код: ${value}`"
      class="max-w-full"
    >
      <rect :width="encoded.totalModules" :height="height" fill="#FFFFFF" />
      <rect
        v-for="(bar, index) in encoded.bars"
        :key="index"
        :x="bar.x"
        y="0"
        :width="bar.width"
        :height="height"
        fill="#000000"
      />
    </svg>

    <!-- Кирилл тэмдэгт орсон дугаарыг Code 128 кодчилж чадахгүй -->
    <p v-else class="text-body-sm text-content-secondary">Зураасан код гаргах боломжгүй</p>

    <p v-if="showText" class="tabular mt-1 font-mono text-body font-semibold tracking-widest">
      {{ value }}
    </p>
  </div>
</template>
