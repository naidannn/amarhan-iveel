<script setup lang="ts">
import { BarChart3, CalendarDays, CircleDollarSign, Clock3, Package, RefreshCw, Scale, Wallet } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/currency'
import { useReports, type ReportPeriod, type ReportsSummary } from '~/composables/useReports'
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '~/composables/useExpenses'
import type { Column } from '~/components/ui/DataTable.vue'

definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Тайлан — Ивээл Карго' })

const api = useReports()
const toast = useToast()
const report = ref<ReportsSummary | null>(null)
const loading = ref(true)
const period = ref<ReportPeriod>('30d')
const cargoChart = ref<'daily' | 'monthly' | 'weekly'>('daily')
const revenueChart = ref<'daily' | 'monthly' | 'yearly'>('daily')

/**
 * Тайлан бүрийг ТУСДАА табаар харуулна — өмнө нь бүгд нэг хуудсанд эгнэж,
 * доошоо их скролдох шаардлагатай байсныг засав. Хугацааны сонголт (доор)
 * бүх табд НИЙТЛЭГ хэвээр — API нэг хүсэлтээр бүх тайланг авчирдаг тул
 * таб солиход дахин ачаалахгүй, зөвхөн харагдацыг сэлгэнэ.
 */
type ReportTab = 'cargo' | 'revenue' | 'payments' | 'efficiency'
const activeTab = ref<ReportTab>('cargo')
const tabs: Array<{ key: ReportTab; label: string; icon: any }> = [
  { key: 'cargo', label: 'Ачаа', icon: Package },
  { key: 'revenue', label: 'Орлого', icon: CircleDollarSign },
  { key: 'payments', label: 'Төлбөр', icon: Wallet },
  { key: 'efficiency', label: 'Үр ашиг', icon: Scale },
]

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

// BR-47a — өдрийн үр ашгийн тайлан: "олох ёстой орлого" vs зарлага vs ашиг.
// Зөвхөн ӨДРИЙН цонх (сар/жилийн задаргаа шаардлагагүй, sub-tab байхгүй).
const efficiencyChartData = computed(() => {
  if (!report.value) return { labels: [], datasets: [] }
  const { packageRevenue, expenses, profit } = report.value.efficiency
  const labels = Object.keys(packageRevenue.daily).sort()
  return {
    labels: labels.map(formatDayLabel),
    datasets: [
      { label: 'Ачааны орлого', data: labels.map(label => packageRevenue.daily[label]), color: '#355DFF' },
      { label: 'Зарлага', data: labels.map(label => expenses.daily[label]), color: '#DC2626' },
      { label: 'Цэвэр үр дүн', data: labels.map(label => profit.daily[label]), color: '#16A34A' },
    ],
  }
})

const expenseCategoryRows = computed(() => {
  if (!report.value) return []
  return Object.entries(report.value.efficiency.expenses.byCategory)
    .map(([key, value]) => ({
      key,
      label: EXPENSE_CATEGORY_LABELS[key as ExpenseCategory] ?? key,
      ...value,
    }))
    .sort((a, b) => b.value - a.value)
})

/** Хүснэгт хамгийн СҮҮЛИЙН өдрөөс эхэлж харуулна — графикийн (өсөх) дарааллаас ЗОРИУДААР эсрэг */
interface EfficiencyRow {
  date: string
  revenue: number
  expense: number
  profit: number
}
const efficiencyTableColumns: Column<EfficiencyRow>[] = [
  { key: 'date', label: 'Огноо', tabular: true, mobileTitle: true },
  { key: 'revenue', label: 'Ачааны орлого', align: 'right', tabular: true },
  { key: 'expense', label: 'Зарлага', align: 'right', tabular: true },
  { key: 'profit', label: 'Цэвэр ашиг', align: 'right', tabular: true },
]
const efficiencyTableRows = computed<EfficiencyRow[]>(() => {
  if (!report.value) return []
  const { packageRevenue, expenses, profit } = report.value.efficiency
  return Object.keys(packageRevenue.daily)
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({
      date,
      revenue: packageRevenue.daily[date] ?? 0,
      expense: expenses.daily[date] ?? 0,
      profit: profit.daily[date] ?? 0,
    }))
})

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

function formatDateLabel(value: string) {
  const [year, month, day] = value.split('-')
  return `${year}.${month}.${day}`
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

    <!-- Тайлан бүр ТУСДАА таб — нэг дор бүгдийг эгнүүлбэл хэт удаан скролдох болсон -->
    <div class="mb-4 flex flex-wrap gap-1 rounded-card border border-surface-border bg-surface-card p-1.5 shadow-card">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="flex items-center gap-2 rounded-btn px-4 py-2 text-body-sm font-medium transition-colors"
        :class="activeTab === tab.key ? 'bg-primary-50 text-primary-600' : 'text-content-secondary hover:text-content hover:bg-surface-hover'"
        :aria-pressed="activeTab === tab.key"
        @click="activeTab = tab.key"
      >
        <component :is="tab.icon" :size="16" :stroke-width="2" />
        {{ tab.label }}
      </button>
    </div>

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

    <section v-if="activeTab === 'cargo'">
      <div class="mb-4 flex items-center gap-2">
        <Package :size="20" class="text-primary-600" />
        <div>
          <h2 class="text-h4 text-content">Ачааны тайлан</h2>
          <p class="text-body-sm text-content-secondary">Одоогийн үлдэгдэл болон сонгосон хугацааны ирц</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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

    <section v-else-if="activeTab === 'revenue'">
      <div class="mb-4 flex items-center gap-2">
        <CircleDollarSign :size="20" class="text-success" />
        <div>
          <h2 class="text-h4 text-content">Орлогын тайлан</h2>
          <p class="text-body-sm text-content-secondary">Баталгаажсан төлбөрөөр тооцсон орлого</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
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

    <section v-else-if="activeTab === 'payments'" class="pb-4">
      <div class="mb-4 flex items-center gap-2">
        <Wallet :size="20" class="text-warning" />
        <div>
          <h2 class="text-h4 text-content">Төлбөрийн тайлан</h2>
          <p class="text-body-sm text-content-secondary">Төлөөгүй үлдэгдлийг ачаа Монголд ирсэн өдрөөр ангилна</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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

    <section v-else-if="activeTab === 'efficiency'" class="pb-4">
      <div class="mb-4 flex items-center gap-2">
        <Scale :size="20" class="text-primary-600" />
        <div>
          <h2 class="text-h4 text-content">Үр ашгийн тайлан</h2>
          <p class="text-body-sm text-content-secondary">
            Тухайн өдөр бүртгэгдсэн ачааны олох ёстой орлого (төлбөр орсон эсэхээс үл хамааран)
            ба тухайн өдрийн зарлагыг харьцуулна
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <UiStatCard
          label="Ачааны орлого (бүртгэсэн)"
          :value="formatCurrency(report?.efficiency.packageRevenue.total ?? 0)"
          :hint="`${report?.efficiency.packageRevenue.count ?? 0} ачаа · төлбөр орсон эсэхээс үл хамааран`"
          :icon="Package"
          accent="#355DFF"
          :loading="loading"
        />
        <UiStatCard
          label="Зарлага"
          :value="formatCurrency(report?.efficiency.expenses.total ?? 0)"
          :hint="`${report?.efficiency.expenses.count ?? 0} бүртгэл`"
          :icon="Wallet"
          accent="#DC2626"
          :loading="loading"
        />
        <UiStatCard
          label="Цэвэр үр дүн"
          :value="formatCurrency(report?.efficiency.profit.total ?? 0)"
          hint="Ачааны орлого − Зарлага"
          :icon="Scale"
          :accent="(report?.efficiency.profit.total ?? 0) >= 0 ? '#16A34A' : '#DC2626'"
          :loading="loading"
        />
      </div>

      <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div class="card xl:col-span-3">
          <h3 class="text-h4 text-content">Өдөр бүрийн орлого, зарлага, ашиг</h3>
          <p class="mt-1 text-body-sm text-content-secondary">Сүүлийн 30 хүртэлх хоног</p>
          <ReportTrendChart
            class="mt-5"
            :labels="efficiencyChartData.labels"
            :datasets="efficiencyChartData.datasets"
            type="line"
            :loading="loading"
            :value-label="formatCurrency"
          />
        </div>

        <div class="card xl:col-span-2">
          <h3 class="text-h4 text-content">Зарлагын ангилал</h3>
          <p class="mt-1 text-body-sm text-content-secondary">Сонгосон хугацааны задаргаа</p>
          <div v-if="expenseCategoryRows.length === 0" class="mt-5 text-body-sm text-content-secondary">
            Энэ хугацаанд зарлага бүртгэгдээгүй
          </div>
          <div v-else class="mt-5 divide-y divide-surface-border">
            <div
              v-for="row in expenseCategoryRows"
              :key="row.key"
              class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span class="text-body text-content-secondary">{{ row.label }}</span>
              <span class="text-right">
                <strong class="tabular block text-body text-content">{{ formatCurrency(row.value) }}</strong>
                <small class="text-body-sm text-content-secondary">{{ row.count }} бүртгэл</small>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Өдөр бүрээр дэлгэрэнгүй хүснэгт — графикийг дэмжинэ, тоог нарийн харах -->
      <div class="mt-6">
        <h3 class="mb-3 text-h4 text-content">Өдөр бүрийн задаргаа</h3>
        <UiDataTable
          :columns="efficiencyTableColumns"
          :rows="efficiencyTableRows"
          row-key="date"
          :loading="loading"
          empty-text="Энэ хугацаанд өгөгдөл алга"
        >
          <template #cell-date="{ row }">
            <span class="text-content">{{ formatDateLabel(row.date) }}</span>
          </template>
          <template #cell-revenue="{ row }">
            <span class="text-content">{{ formatCurrency(row.revenue) }}</span>
          </template>
          <template #cell-expense="{ row }">
            <span :class="row.expense > 0 ? 'text-error' : 'text-content-secondary'">{{ formatCurrency(row.expense) }}</span>
          </template>
          <template #cell-profit="{ row }">
            <span class="font-semibold" :class="row.profit >= 0 ? 'text-success' : 'text-error'">{{ formatCurrency(row.profit) }}</span>
          </template>
        </UiDataTable>
      </div>
    </section>
  </div>
</template>
