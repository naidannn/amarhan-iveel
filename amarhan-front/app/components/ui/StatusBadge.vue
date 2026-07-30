<script setup lang="ts">
/**
 * Төлөв/төрлийг өнгөт badge-ээр харуулна.
 *
 * Өнгө ба монгол нэр нь design-tokens.js-ээс ирнэ — компонент дотор
 * хатуу бичихгүй (docs/coding-style.md §3.7).
 *
 * `kind` нь АЛЬ ТОЛЬ-оос уншихыг заана. Тусад нь байх ёстой шалтгаан:
 * «Хүчингүй», «Төлөгдсөн» гэсэн ижил үг ачаа, төлбөр, нэхэмжлэхэд ӨӨР утга
 * агуулна — нэг толинд хольвол буруу өнгө, буруу нэр гарна.
 */
const props = withDefaults(
  defineProps<{
    status: string | null | undefined
    kind?: 'package' | 'delivery' | 'method' | 'record' | 'payment' | 'invoice'
    size?: 'sm' | 'md'
  }>(),
  { kind: 'package', size: 'md' }
)

const packageStatus = usePackageStatus()
const deliveryStatus = useDeliveryStatus()
const payment = usePaymentStyles()

const resolved = computed(() => {
  switch (props.kind) {
    case 'delivery':
      return deliveryStatus.style(props.status)
    case 'method':
      return payment.method.style(props.status)
    case 'record':
      return payment.recordStatus.style(props.status)
    case 'payment':
      return payment.paymentStatus.style(props.status)
    case 'invoice':
      return payment.invoiceStatus.style(props.status)
    default:
      return packageStatus.style(props.status)
  }
})
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
