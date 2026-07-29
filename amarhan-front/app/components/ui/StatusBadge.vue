<script setup lang="ts">
/**
 * Ачаа / хүргэлтийн төлөвийг өнгөт badge-ээр харуулна.
 *
 * Өнгө ба монгол нэр нь design-tokens.js-ээс ирнэ — компонент дотор
 * хатуу бичихгүй (docs/coding-style.md §3.7).
 */
const props = withDefaults(
  defineProps<{
    status: string | null | undefined
    kind?: 'package' | 'delivery'
    size?: 'sm' | 'md'
  }>(),
  { kind: 'package', size: 'md' }
)

const packageStatus = usePackageStatus()
const deliveryStatus = useDeliveryStatus()

const resolved = computed(() =>
  props.kind === 'delivery'
    ? deliveryStatus.style(props.status)
    : packageStatus.style(props.status)
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap"
    :class="size === 'sm' ? 'px-2 py-0.5 text-body-sm' : 'px-2.5 py-1 text-body-sm'"
    :style="{ color: resolved.color, backgroundColor: resolved.bg }"
  >
    <span
      class="inline-block rounded-full"
      :class="size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'"
      :style="{ backgroundColor: resolved.color }"
    />
    {{ resolved.label }}
  </span>
</template>
