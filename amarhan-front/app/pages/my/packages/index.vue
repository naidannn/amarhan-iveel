<script setup lang="ts">
import { Package } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'

/**
 * Миний ачаа — introduction.md §3
 *
 * §9.3 — шүүлт ба хуудаслалт ҮРГЭЛЖ backend руу query параметрээр явна.
 * Бүх ачааг татаж client талд шүүхийг хориглоно.
 */
definePageMeta({ middleware: 'customer' })

const portal = useCustomerPortal()
const { style, label, all: statuses } = usePackageStatus()

const page = ref(1)
const items = ref<any[]>([])
const pagination = ref({ page: 1, pages: 1, total: 0, limit: 20 })
const loading = ref(true)

/**
 * `'all'` нь тодорхой утга — хоосон мөр (`''`) ашиглаж БОЛОХГҮЙ: `SelectInput`
 * нь placeholder-даа `value=""`-г идэвхгүй сонголт болгон эзэмшдэг тул хоёр
 * сонголт мөргөлдөж, «бүх төлөв» рүү буцаж очих боломжгүй болно.
 */
const status = ref<string>('all')

const statusOptions = computed(() => [
  { value: 'all', label: 'Бүх төлөв' },
  ...Object.entries(statuses).map(([value, s]: [string, any]) => ({ value, label: s.label })),
])

async function load() {
  loading.value = true
  try {
    const result = await portal.packages({
      page: page.value,
      limit: 20,
      status: status.value === 'all' ? undefined : status.value,
    })
    items.value = result.data
    pagination.value = result.pagination
  } finally {
    loading.value = false
  }
}

// Шүүлт солигдоход эхний хуудас руу буцна — 5-р хуудсанд байхад шүүвэл
// хоосон жагсаалт харагдана
watch(status, () => {
  page.value = 1
})
watch([page, status], load)

onMounted(load)

useHead({ title: 'Миний ачаа — Ивээлт Карго' })
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-h1 font-bold text-content">Миний ачаа</h1>
        <p class="mt-1 text-body text-content-secondary">
          Нийт {{ pagination.total.toLocaleString('mn-MN') }} ачаа
        </p>
      </div>

      <UiSelectInput v-model="status" :options="statusOptions" class="w-full sm:w-52" />
    </div>

    <p v-if="loading" class="py-10 text-center text-body text-content-secondary">Ачаалж байна…</p>

    <div
      v-else-if="!items.length"
      class="rounded-card border border-surface-border bg-surface-card px-5 py-14 text-center"
    >
      <Package :size="34" class="mx-auto text-content-disabled" :stroke-width="1.6" />
      <p class="mt-3 text-body text-content">
        {{ status === 'all' ? 'Танд бүртгэгдсэн ачаа алга байна' : 'Энэ төлөвт ачаа алга' }}
      </p>
      <p class="mx-auto mt-1 max-w-sm text-body-sm text-content-secondary">
        Ачаа Монголд ирж, агуулахад бүртгэгдсэний дараа энд харагдана.
      </p>
    </div>

    <template v-else>
      <ul class="space-y-2.5">
        <li v-for="pkg in items" :key="pkg.id">
          <NuxtLink
            :to="`/my/packages/${pkg.id}`"
            class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-surface-border bg-surface-card px-4 py-3.5 transition-colors duration-200 hover:border-primary-300 sm:px-5"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold tabular text-content">{{ pkg.trackingNumber }}</p>
              <p class="text-body-sm text-content-secondary">
                {{ pkg.cargoType ?? 'Ачаа' }}
                <span v-if="pkg.weightKg"> · {{ pkg.weightKg }} кг</span>
                <span v-if="pkg.quantity > 1"> · {{ pkg.quantity }} ш</span>
              </p>
            </div>

            <div class="text-right">
              <p class="font-semibold tabular text-content">
                {{ formatCurrency(pkg.finalPrice) }}
              </p>
              <p v-if="pkg.balance > 0" class="text-body-sm tabular text-warning">
                {{ formatCurrency(pkg.balance) }} үлдэгдэлтэй
              </p>
              <p v-else class="text-body-sm text-success">Төлөгдсөн</p>
            </div>

            <span
              class="shrink-0 rounded-full px-2.5 py-1 text-body-sm font-semibold"
              :style="{ color: style(pkg.status).color, backgroundColor: style(pkg.status).bg }"
            >
              {{ label(pkg.status) }}
            </span>
          </NuxtLink>
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
