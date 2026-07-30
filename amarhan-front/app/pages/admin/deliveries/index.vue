<script setup lang="ts">
import { Search, X, RefreshCw, Plus, Truck, CalendarDays } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import {
  useDeliveries,
  DELIVERY_ERROR_CODE,
  type Delivery,
  type DeliverySummary,
} from '~/composables/useDeliveries'
import type { Pagination } from '~/composables/usePackages'

/**
 * Хүргэлтийн жагсаалт ба өдрийн маршрут — introduction.md §5 (roadmap 4.5)
 *
 * ХОЁР ГОРИМ нэг хуудсанд:
 *   «Бүх хүргэлт» — эрэмбэ, шүүлт, хайлт
 *   «Өдрийн маршрут» — товлосон огноогоор шүүж, олноор нэг дор гаргах
 *
 * Тусад нь хуудас болговол ажилтан өглөө нэг хуудас, өдөржин нөгөөг нь
 * харах болно. Огнооны шүүлт нь хоёуланг холбоно.
 *
 * ЧУХАЛ (§9.3): шүүлт, хуудаслалт БҮГД server талд (CLAUDE.md §5 дүрэм 5).
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Хүргэлт — Ивээл Карго' })

const api = useDeliveries()
const toast = useToast()
const styles = useDeliveryStatus()

const rows = ref<Delivery[]>([])
const pagination = ref<Pagination>({ page: 1, pages: 1, total: 0, limit: 50 })
const summary = ref<DeliverySummary>({ total: 0, packageCount: 0, byStatus: {} })
const loading = ref(true)
const busy = ref(false)

/** Өнөөдрийн огноог `YYYY-MM-DD` хэлбэрээр — `toISOString()` нь UTC руу шилжүүлж өдөр алдана */
function todayISO() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const routeMode = ref(false)
const routeDate = ref(todayISO())

const filters = reactive({
  phone: '',
  deliveryNumber: '',
  status: '' as string,
  sort: '-createdAt',
  page: 1,
  limit: 50,
})

const statusOptions = computed(() => [
  { value: '', label: 'Бүх төлөв' },
  ...Object.entries(styles.all).map(([value, style]) => ({ value, label: style.label })),
])

const activeFilterCount = computed(
  () => [filters.phone, filters.deliveryNumber, filters.status].filter(Boolean).length
)

/**
 * Өдрийн маршрутын горимд товлосон огнооны хязгаарыг нэмнэ.
 * Хязгаарыг ЭНД бодож байгаа шалтгаан: цагийн бүсийн шилжилтийг нэг газарт
 * барихгүй бол «өнөөдөр» гэдэг нь backend, frontend-д өөр өдөр болно.
 */
function dateRange() {
  if (!routeMode.value || !routeDate.value) return {}
  return {
    scheduledFrom: new Date(`${routeDate.value}T00:00:00`).toISOString(),
    scheduledTo: new Date(`${routeDate.value}T23:59:59.999`).toISOString(),
  }
}

async function load() {
  loading.value = true
  try {
    const params = { ...filters, ...dateRange() }
    const [list, sums] = await Promise.all([api.list(params), api.summary(dateRange())])
    rows.value = list.data
    pagination.value = list.pagination
    summary.value = sums
  } catch (e: any) {
    toast.error('Жагсаалт ачаалагдсангүй', { description: e.message })
    rows.value = []
  } finally {
    loading.value = false
  }
}

const debouncedLoad = useDebounceFn(load, 300)

watch(
  () => [filters.phone, filters.deliveryNumber, filters.status],
  () => {
    filters.page = 1
    debouncedLoad()
  }
)

watch(() => [filters.page, filters.sort], load)

watch([routeMode, routeDate], () => {
  filters.page = 1
  // Маршрутын горимд «үүссэн» хүргэлтүүд л сонирхолтой — гаргах ажил тэднийх
  if (routeMode.value && !filters.status) filters.status = 'created'
  load()
})

onMounted(load)

function resetFilters() {
  filters.phone = ''
  filters.deliveryNumber = ''
  filters.status = ''
}

// ── Олноор гаргах (§5 — өдрийн маршрут) ──────────────────────────────────

const selected = ref<string[]>([])

/** Зөвхөн ГАРГАХ боломжтой хүргэлтийг сонгоно — бусад нь сонголтод утгагүй */
const dispatchable = computed(() => rows.value.filter(d => d.status === 'created'))

const allSelected = computed(
  () => dispatchable.value.length > 0 && selected.value.length === dispatchable.value.length
)

function toggleAll() {
  selected.value = allSelected.value ? [] : dispatchable.value.map(d => d.id)
}

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter(x => x !== id)
    : [...selected.value, id]
}

/**
 * §5.2 — багц бүрийг backend ТУСАД нь шалгана. Төлбөр дутуу хүргэлт
 * амжилтгүй болж, бусад нь гарна. Амжилтгүйг ЧИМЭЭГҮЙ алгасахгүй —
 * ажилтан аль хүргэлт гараагүйг мэдэх ёстой.
 */
async function dispatchSelected() {
  if (selected.value.length === 0) return

  busy.value = true
  try {
    const result = await api.changeStatusBulk(selected.value, 'dispatched')

    if (result.succeeded.length) {
      toast.success(`${result.succeeded.length} хүргэлт гарлаа`)
    }
    if (result.failed.length) {
      const unpaid = result.failed.filter(f => f.code === DELIVERY_ERROR_CODE.UNPAID_PACKAGES)
      toast.error(`${result.failed.length} хүргэлт гарсангүй`, {
        description: unpaid.length
          ? `${unpaid.length} хүргэлтэд төлбөр дутуу: ${unpaid[0]?.message}`
          : result.failed[0]?.message,
        duration: 10000,
      })
    }

    selected.value = []
    await load()
  } catch (e: any) {
    toast.error('Гаргах боломжгүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

// ── Харуулах туслахууд ───────────────────────────────────────────────────

function packageCount(d: Delivery) {
  return d.packageIds?.length ?? 0
}

/** Багцын нийт үлдэгдэл — жагсаалтад аль хүргэлт блоклогдсоныг харуулна */
function unpaidTotal(d: Delivery) {
  return (d.packageIds ?? []).reduce(
    (sum, p) => sum + (typeof p === 'object' && p !== null ? Math.max(p.balance, 0) : 0),
    0
  )
}

function driverLabel(d: Delivery) {
  if (d.driverName) return d.driverName
  const r = d.driverId
  if (r && typeof r === 'object') {
    return `${r.firstname ?? ''} ${r.lastname ?? ''}`.trim() || '—'
  }
  return '—'
}

function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString('mn-MN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Хүргэлт"
      :subtitle="`Нийт ${pagination.total.toLocaleString('mn-MN')} хүргэлт`"
    >
      <template #actions>
        <UiBtn
          :variant="routeMode ? 'primary' : 'secondary'"
          :icon="CalendarDays"
          @click="routeMode = !routeMode"
        >
          Өдрийн маршрут
        </UiBtn>
        <UiBtn variant="secondary" :icon="RefreshCw" :loading="loading" @click="load">
          Сэргээх
        </UiBtn>
        <UiBtn :icon="Plus" to="/admin/deliveries/new">Хүргэлт үүсгэх</UiBtn>
      </template>
    </UiPageHeader>

    <!-- Төлөв тус бүрийн нэгтгэл -->
    <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <UiStatCard
        v-for="(style, key) in styles.all"
        :key="key"
        :label="style.label"
        :value="String(summary.byStatus[key]?.count ?? 0)"
        :hint="`${summary.byStatus[key]?.packageCount ?? 0} ачаа`"
        :accent="style.color"
      />
    </div>

    <div class="card">
      <!-- Өдрийн маршрутын горим -->
      <div
        v-if="routeMode"
        class="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-primary-200 bg-primary-50 p-3"
      >
        <CalendarDays :size="18" class="text-primary-600" />
        <span class="text-body font-semibold text-content">Товлосон огноо</span>
        <UiTextInput v-model="routeDate" type="date" class="max-w-[180px]" />

        <UiBtn
          v-if="selected.length"
          class="ml-auto"
          :icon="Truck"
          :loading="busy"
          @click="dispatchSelected"
        >
          {{ selected.length }} хүргэлтийг гаргах
        </UiBtn>
      </div>

      <!-- Шүүлт — хүснэгтийн ДЭЭР (Design System v1) -->
      <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UiTextInput v-model="filters.phone" :icon="Search" placeholder="Утас" tabular />
        <UiTextInput
          v-model="filters.deliveryNumber"
          :icon="Search"
          placeholder="Хүргэлтийн дугаар"
          tabular
        />
        <UiSelectInput
          v-model="filters.status"
          :options="statusOptions"
          placeholder="Бүх төлөв"
        />
      </div>

      <UiBtn
        v-if="activeFilterCount"
        class="mb-4"
        size="sm"
        variant="ghost"
        :icon="X"
        @click="resetFilters"
      >
        Шүүлт цэвэрлэх ({{ activeFilterCount }})
      </UiBtn>

      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-left">
          <thead>
            <tr class="border-b border-surface-border">
              <th v-if="routeMode" class="w-12 px-3 py-3">
                <input
                  type="checkbox"
                  class="h-4 w-4 cursor-pointer rounded border-surface-border text-primary focus:ring-2 focus:ring-primary-200"
                  :checked="allSelected"
                  :disabled="dispatchable.length === 0"
                  aria-label="Бүгдийг сонгох"
                  @change="toggleAll"
                />
              </th>
              <th class="px-3 py-3 text-body-sm font-medium text-content-secondary">Дугаар</th>
              <th class="px-3 py-3 text-body-sm font-medium text-content-secondary">Утас</th>
              <th class="px-3 py-3 text-body-sm font-medium text-content-secondary">Хаяг</th>
              <th class="px-3 py-3 text-body-sm font-medium text-content-secondary">Жолооч</th>
              <th class="px-3 py-3 text-body-sm font-medium text-content-secondary">Төлөв</th>
              <th class="px-3 py-3 text-right text-body-sm font-medium text-content-secondary">
                Ачаа
              </th>
              <th class="px-3 py-3 text-right text-body-sm font-medium text-content-secondary">
                Үлдэгдэл
              </th>
              <th class="px-3 py-3 text-body-sm font-medium text-content-secondary">Огноо</th>
            </tr>
          </thead>

          <tbody>
            <template v-if="loading">
              <tr v-for="n in 5" :key="`skeleton-${n}`" class="border-b border-surface-border">
                <td v-for="c in routeMode ? 9 : 8" :key="c" class="px-3 py-4">
                  <div class="h-4 animate-pulse rounded bg-surface-hover" />
                </td>
              </tr>
            </template>

            <tr v-else-if="rows.length === 0">
              <td :colspan="routeMode ? 9 : 8" class="px-3 py-16 text-center">
                <p class="text-body text-content-secondary">Хүргэлт олдсонгүй</p>
                <UiBtn
                  v-if="!activeFilterCount"
                  class="mt-4"
                  :icon="Plus"
                  to="/admin/deliveries/new"
                >
                  Анхны хүргэлтээ үүсгэх
                </UiBtn>
                <UiBtn v-else class="mt-4" variant="secondary" @click="resetFilters">
                  Шүүлтийг цэвэрлэх
                </UiBtn>
              </td>
            </tr>

            <template v-else>
              <tr
                v-for="d in rows"
                :key="d.id"
                class="border-b border-surface-border last:border-0 hover:bg-surface-hover"
              >
                <td v-if="routeMode" class="px-3 py-3.5">
                  <input
                    v-if="d.status === 'created'"
                    type="checkbox"
                    class="h-4 w-4 cursor-pointer rounded border-surface-border text-primary focus:ring-2 focus:ring-primary-200"
                    :checked="selected.includes(d.id)"
                    :aria-label="`${d.deliveryNumber} сонгох`"
                    @change="toggle(d.id)"
                  />
                </td>
                <td class="tabular px-3 py-3.5">
                  <NuxtLink
                    :to="`/admin/deliveries/${d.id}`"
                    class="text-body font-medium text-primary hover:underline"
                  >
                    {{ d.deliveryNumber }}
                  </NuxtLink>
                </td>
                <td class="tabular px-3 py-3.5 text-body text-content">{{ d.phone }}</td>
                <td class="max-w-[240px] truncate px-3 py-3.5 text-body-sm text-content-secondary">
                  {{ d.address }}
                </td>
                <td class="px-3 py-3.5 text-body-sm text-content-secondary">
                  {{ driverLabel(d) }}
                </td>
                <td class="px-3 py-3.5">
                  <UiStatusBadge :status="d.status" kind="delivery" size="sm" />
                </td>
                <td class="tabular px-3 py-3.5 text-right text-body text-content">
                  {{ packageCount(d) }}
                </td>
                <!-- §5.2 — аль хүргэлт блоклогдсоныг ЖАГСААЛТААС харна -->
                <td class="tabular px-3 py-3.5 text-right text-body font-semibold">
                  <span :class="unpaidTotal(d) > 0 ? 'text-error' : 'text-content-disabled'">
                    {{ unpaidTotal(d) > 0 ? formatCurrency(unpaidTotal(d)) : '—' }}
                  </span>
                </td>
                <td class="tabular px-3 py-3.5 text-body-sm text-content-secondary">
                  {{ formatDateTime(d.scheduledDate ?? d.createdAt) }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div class="mt-4 border-t border-surface-border pt-4">
        <UiPagination
          :page="pagination.page"
          :pages="pagination.pages"
          :total="pagination.total"
          :limit="pagination.limit"
          @update:page="filters.page = $event"
        />
      </div>
    </div>
  </div>
</template>
