<script setup lang="ts">
import { Wallet } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'

/**
 * Төлбөрийн түүх — introduction.md §3
 *
 * Backend нь ЗӨВХӨН `completed` төлбөрийг буцаана: `pending` (батлагдаагүй
 * онлайн) болон `voided` бичлэгийг харуулбал хэрэглэгч төлөгдсөн гэж
 * ойлгоно (BR-14, BR-18).
 */
definePageMeta({ middleware: 'customer' })

const portal = useCustomerPortal()
const paymentStyles = usePaymentStyles()

const page = ref(1)
const items = ref<any[]>([])
const pagination = ref({ page: 1, pages: 1, total: 0, limit: 20 })
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const result = await portal.payments({ page: page.value, limit: 20 })
    items.value = result.data
    pagination.value = result.pagination
  } finally {
    loading.value = false
  }
}

watch(page, load)
onMounted(load)

function formatDate(value: string) {
  return new Date(value).toLocaleString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

useHead({ title: 'Төлбөр — Ивээл Карго' })
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-h1 font-bold text-content">Төлбөрийн түүх</h1>
      <p class="mt-1 text-body text-content-secondary">
        Нийт {{ pagination.total.toLocaleString('mn-MN') }} гүйлгээ
      </p>
    </div>

    <p v-if="loading" class="py-10 text-center text-body text-content-secondary">Ачаалж байна…</p>

    <div
      v-else-if="!items.length"
      class="rounded-card border border-surface-border bg-surface-card px-5 py-14 text-center"
    >
      <Wallet :size="34" class="mx-auto text-content-disabled" :stroke-width="1.6" />
      <p class="mt-3 text-body text-content">Төлбөрийн бүртгэл алга байна</p>
    </div>

    <template v-else>
      <ul class="space-y-2.5">
        <li
          v-for="payment in items"
          :key="payment.id"
          class="flex items-center justify-between gap-4 rounded-card border border-surface-border bg-surface-card px-4 py-3.5 sm:px-5"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span
                class="rounded-full px-2.5 py-0.5 text-body-sm font-semibold"
                :style="{
                  color: paymentStyles.method.style(payment.method).color,
                  backgroundColor: paymentStyles.method.style(payment.method).bg,
                }"
              >
                {{ paymentStyles.method.label(payment.method) }}
              </span>
              <span class="text-body-sm text-content-secondary">
                {{ payment.itemCount }} ачаанд
              </span>
            </div>
            <p class="mt-1 text-body-sm text-content-secondary">
              {{ formatDate(payment.createdAt) }}
            </p>
          </div>

          <p class="shrink-0 font-semibold tabular text-content">
            {{ formatCurrency(payment.amount) }}
          </p>
        </li>
      </ul>

      <UiPagination
        :page="pagination.page"
        :pages="pagination.pages"
        :total="pagination.total"
        :limit="pagination.limit"
        @update:page="page = $event"
      />
    </template>
  </div>
</template>
