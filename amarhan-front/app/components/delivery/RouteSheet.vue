<script setup lang="ts">
import { Printer } from 'lucide-vue-next'
import type { Delivery } from '~/composables/useDeliveries'

/**
 * Жолоочийн маршрутын хуудас — introduction.md §5 (roadmap 4.5)
 *
 * ЗОРИЛГО: жолооч гартаа барьж явах цаас. Дээр нь хаяг, утас, ачааны
 * дугаарууд, доор нь хүлээн авагчийн ГАРЫН ҮСГИЙН мөр.
 *
 * ХЭВЛЭХ ТЕХНИК: `InvoiceSheet.vue`-ийн ижил — `window.print()` дуудахад
 * зөвхөн `.print-area` харагдана (`@media print`).
 *
 * ТӨЛБӨР ДУТУУ бол хуудсан дээр ТОДООР бичигдэнэ: жолооч ачааг хүлээлгэж
 * өгөхөөсөө өмнө хэдэн төгрөг авахаа мэдэх ёстой. Гэхдээ энэ нь §5.2-ыг
 * сулруулахгүй — дутуу төлбөртэй хүргэлт хэвлэгдэх боловч ГАРЧ ЧАДАХГҮЙ.
 */
const props = defineProps<{
  modelValue: boolean
  delivery: Delivery
  unpaidTotal: number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const customer = computed(() => {
  const c = props.delivery.customerId
  return typeof c === 'object' && c !== null ? c : null
})

const packages = computed(() =>
  (props.delivery.packageIds ?? []).filter(
    (p): p is { id: string; trackingNumber: string; balance: number; status: string } =>
      typeof p === 'object' && p !== null
  )
)

function formatDate(value: string | Date | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function print() {
  if (!import.meta.client) return
  window.print()
}
</script>

<template>
  <UiModal
    :model-value="modelValue"
    title="Маршрутын хуудас"
    :subtitle="delivery.deliveryNumber"
    size="lg"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="print-area rounded-card border border-surface-border p-6 text-content">
      <header class="flex items-start justify-between gap-6 border-b border-surface-border pb-4">
        <div>
          <p class="text-h3 font-bold">Ивээл Карго</p>
          <p class="mt-0.5 text-body-sm text-content-secondary">Хүргэлтийн маршрут</p>
        </div>
        <div class="text-right">
          <p class="text-body-sm text-content-secondary">Хүргэлтийн дугаар</p>
          <p class="tabular text-h4 font-bold">{{ delivery.deliveryNumber }}</p>
          <p class="tabular mt-0.5 text-body-sm text-content-secondary">
            {{ formatDate(delivery.scheduledDate ?? delivery.createdAt) }}
          </p>
        </div>
      </header>

      <section class="grid gap-4 border-b border-surface-border py-4 sm:grid-cols-2">
        <div>
          <p class="text-body-sm text-content-secondary">Хүлээн авагч</p>
          <p class="tabular text-h4 font-bold">{{ delivery.phone }}</p>
          <p v-if="customer?.name" class="text-body-sm">{{ customer.name }}</p>
        </div>
        <div class="sm:text-right">
          <p class="text-body-sm text-content-secondary">Жолооч</p>
          <p class="text-body font-semibold">{{ delivery.driverName ?? '—' }}</p>
          <p v-if="delivery.driverPhone" class="tabular text-body-sm text-content-secondary">
            {{ delivery.driverPhone }}
          </p>
        </div>
      </section>

      <section class="border-b border-surface-border py-4">
        <p class="text-body-sm text-content-secondary">Хүргэх хаяг</p>
        <p class="text-h4 font-semibold">{{ delivery.address }}</p>
        <p v-if="delivery.note" class="mt-1 text-body-sm text-content-secondary">
          Тэмдэглэл: {{ delivery.note }}
        </p>
      </section>

      <!-- Ачааны жагсаалт — жолооч тоолж авах -->
      <section class="py-4">
        <p class="mb-2 text-body font-semibold">Ачаа ({{ packages.length }})</p>
        <table class="w-full border-collapse text-left">
          <thead>
            <tr class="border-b border-surface-border">
              <th class="py-2 pr-3 text-body-sm font-medium text-content-secondary">№</th>
              <th class="py-2 pr-3 text-body-sm font-medium text-content-secondary">
                Ачааны дугаар
              </th>
              <th class="py-2 text-right text-body-sm font-medium text-content-secondary">
                Үлдэгдэл
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(p, index) in packages"
              :key="p.id"
              class="border-b border-surface-border"
            >
              <td class="tabular py-2 pr-3 text-body-sm text-content-secondary">
                {{ index + 1 }}
              </td>
              <td class="tabular py-2 pr-3 text-body font-medium">{{ p.trackingNumber }}</td>
              <td class="tabular py-2 text-right text-body" :class="p.balance > 0 ? 'font-bold' : ''">
                {{ p.balance > 0 ? formatCurrency(p.balance) : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- §5.2 — жолооч хэдэн төгрөг авахаа мэдэх ёстой -->
      <section
        v-if="unpaidTotal > 0"
        class="border-2 border-content px-3 py-2"
      >
        <div class="flex items-center justify-between">
          <span class="text-body font-bold">ТӨЛБӨР ДУТУУ — авах дүн</span>
          <span class="tabular text-h3 font-bold">{{ formatCurrency(unpaidTotal) }}</span>
        </div>
      </section>

      <section v-if="delivery.fee > 0" class="mt-3 flex items-center justify-between">
        <span class="text-body">Хүргэлтийн төлбөр</span>
        <span class="tabular text-body font-semibold">{{ formatCurrency(delivery.fee) }}</span>
      </section>

      <!-- Гарын үсэг — цаасан баримтын гол утга -->
      <footer class="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <div class="h-10 border-b border-content" />
          <p class="mt-1 text-body-sm text-content-secondary">Хүлээлгэн өгсөн (жолооч)</p>
        </div>
        <div>
          <div class="h-10 border-b border-content" />
          <p class="mt-1 text-body-sm text-content-secondary">Хүлээн авсан (харилцагч)</p>
        </div>
      </footer>
    </div>

    <template #footer>
      <UiBtn variant="secondary" @click="emit('update:modelValue', false)">Хаах</UiBtn>
      <UiBtn :icon="Printer" @click="print">Хэвлэх</UiBtn>
    </template>
  </UiModal>
</template>
