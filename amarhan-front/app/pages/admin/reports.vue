<script setup lang="ts">
import { BarChart3, CalendarDays, CircleDollarSign, Clock3, Package, RefreshCw, Wallet } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'
import { useReports, type ReportPeriod, type ReportsSummary } from '~/composables/useReports'

definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Тайлан — Ивээл Карго' })

const api = useReports()
const toast = useToast()
const report = ref<ReportsSummary | null>(null)
const loading = ref(true)
const period = ref<ReportPeriod>('30d')
const cargoChart = ref<'daily' | 'monthly' | 'weekly'>('daily')
const revenueChart = ref<'daily' | 'monthly' | 'yearly'>('daily')

const periodOptions: Array<{ value: ReportPeriod; label: string }> = [
  { value: '7d', label: '7 хоног' },
  { value: '30d', label: '30 хоног' },
  { value: '12m', label: '12 сар' },
]

const cargoTabs = [
  { value: 'daily' as const, label: 'Өдөр бүр' },
  { value: 'monthly' as const, label: 'Сар бүр' },
  { value: 'weekly' as const, label: '7 хоног' },
]

const revenueTabs = [
  { value: 'daily' as const, label: 'Өдөр бүр' },
  { value: 'monthly' as const, label: 'Сар бүр' },
  { value: 'yearly' as const, label: 'Жил бүр' },
]

const cargoGrowth = computed(() => growthPercent(report.value?.cargo.arrivals ?? 0, report.value?.cargo.previousArrivals ?? 0))

const cargoChartData = computed(() => {
  if (!report.value) return { title: '', subtitle: '', labels: [], datasets: [] }

  if (cargoChart.value === 'weekly') {
    const labels = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня']
    return {
      title: '7 хоногийн харьцуулалт',
      subtitle: 'Энэ долоо хоног болон өмнөх 7 хоногийн ирсэн ачаа',
      labels,
      datasets: [
        { label: 'Энэ 7 хоног', data: labels.map((_, index) => report.value?.cargo.weekly.current[String(index + 1)] ?? 0), color: '#355DFF' },
        { label: 'Өмнөх 7 хоног', data: labels.map((_, index) => report.value?.cargo.weekly.previous[String(index + 1)] ?? 0), color: '#94A3B8' },
      ],
    }
  }

  const values = cargoChart.value === 'daily' ? report.value.cargo.daily : report.value.cargo.monthly
  const labels = Object.keys(values).sort()
  return {
    title: cargoChart.value === 'daily' ? 'Өдөр бүрийн ачааны тоо' : 'Сар бүрийн өсөлт',
    subtitle: cargoChart.value === 'daily' ? 'Сүүлийн 30 хүртэлх хоногийн ирсэн ачаа' : 'Сүүлийн 12 сарын ирсэн ачаа',
    labels: labels.map(cargoChart.value === 'daily' ? formatDayLabel : formatMonthLabel),
    datasets: [{ label: 'Ирсэн ачаа', data: labels.map(label => values[label]), color: '#355DFF' }],
  }
})

const revenueChartData = computed(() => {
  if (!report.value) return { title: '', subtitle: '', labels: [], datasets: [] }
  const values = report.value.revenue[revenueChart.value]
  const labels = Object.keys(values).sort()
  const meta = {
    daily: { title: 'Өдөр бүрийн орлого', subtitle: 'Сүүлийн 30 хүртэлх хоногийн баталгаажсан орлого' },
    monthly: { title: 'Сар бүрийн орлого', subtitle: 'Сүүлийн 12 сарын баталгаажсан орлого' },
    yearly: { title: 'Жил бүрийн орлого', subtitle: 'Сүүлийн 4 жилийн баталгаажсан орлого' },
  }[revenueChart.value]
  const labelFormatter = revenueChart.value === 'daily' ? formatDayLabel : revenueChart.value === 'monthly' ? formatMonthLabel : (label: string) => label

  return {
    ...meta,
    labels: labels.map(labelFormatter),
    datasets: [{ label: 'Орлого', data: labels.map(label => values[label]), color: '#16A34A' }],
  }
})

const agingBuckets = [
  { key: '0-3', label: '0–3 өдөр' },
  { key: '4-7', label: '4–7 өдөр' },
  { key: '7+', label: '7+ өдөр' },
]
const agingLabels = agingBuckets.map(bucket => bucket.label)
const agingData = computed(() =>
  agingBuckets.map(bucket => report.value?.payments.aging[bucket.key]?.value ?? 0)
)

const methods = [
  { key: 'cash', label: 'Бэлэн', color: '#16A34A' },
  { key: 'qpay', label: 'QPay', color: '#7C3AED' },
  { key: 'bank', label: 'Банк', color: '#0891B2' },
  { key: 'card', label: 'Карт', color: '#B45309' },
]

async function load() {
  loading.value = true
  try {
    report.value = await api.summary(period.value)
  } catch (error: any) {
    toast.error('Тайлан ачаалагдсангүй', { description: error.message })
  } finally {
    loading.value = false
  }
}

function selectPeriod(value: ReportPeriod) {
  if (period.value === value) return
  period.value = value
  load()
}

function growthPercent(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function formatDayLabel(value: string) {
  const [, month, day] = value.split('-')
  return `${Number(month)}/${Number(day)}`
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split('-')
  return `${year.slice(2)}.${month}`
}

function generatedLabel() {
  if (!report.value?.generatedAt) return ''
  return new Date(report.value.generatedAt).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(load)
</script>

<template>
  <div>
    <UiPageHeader title="Тайлан" subtitle="Ачаа, орлого, төлбөрийн нэгтгэсэн хяналт">
      <template #actions>
        <span v-if="report" class="hidden text-body-sm text-content-secondary xl:inline">
          {{ generatedLabel() }} шинэчлэгдсэн · {{ report.cacheTtlSeconds / 60 }} мин кэш
        </span>
        <UiBtn variant="secondary" :icon="RefreshCw" :loading="loading" @click="load">Сэргээх</UiBtn>
      </template>
    </UiPageHeader>

    <div class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-surface-border bg-surface-card p-3 shadow-card">
      <div class="flex items-center gap-2 text-body-sm font-medium text-content-secondary">
        <CalendarDays :size="18" class="text-primary-600" />
        Тайлангийн хугацаа
      </div>
      <div class="flex rounded-btn bg-surface-hover p-1">
        <button
          v-for="option in periodOptions"
          :key="option.value"
          class="rounded-btn px-3 py-1.5 text-body-sm font-medium transition-colors"
          :class="period === option.value ? 'bg-surface-card text-primary-600 shadow-card' : 'text-content-secondary hover:text-content'"
          :aria-pressed="period === option.value"
          @click="selectPeriod(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <section>
      <div class="mb-4 flex items-center gap-2">
        <Package :size="20" class="text-primary-600" />
        <div>
          <h2 class="text-h4 text-content">Ачааны тайлан</h2>
          <p class="text-body-sm text-content-secondary">Одоогийн үлдэгдэл болон сонгосон хугацааны ирц</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UiStatCard label="Нийт ачаа" :value="(report?.cargo.total ?? 0).toLocaleString('mn-MN')" :hint="`${cargoGrowth >= 0 ? '+' : ''}${cargoGrowth}% өмнөх үеэс`" :icon="Package" accent="#355DFF" :loading="loading" />
        <UiStatCard label="Ирсэн ачаа" :value="(report?.cargo.arrivals ?? 0).toLocaleString('mn-MN')" :hint="`${periodOptions.find(option => option.value === period)?.label}т`" :icon="BarChart3" accent="#0891B2" :loading="loading" />
        <UiStatCard label="Олгосон ачаа" :value="(report?.cargo.issued ?? 0).toLocaleString('mn-MN')" hint="Одоогоор олгосон/хүргэгдсэн" :icon="Package" accent="#16A34A" :loading="loading" />
        <UiStatCard label="Үлдэгдэл ачаа" :value="(report?.cargo.remaining ?? 0).toLocaleString('mn-MN')" hint="Агуулах, хүргэлтийн урсгалд" :icon="Clock3" accent="#B45309" :loading="loading" />
      </div>

      <div class="card mt-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="text-h4 text-content">{{ cargoChartData.title }}</h3>
            <p class="mt-1 text-body-sm text-content-secondary">{{ cargoChartData.subtitle }}</p>
          </div>
          <div class="flex rounded-btn bg-surface-hover p-1">
            <button v-for="tab in cargoTabs" :key="tab.value" class="rounded-btn px-2.5 py-1.5 text-body-sm font-medium" :class="cargoChart === tab.value ? 'bg-surface-card text-primary-600 shadow-card' : 'text-content-secondary hover:text-content'" @click="cargoChart = tab.value">{{ tab.label }}</button>
          </div>
        </div>
        <ReportTrendChart class="mt-5" :labels="cargoChartData.labels" :datasets="cargoChartData.datasets" :type="cargoChart === 'daily' ? 'line' : 'bar'" :loading="loading" :value-label="value => `${value.toLocaleString('mn-MN')} ачаа`" />
      </div>
    </section>

    <section class="mt-10">
      <div class="mb-4 flex items-center gap-2">
        <CircleDollarSign :size="20" class="text-success" />
        <div>
          <h2 class="text-h4 text-content">Орлогын тайлан</h2>
          <p class="text-body-sm text-content-secondary">Баталгаажсан төлбөрөөр тооцсон орлого</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <UiStatCard label="Нийт орлого" :value="formatCurrency(report?.revenue.total ?? 0)" :hint="`${report?.revenue.count ?? 0} төлбөр`" :icon="CircleDollarSign" accent="#16A34A" :loading="loading" />
        <UiStatCard label="Өдрийн дундаж" :value="formatCurrency(Math.round((report?.revenue.total ?? 0) / (period === '7d' ? 7 : period === '30d' ? 30 : 365)))" :icon="CalendarDays" accent="#0891B2" :loading="loading" />
        <UiStatCard label="Ачааны дундаж" :value="formatCurrency(report?.revenue.averagePerPackage ?? 0)" hint="Төлөгдсөн ачаагаар" :icon="Package" accent="#355DFF" :loading="loading" />
        <UiStatCard label="Буцаалт" :value="formatCurrency(report?.revenue.refunds ?? 0)" hint="Хүчингүй болсон төлбөр" :icon="RefreshCw" accent="#B45309" :loading="loading" />
        <UiStatCard label="Хөнгөлөлт" :value="formatCurrency(report?.revenue.discounts ?? 0)" hint="Тооцоолсон үнээс буурсан" :icon="Wallet" accent="#7C3AED" :loading="loading" />
      </div>

      <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div class="card xl:col-span-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="text-h4 text-content">{{ revenueChartData.title }}</h3>
              <p class="mt-1 text-body-sm text-content-secondary">{{ revenueChartData.subtitle }}</p>
            </div>
            <div class="flex rounded-btn bg-surface-hover p-1">
              <button v-for="tab in revenueTabs" :key="tab.value" class="rounded-btn px-2.5 py-1.5 text-body-sm font-medium" :class="revenueChart === tab.value ? 'bg-surface-card text-success shadow-card' : 'text-content-secondary hover:text-content'" @click="revenueChart = tab.value">{{ tab.label }}</button>
            </div>
          </div>
          <ReportTrendChart class="mt-5" :labels="revenueChartData.labels" :datasets="revenueChartData.datasets" :type="revenueChart === 'daily' ? 'line' : 'bar'" :loading="loading" :value-label="formatCurrency" />
        </div>

        <div class="card xl:col-span-2">
          <h3 class="text-h4 text-content">Төлбөрийн хэлбэр</h3>
          <p class="mt-1 text-body-sm text-content-secondary">Сонгосон хугацааны орлогын задаргаа</p>
          <div class="mt-5 divide-y divide-surface-border">
            <div v-for="method in methods" :key="method.key" class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <span class="flex items-center gap-2 text-body text-content-secondary"><span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: method.color }" />{{ method.label }}</span>
              <span class="text-right"><strong class="tabular block text-body text-content">{{ formatCurrency(report?.revenue.methods[method.key]?.value ?? 0) }}</strong><small class="text-body-sm text-content-secondary">{{ report?.revenue.methods[method.key]?.count ?? 0 }} төлбөр</small></span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mt-10 pb-4">
      <div class="mb-4 flex items-center gap-2">
        <Wallet :size="20" class="text-warning" />
        <div>
          <h2 class="text-h4 text-content">Төлбөрийн тайлан</h2>
          <p class="text-body-sm text-content-secondary">Төлөөгүй үлдэгдлийг ачаа Монголд ирсэн өдрөөр ангилна</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UiStatCard label="Төлөгдсөн төлбөр" :value="formatCurrency(report?.revenue.total ?? 0)" :hint="`${report?.revenue.count ?? 0} баталгаажсан төлбөр`" :icon="Wallet" accent="#16A34A" :loading="loading" />
        <UiStatCard label="Хүлээгдэж буй" :value="formatCurrency(report?.payments.pending ?? 0)" :hint="`${report?.payments.pendingCount ?? 0} ачаа`" :icon="Clock3" accent="#B45309" :loading="loading" />
        <UiStatCard label="Хугацаа хэтэрсэн" :value="formatCurrency(report?.payments.overdue ?? 0)" :hint="`${report?.payments.overdueCount ?? 0} ачаа · 7+ өдөр`" :icon="Clock3" accent="#DC2626" :loading="loading" />
        <UiStatCard label="Дундаж төлөх хугацаа" :value="`${report?.payments.averageDays ?? 0} өдөр`" hint="Бүрэн төлөгдсөн ачаа" :icon="CalendarDays" accent="#7C3AED" :loading="loading" />
      </div>

      <div class="card mt-6">
        <div>
          <h3 class="text-h4 text-content">Төлбөрийн насжилт</h3>
          <p class="mt-1 text-body-sm text-content-secondary">Төлөөгүй үлдэгдлийн дүнгээр</p>
        </div>
        <ReportTrendChart class="mt-5" :labels="agingLabels" :datasets="[{ label: 'Үлдэгдэл', data: agingData, color: '#B45309' }]" type="bar" :loading="loading" :value-label="formatCurrency" />
      </div>
    </section>
  </div>
</template>
