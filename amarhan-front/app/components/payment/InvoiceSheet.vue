<script setup lang="ts">
import { Printer } from 'lucide-vue-next'
import type { Invoice, Payment } from '~/composables/usePayments'

/**
 * Нэгтгэсэн нэхэмжлэхийн баримт хэвлэх — introduction.md §2.3 алхам 5
 *
 * «Нэг баримтад багтсан бүх tracking number хэвлэгдэнэ» гэсэн шаардлагыг
 * биелүүлнэ — хэрэглэгч ямар ачааны төлбөрийг төлснөө баримтаас харна.
 *
 * ХЭВЛЭХ ТЕХНИК: `PrintSheet.vue`-ийн ижил — `window.print()` дуудахад
 * зөвхөн `.print-area` харагдана (`@media print`). Шинэ цонх/iframe нээхгүй:
 * popup blocker, фонт ачаалагдаагүй байх зэрэг эмзэг байдлаас зайлсхийнэ.
 *
 * ДҮНГ ЭНД БОДОХГҮЙ. Баримт дээрх бүх тоо backend-ээс ирсэн хэлбэрээрээ
 * хэвлэгдэнэ — client талд дахин бодвол баримт ба бүртгэл зөрч, дараа нь аль
 * нь зөв болохыг тодорхойлох боломжгүй болно.
 */
const props = defineProps<{
  modelValue: boolean
  invoice: Invoice
  payments: Payment[]
  balance: number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const customer = computed(() => {
  const c = props.invoice.customerId
  return typeof c === 'object' && c !== null ? c : null
})

/** Хүчингүй болсон төлбөр баримтад ОРОХГҮЙ — тэр мөнгө бодитоор ороогүй */
const validPayments = computed(() => props.payments.filter(p => p.status === 'completed'))

const paymentStyles = usePaymentStyles()

function formatDate(value: string | Date) {
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
    title="Нэхэмжлэх хэвлэх"
    :subtitle="invoice.invoiceNumber"
    size="lg"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- Хэвлэгдэх хэсэг. `.print-area` дотор БАЙХГҮЙ юу ч хэвлэгдэхгүй -->
    <div class="print-area rounded-card border border-surface-border p-6 text-content">
      <header class="flex items-start justify-between gap-6 border-b border-surface-border pb-4">
        <div>
          <p class="text-h3 font-bold">Ивээл Карго</p>
          <p class="mt-0.5 text-body-sm text-content-secondary">
            Хятад (Эрээн) → Монгол карго тээвэр
          </p>
        </div>
        <div class="text-right">
          <p class="text-body-sm text-content-secondary">Нэхэмжлэх</p>
          <p class="tabular text-h4 font-bold">{{ invoice.invoiceNumber }}</p>
          <p class="tabular mt-0.5 text-body-sm text-content-secondary">
            {{ formatDate(invoice.createdAt) }}
          </p>
        </div>
      </header>

      <section class="grid gap-4 border-b border-surface-border py-4 sm:grid-cols-2">
        <div>
          <p class="text-body-sm text-content-secondary">Харилцагч</p>
          <p class="tabular text-body font-semibold">
            {{ customer?.phone ?? invoice.customerPhone }}
          </p>
          <p v-if="customer?.name" class="text-body-sm text-content-secondary">
            {{ customer.name }}
          </p>
        </div>
        <div class="sm:text-right">
          <p class="text-body-sm text-content-secondary">Ачааны тоо</p>
          <p class="tabular text-body font-semibold">{{ invoice.items.length }}</p>
        </div>
      </section>

      <!-- §2.3 алхам 5 — БҮХ tracking number баримтад -->
      <section class="py-4">
        <table class="w-full border-collapse text-left">
          <thead>
            <tr class="border-b border-surface-border">
              <th class="py-2 pr-3 text-body-sm font-medium text-content-secondary">№</th>
              <th class="py-2 pr-3 text-body-sm font-medium text-content-secondary">
                Ачааны дугаар
              </th>
              <th class="py-2 text-right text-body-sm font-medium text-content-secondary">Дүн</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in invoice.items"
              :key="item.trackingNumber"
              class="border-b border-surface-border"
            >
              <td class="tabular py-2 pr-3 text-body-sm text-content-secondary">
                {{ index + 1 }}
              </td>
              <td class="tabular py-2 pr-3 text-body font-medium">{{ item.trackingNumber }}</td>
              <td class="tabular py-2 text-right text-body">{{ formatCurrency(item.amount) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" class="pt-3 text-body font-semibold">Нийт</td>
              <td class="tabular pt-3 text-right text-h4 font-bold">
                {{ formatCurrency(invoice.totalAmount) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <!-- Төлбөрүүд. Хуваасан төлбөрийн үед хэлбэр бүр тусад нь харагдана (BR-13) -->
      <section v-if="validPayments.length" class="border-t border-surface-border py-4">
        <p class="mb-2 text-body font-semibold">Хийгдсэн төлбөр</p>
        <ul class="space-y-1.5">
          <li
            v-for="p in validPayments"
            :key="p.id"
            class="flex items-center justify-between text-body-sm"
          >
            <span class="text-content-secondary">
              {{ formatDate(p.createdAt) }} · {{ paymentStyles.method.label(p.method) }}
              <span v-if="p.receivedByName"> · {{ p.receivedByName }}</span>
            </span>
            <span class="tabular font-medium">{{ formatCurrency(p.amount) }}</span>
          </li>
        </ul>
      </section>

      <section class="border-t-2 border-content pt-3">
        <div class="flex items-center justify-between">
          <span class="text-body font-semibold">Төлөгдсөн</span>
          <span class="tabular text-body font-semibold">
            {{ formatCurrency(invoice.paidAmount) }}
          </span>
        </div>
        <div class="mt-1 flex items-center justify-between">
          <span class="text-h4 font-bold">Үлдэгдэл</span>
          <span class="tabular text-h3 font-bold" :class="balance > 0 ? 'text-error' : ''">
            {{ formatCurrency(balance) }}
          </span>
        </div>
      </section>

      <footer class="mt-6 border-t border-surface-border pt-3 text-center">
        <p class="text-body-sm text-content-secondary">
          {{
            balance === 0
              ? 'Төлбөр бүрэн төлөгдсөн. Ачааг хүлээн авахад энэ баримтыг үзүүлнэ үү.'
              : 'Үлдэгдэл төлөгдсөний дараа ачаа хүлээлгэн өгөгдөнө.'
          }}
        </p>
      </footer>
    </div>

    <template #footer>
      <UiBtn variant="secondary" @click="emit('update:modelValue', false)">Хаах</UiBtn>
      <UiBtn :icon="Printer" @click="print">Хэвлэх</UiBtn>
    </template>
  </UiModal>
</template>
