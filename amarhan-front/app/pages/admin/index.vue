<script setup lang="ts">
import {
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Package,
  RefreshCw,
  Truck,
} from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'
import { useDashboard, type DashboardSummary } from '~/composables/useDashboard'

definePageMeta({
  layout: 'admin',
  middleware: 'auth',
})

useHead({ title: 'Хяналтын самбар · Ивээл Карго' })

const api = useDashboard()
const toast = useToast()
const summary = ref<DashboardSummary | null>(null)
const loading = ref(true)
let refreshTimer: ReturnType<typeof setInterval> | null = null

/** Системийн бодит state machine-д харгалзах dashboard-ийн дараалал. */
const statusRows = [
  { key: 'in_erlian', label: 'Эрээнд урьдчилан бүртгэгдсэн', color: '#4338CA' },
  { key: 'registered', label: 'Монголд ирж бүртгэгдсэн', color: '#6B7280' },
  { key: 'notified', label: 'Мэдэгдсэн', color: '#0891B2' },
  { key: 'awaiting_payment', label: 'Төлбөр хүлээгдэж буй', color: '#B45309' },
  { key: 'paid', label: 'Төлбөр төлөгдсөн', color: '#0D9488' },
  { key: 'out_for_delivery', label: 'Хүргэлтэнд гарсан', color: '#355DFF' },
  { key: 'picked_up', label: 'Салбараас авсан', color: '#16A34A' },
  { key: 'delivered', label: 'Дууссан', color: '#16A34A' },
  { key: 'returned', label: 'Буцаагдсан', color: '#B45309' },
]

const kpis = computed(() => [
  {
    label: 'Ачааны тоо',
    value: summary.value?.packages.total ?? 0,
    icon: Package,
    accent: '#355DFF',
    to: '/admin/packages',
  },
  {
    label: 'Нийт орлого',
    value: formatCurrency(summary.value?.revenue.total ?? 0),
    hint: `${summary.value?.revenue.count ?? 0} баталгаажсан төлбөр`,
    icon: CircleDollarSign,
    accent: '#16A34A',
    to: '/admin/payments',
  },
  {
    label: 'Төлбөр хүлээгдэж буй',
    value: summary.value?.packages.awaitingPayment ?? 0,
    hint: `${formatCurrency(summary.value?.packages.outstandingAmount ?? 0)} үлдэгдэл`,
    icon: Clock3,
    accent: '#B45309',
    to: '/admin/packages?paymentStatus=unpaid',
  },
  {
    label: 'Төлбөр төлөгдсөн',
    value: summary.value?.packages.paid ?? 0,
    icon: CheckCircle2,
    accent: '#0D9488',
    to: '/admin/packages?paymentStatus=paid',
  },
])

const visibleStatuses = computed(() =>
  statusRows
    .map(status => ({
      ...status,
      count: summary.value?.packageStatuses[status.key] ?? 0,
    }))
    .filter(status => status.count > 0)
)

const largestQueue = computed(() =>
  visibleStatuses.value.reduce(
    (largest, current) => (current.count > largest.count ? current : largest),
    { label: 'Идэвхтэй ачаа байхгүй', count: 0 }
  )
)

async function load() {
  loading.value = true
  try {
    summary.value = await api.summary()
  } catch (error: any) {
    toast.error('Хяналтын самбар ачаалагдсангүй', { description: error.message })
  } finally {
    loading.value = false
  }
}

function updatedLabel() {
  if (!summary.value?.generatedAt) return ''
  return new Date(summary.value.generatedAt).toLocaleTimeString('mn-MN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(() => {
  load()
  // Server-ийн 60 секундийн aggregate cache-тэй тааруулна. Ингэснээр chart,
  // KPI нь өөрөө шинэчлэгдэх боловч бүртгэл/төлбөрийн урсгалд байнгын ачаалал үүсгэхгүй.
  refreshTimer = window.setInterval(() => {
    if (!loading.value) load()
  }, 60_000)
})

onBeforeUnmount(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>

<template>
  <div>
    <UiPageHeader title="Хяналтын самбар" subtitle="Үйл ажиллагааны бодит цагийн товч тойм">
      <template #actions>
        <span v-if="summary" class="hidden text-body-sm text-content-secondary sm:inline">
          {{ updatedLabel() }} шинэчлэгдсэн · 60 сек тутам
        </span>
        <UiBtn variant="secondary" :icon="RefreshCw" :loading="loading" @click="load">
          Сэргээх
        </UiBtn>
      </template>
    </UiPageHeader>

    <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <UiStatCard
        v-for="kpi in kpis"
        :key="kpi.label"
        :label="kpi.label"
        :value="kpi.value"
        :hint="kpi.hint"
        :icon="kpi.icon"
        :accent="kpi.accent"
        :loading="loading"
        :to="kpi.to"
      />
    </div>

    <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
      <section class="card xl:col-span-3">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 class="text-h4 text-content">Ачааны төлөв</h2>
            <p class="mt-1 text-body text-content-secondary">
              Хамгийн их ачаалал: <span class="font-semibold text-content">{{ largestQueue.label }}</span>
              <span class="tabular"> ({{ largestQueue.count.toLocaleString('mn-MN') }})</span>
            </p>
          </div>
          <NuxtLink to="/admin/packages" class="text-body-sm font-medium text-primary-600 hover:underline">
            Бүх ачаа харах
          </NuxtLink>
        </div>

        <div v-if="loading" class="mt-6 h-64 animate-pulse rounded-btn bg-surface-hover" />
        <div v-else class="mt-4 grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <DashboardStatusChart
            :statuses="visibleStatuses"
            :total="summary?.packages.total ?? 0"
          />
          <div class="grid max-h-64 gap-2 overflow-y-auto pr-1">
            <div
              v-for="status in visibleStatuses"
              :key="status.key"
              class="flex items-center justify-between gap-3 rounded-btn px-2 py-1.5 hover:bg-surface-hover"
            >
              <span class="flex min-w-0 items-center gap-2 text-body-sm text-content-secondary">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: status.color }" />
                <span class="truncate">{{ status.label }}</span>
              </span>
              <span class="tabular shrink-0 text-body-sm font-semibold text-content">
                {{ status.count.toLocaleString('mn-MN') }} · {{ Math.round((status.count / (summary?.packages.total || 1)) * 100) }}%
              </span>
            </div>
            <p v-if="visibleStatuses.length === 0" class="py-8 text-center text-body text-content-secondary">
              Одоогоор идэвхтэй ачаа байхгүй байна
            </p>
          </div>
        </div>
      </section>

      <section class="card xl:col-span-2">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-h4 text-content">Хүргэлтийн мэдээлэл</h2>
            <p class="mt-1 text-body text-content-secondary">Өнөөдөр товлосон хүргэлтүүд</p>
          </div>
          <div class="flex h-10 w-10 items-center justify-center rounded-btn bg-primary-50 text-primary-600">
            <Truck :size="20" />
          </div>
        </div>

        <div class="mt-6 grid grid-cols-3 divide-x divide-surface-border">
          <div class="pr-3">
            <p class="text-body-sm text-content-secondary">Өнөөдөр хүргэлт</p>
            <p v-if="loading" class="mt-2 h-8 w-12 animate-pulse rounded bg-surface-hover" />
            <p v-else class="tabular mt-1 text-h3 text-content">
              {{ (summary?.deliveries.total ?? 0).toLocaleString('mn-MN') }}
            </p>
          </div>
          <div class="px-3">
            <p class="text-body-sm text-content-secondary">Хүргэгдсэн</p>
            <p v-if="loading" class="mt-2 h-8 w-12 animate-pulse rounded bg-surface-hover" />
            <p v-else class="tabular mt-1 text-h3 text-success">
              {{ (summary?.deliveries.delivered ?? 0).toLocaleString('mn-MN') }}
            </p>
          </div>
          <div class="pl-3">
            <p class="text-body-sm text-content-secondary">Хүлээгдэж буй</p>
            <p v-if="loading" class="mt-2 h-8 w-12 animate-pulse rounded bg-surface-hover" />
            <p v-else class="tabular mt-1 text-h3 text-warning">
              {{ (summary?.deliveries.pending ?? 0).toLocaleString('mn-MN') }}
            </p>
          </div>
        </div>
      </section>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section class="card">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-h4 text-content">Орлого</h2>
            <p class="mt-1 text-body text-content-secondary">Сүүлийн 30 хоногийн өдөр тутмын орлого</p>
          </div>
          <span class="rounded-full bg-success/10 px-2.5 py-1 text-body-sm font-medium text-success">
            {{ formatCurrency(summary?.daily.reduce((total, day) => total + day.revenue, 0) ?? 0) }}
          </span>
        </div>
        <DashboardTrendChart
          class="mt-5"
          :points="summary?.daily ?? []"
          field="revenue"
          label="Өдөр тутмын орлого"
          color="#16A34A"
          :loading="loading"
          :value-label="value => formatCurrency(value)"
        />
      </section>

      <section class="card">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-h4 text-content">Ирсэн ачаа</h2>
            <p class="mt-1 text-body text-content-secondary">Сүүлийн 30 хоногийн өдөр тутмын ирц</p>
          </div>
          <span class="rounded-full bg-primary-50 px-2.5 py-1 text-body-sm font-medium text-primary-600">
            {{ (summary?.daily.reduce((total, day) => total + day.packages, 0) ?? 0).toLocaleString('mn-MN') }}
            ачаа
          </span>
        </div>
        <DashboardTrendChart
          class="mt-5"
          :points="summary?.daily ?? []"
          field="packages"
          label="Өдөр бүр ирсэн ачаа"
          color="#355DFF"
          :loading="loading"
          :value-label="value => `${value.toLocaleString('mn-MN')} ачаа`"
        />
      </section>
    </div>
  </div>
</template>
