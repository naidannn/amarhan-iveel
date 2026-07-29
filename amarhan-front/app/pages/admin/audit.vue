<script setup lang="ts">
import { Download, RefreshCw, X, ShieldCheck } from 'lucide-vue-next'
import type { Column } from '~/components/ui/DataTable.vue'

/**
 * Хяналтын бүртгэл (Audit Log) — introduction.md §9.2
 *
 * ЗӨВХӨН ХАРАХ дэлгэц. Засах, устгах товч БАЙХГҮЙ — бүртгэл нь append-only
 * (BR-39), backend-д ч endpoint байхгүй. Маргаан гарахад нотолгоо болох
 * зорилготой тул хөндөх боломж бүрийг зориудаар хаасан.
 *
 * Менежер зөвхөн өөрийн салбарын бичлэгийг харна — шүүлт нь SERVER талд
 * хийгддэг (BR-37). UI-аас `branchId` явуулах шаардлагагүй, явуулсан ч
 * backend үл тоомсорлоно.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Хяналтын бүртгэл — Ивээл Карго' })

const { $axios } = useNuxtApp()
const toast = useToast()

interface AuditLog {
  id: string
  actorName: string
  actorRole: string | null
  action: string
  entity: string
  entityId: string | null
  entityLabel: string | null
  field: string | null
  before: any
  after: any
  reason: string | null
  ip: string | null
  createdAt: string
}

const rows = ref<AuditLog[]>([])
const pagination = ref({ page: 1, pages: 1, total: 0, limit: 50 })
const loading = ref(true)

const filters = reactive({
  entity: '',
  action: '',
  from: '',
  to: '',
  page: 1,
  limit: 50,
})

/** Монгол нэрс — код (`package.create`) нь ажилтанд уншигдахгүй */
const ENTITY_LABELS: Record<string, string> = {
  package: 'Ачаа',
  payment: 'Төлбөр',
  customer: 'Харилцагч',
  user: 'Ажилтан',
  branch: 'Салбар',
  location: 'Байршил',
  cargo_type: 'Ачааны төрөл',
  tariff: 'Тариф',
  settings: 'Тохиргоо',
}

const ACTION_LABELS: Record<string, string> = {
  'package.create': 'Ачаа бүртгэв',
  'package.update': 'Ачаа засав',
  'package.price_override': 'Үнэ гараар өөрчлөв',
  'package.status_change': 'Төлөв өөрчлөв',
  'package.location_move': 'Байршил шилжүүлэв',
  'package.cancel': 'Хүчингүй болгов',
  'package.delete': 'Бүрмөсөн устгав',
  'package.duplicate_approved': 'Давхар бүртгэхийг зөвшөөрөв',
  'payment.create': 'Төлбөр бүртгэв',
  'payment.void': 'Төлбөр хүчингүй болгов',
  'customer.create': 'Харилцагч үүсгэв',
  'customer.update': 'Харилцагч засав',
  'customer.loyalty_adjust': 'Урамшуулал өөрчлөв',
  'user.create': 'Ажилтан үүсгэв',
  'user.update': 'Ажилтан засав',
  'user.role_change': 'Эрх өөрчлөв',
  'user.disable': 'Ажилтныг хаав',
  'branch.create': 'Салбар үүсгэв',
  'branch.update': 'Салбар засав',
  'location.create': 'Байршил үүсгэв',
  'location.update': 'Байршил засав',
  'cargo_type.create': 'Ачааны төрөл үүсгэв',
  'cargo_type.update': 'Ачааны төрөл засав',
  'settings.tariff_change': 'Тариф өөрчлөв',
  'settings.loyalty_change': 'Урамшууллын тохиргоо өөрчлөв',
  'settings.update': 'Тохиргоо өөрчлөв',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ',
  manager: 'Менежер',
  staff: 'Ажилтан',
}

const entityOptions = [
  { value: '', label: 'Бүх төрөл' },
  ...Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })),
]

/** Сонгосон объектын төрөлд харгалзах үйлдлүүд л харагдана */
const actionOptions = computed(() => {
  const entries = Object.entries(ACTION_LABELS).filter(([action]) =>
    filters.entity ? action.startsWith(`${filters.entity}.`) : true
  )
  return [{ value: '', label: 'Бүх үйлдэл' }, ...entries.map(([value, label]) => ({ value, label }))]
})

const columns: Column<AuditLog>[] = [
  { key: 'createdAt', label: 'Хугацаа', tabular: true, width: '170px' },
  { key: 'actorName', label: 'Ажилтан' },
  { key: 'action', label: 'Үйлдэл' },
  { key: 'entityLabel', label: 'Объект', tabular: true },
  { key: 'change', label: 'Өөрчлөлт' },
  { key: 'reason', label: 'Шалтгаан' },
]

const activeFilterCount = computed(
  () => [filters.entity, filters.action, filters.from, filters.to].filter(Boolean).length
)

async function load() {
  loading.value = true
  try {
    const params: Record<string, any> = { page: filters.page, limit: filters.limit }
    if (filters.entity) params.entity = filters.entity
    if (filters.action) params.action = filters.action
    if (filters.from) params.from = new Date(filters.from).toISOString()
    // Өдрийн ТӨГСГӨЛ хүртэл — эс тэгвээс тэр өдрийн бичлэг харагдахгүй
    if (filters.to) params.to = new Date(`${filters.to}T23:59:59.999`).toISOString()

    const response = await $axios.get('/api/v1/audit-logs', { params })
    rows.value = response.data.data
    pagination.value = response.data.pagination
  } catch (e: any) {
    toast.error('Бүртгэл ачаалагдсангүй', {
      description: e.response?.data?.message ?? e.message,
    })
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [filters.entity, filters.action, filters.from, filters.to],
  () => {
    filters.page = 1
    load()
  }
)
watch(() => filters.page, load)

// Объектын төрөл солигдоход түүнд харгалзахгүй үйлдлийн шүүлтийг цэвэрлэнэ
watch(
  () => filters.entity,
  entity => {
    if (entity && filters.action && !filters.action.startsWith(`${entity}.`)) {
      filters.action = ''
    }
  }
)

onMounted(load)

function resetFilters() {
  filters.entity = ''
  filters.action = ''
  filters.from = ''
  filters.to = ''
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action
}

/**
 * Хүснэгтэд харуулах утга. Объект (бүртгэлийн snapshot, устгасан ачааны бүх
 * талбар) нь мөрөнд багтахгүй тул ХООСОН буцаана — "{…}" гэж харуулах нь
 * мэдээлэл биш, зөвхөн шуугиан. Бүтэн агуулгыг CSV экспортоос харна.
 */
function summarize(value: any): string {
  if (value === null || value === undefined || typeof value === 'object') return ''
  if (typeof value === 'boolean') return value ? 'тийм' : 'үгүй'
  return String(value)
}

/** Мөрөнд харуулах өөрчлөлт байгаа эсэх */
function hasVisibleChange(log: AuditLog) {
  return Boolean(summarize(log.before) || summarize(log.after))
}

/**
 * CSV-д объектыг JSON-оор БҮТНЭЭР гаргана — экспортын зорилго нь нотолгоо
 * хадгалах учир мэдээлэл хасах нь зөв биш.
 */
function csvValue(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'тийм' : 'үгүй'
  return String(value)
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('mn-MN', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * CSV экспорт — Excel-д нээгдэнэ.
 *
 * ЗӨВХӨН ХАРАГДАЖ БАЙГАА ХУУДСЫГ экспортолно. Бүх бичлэгийг татах нь 1M+
 * мөр татах эрсдэлтэй (§9.3) — бүтэн экспорт хэрэгтэй бол backend-д
 * дэвсгэр (background) даалгавар болгож хийх ёстой.
 *
 * `﻿` (BOM) нэмж байгаа шалтгаан: Excel үүнгүйгээр UTF-8 кирилл
 * тэмдэгтийг эвдэж уншдаг.
 */
function exportCsv() {
  const header = ['Хугацаа', 'Ажилтан', 'Эрх', 'Үйлдэл', 'Объект', 'Талбар', 'Хуучин', 'Шинэ', 'Шалтгаан', 'IP']

  const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`

  const lines = rows.value.map(log =>
    [
      formatDateTime(log.createdAt),
      log.actorName,
      ROLE_LABELS[log.actorRole ?? ''] ?? log.actorRole ?? '',
      actionLabel(log.action),
      log.entityLabel ?? '',
      log.field ?? '',
      csvValue(log.before),
      csvValue(log.after),
      log.reason ?? '',
      log.ip ?? '',
    ]
      .map(escape)
      .join(',')
  )

  const csv = `﻿${[header.map(escape).join(','), ...lines].join('\r\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)

  toast.success(`${rows.value.length} бичлэг экспортлогдлоо`)
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Хяналтын бүртгэл"
      subtitle="Мөнгө, төлөв, эрх, тохиргоо өөрчлөх бүх үйлдэл. Засах боломжгүй."
    >
      <template #actions>
        <UiBtn variant="secondary" :icon="RefreshCw" :loading="loading" @click="load">
          Сэргээх
        </UiBtn>
        <UiBtn variant="secondary" :icon="Download" :disabled="rows.length === 0" @click="exportCsv">
          CSV татах
        </UiBtn>
      </template>
    </UiPageHeader>

    <div class="mb-4 flex items-start gap-3 rounded-card bg-primary-50 px-4 py-3">
      <ShieldCheck :size="19" class="mt-0.5 shrink-0 text-primary-600" />
      <p class="text-body text-primary-700">
        Бүртгэл нь зөвхөн нэмэгддэг (append-only) — API-аар ч, өгөгдлийн сангаас ч
        засах боломжгүй. Хадгалах хугацаа: доод тал нь 3 жил.
      </p>
    </div>

    <UiDataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      empty-text="Бүртгэл олдсонгүй"
    >
      <template #toolbar>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <UiSelectInput v-model="filters.entity" :options="entityOptions" placeholder="Бүх төрөл" />
          <UiSelectInput
            v-model="filters.action"
            :options="actionOptions"
            placeholder="Бүх үйлдэл"
          />
          <UiTextInput v-model="filters.from" type="date" />
          <UiTextInput v-model="filters.to" type="date" />
          <UiBtn v-if="activeFilterCount" variant="ghost" :icon="X" @click="resetFilters">
            Цэвэрлэх ({{ activeFilterCount }})
          </UiBtn>
        </div>
      </template>

      <template #cell-createdAt="{ row }">
        <span class="text-content-secondary">{{ formatDateTime(row.createdAt) }}</span>
      </template>

      <template #cell-actorName="{ row }">
        <p class="font-medium text-content">{{ row.actorName }}</p>
        <p class="text-body-sm text-content-secondary">
          {{ ROLE_LABELS[row.actorRole ?? ''] ?? '' }}
        </p>
      </template>

      <template #cell-action="{ row }">
        <span class="text-content">{{ actionLabel(row.action) }}</span>
      </template>

      <template #cell-entityLabel="{ row }">
        <NuxtLink
          v-if="row.entity === 'package' && row.entityId"
          :to="`/admin/packages/${row.entityId}`"
          class="font-medium text-primary-600 hover:underline"
        >
          {{ row.entityLabel || '—' }}
        </NuxtLink>
        <span v-else>{{ row.entityLabel || '—' }}</span>
      </template>

      <template #cell-change="{ row }">
        <div v-if="row.field || hasVisibleChange(row)" class="text-body-sm">
          <p v-if="row.field" class="text-content-secondary">{{ row.field }}</p>
          <p v-if="hasVisibleChange(row)" class="tabular">
            <span v-if="summarize(row.before)" class="text-content-secondary line-through">
              {{ summarize(row.before) }}
            </span>
            <span
              v-if="summarize(row.before) && summarize(row.after)"
              class="text-content-disabled"
            >
              →
            </span>
            <span v-if="summarize(row.after)" class="font-medium text-content">
              {{ summarize(row.after) }}
            </span>
          </p>
        </div>
        <span v-else class="text-content-disabled">—</span>
      </template>

      <template #cell-reason="{ row }">
        <span v-if="row.reason" class="text-body-sm italic text-content-secondary">
          «{{ row.reason }}»
        </span>
        <span v-else class="text-content-disabled">—</span>
      </template>

      <template #footer>
        <UiPagination
          :page="pagination.page"
          :pages="pagination.pages"
          :total="pagination.total"
          :limit="pagination.limit"
          @update:page="filters.page = $event"
        />
      </template>
    </UiDataTable>
  </div>
</template>
