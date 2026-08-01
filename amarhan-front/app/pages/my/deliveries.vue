<script setup lang="ts">
import { Truck } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'

/**
 * Хүргэлтийн түүх — introduction.md §5
 *
 * Харилцагч ӨӨРӨӨ хүргэлт захиалах (roadmap 5.8) хараахан хэрэгжээгүй —
 * одоогоор ажилтан үүсгэсэн хүргэлтийг ХАРАХ л боломжтой.
 */
definePageMeta({ middleware: 'customer' })

const portal = useCustomerPortal()
const { style, label } = useDeliveryStatus()

const page = ref(1)
const items = ref<any[]>([])
const pagination = ref({ page: 1, pages: 1, total: 0, limit: 20 })
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const result = await portal.deliveries({ page: page.value, limit: 20 })
    items.value = result.data
    pagination.value = result.pagination
  } finally {
    loading.value = false
  }
}

watch(page, load)
onMounted(load)

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

useHead({ title: 'Хүргэлт — Ивээлт Карго' })
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-h1 font-bold text-content">Хүргэлт</h1>
      <p class="mt-1 text-body text-content-secondary">
        Нийт {{ pagination.total.toLocaleString('mn-MN') }} хүргэлт
      </p>
    </div>

    <p v-if="loading" class="py-10 text-center text-body text-content-secondary">Ачаалж байна…</p>

    <div
      v-else-if="!items.length"
      class="rounded-card border border-surface-border bg-surface-card px-5 py-14 text-center"
    >
      <Truck :size="34" class="mx-auto text-content-disabled" :stroke-width="1.6" />
      <p class="mt-3 text-body text-content">Хүргэлтийн бүртгэл алга байна</p>
      <p class="mx-auto mt-1 max-w-sm text-body-sm text-content-secondary">
        Хүргэлт захиалахыг хүсвэл ажилтантай холбогдоно уу.
      </p>
    </div>

    <template v-else>
      <ul class="space-y-2.5">
        <li
          v-for="delivery in items"
          :key="delivery.id"
          class="rounded-card border border-surface-border bg-surface-card px-4 py-4 sm:px-5"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold tabular text-content">{{ delivery.deliveryNumber }}</p>
              <p class="mt-0.5 text-body-sm text-content-secondary">
                {{ delivery.packageCount }} ачаа
                <span v-if="delivery.fee"> · {{ formatCurrency(delivery.fee) }} хүргэлтийн төлбөр</span>
              </p>
            </div>
            <span
              class="shrink-0 rounded-full px-2.5 py-1 text-body-sm font-semibold"
              :style="{
                color: style(delivery.status).color,
                backgroundColor: style(delivery.status).bg,
              }"
            >
              {{ label(delivery.status) }}
            </span>
          </div>

          <dl class="mt-3 grid gap-2 border-t border-surface-border pt-3 sm:grid-cols-3">
            <div class="sm:col-span-2">
              <dt class="text-body-sm text-content-secondary">Хаяг</dt>
              <dd class="text-body text-content">{{ delivery.address }}</dd>
            </div>
            <div>
              <dt class="text-body-sm text-content-secondary">Товлосон огноо</dt>
              <dd class="text-body tabular text-content">{{ formatDate(delivery.scheduledDate) }}</dd>
            </div>
          </dl>
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
