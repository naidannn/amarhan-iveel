<script setup lang="ts">
import { Search, Plus, X, Truck, RefreshCw, Printer, PackageCheck } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import type { Column } from '~/components/ui/DataTable.vue'
import type { CargoPackage, Pagination } from '~/composables/usePackages'

/**
 * Ачааны жагсаалт — introduction.md §1.9, §9.3
 *
 * ЧУХАЛ: шүүлт, эрэмбэлэлт, хуудаслалт БҮГД server талд. Client талд бүх
 * өгөгдлийг татаж `filter()` хийхийг хориглоно (CLAUDE.md §5 дүрэм 5) —
 * 1M+ мөртэй үед хөтөч унана.
 *
 * Олноор сонгох нь §1.9-ийн шаардлага: хэрэглэгч 20–40 ачаа нэг дор авдаг тул
 * ажилтан тэдгээрийг сонгоод нэг үйлдлээр төлөв өөрчилнө.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Ачаа — Ивээл Карго' })

const api = usePackages()
const toast = useToast()
const status = usePackageStatus()

const rows = ref<CargoPackage[]>([])
const pagination = ref<Pagination>({ page: 1, pages: 1, total: 0, limit: 50 })
const loading = ref(true)
const selected = ref<string[]>([])

const filters = reactive({
  trackingNumber: '',
  phone: '',
  status: '' as string,
  paymentStatus: '' as string,
  locationCode: '',
  from: '',
  to: '',
  sort: '-createdAt',
  page: 1,
  limit: 50,
})

const statusOptions = computed(() => [
  { value: '', label: 'Бүх төлөв' },
  ...Object.entries(status.all).map(([value, style]) => ({ value, label: style.label })),
])

const paymentOptions = [
  { value: '', label: 'Бүх төлбөр' },
  { value: 'unpaid', label: 'Төлөгдөөгүй' },
  { value: 'partial', label: 'Хэсэгчилсэн' },
  { value: 'paid', label: 'Төлөгдсөн' },
]

const columns: Column<CargoPackage>[] = [
  { key: 'trackingNumber', label: 'Ачааны дугаар', sortable: true, tabular: true },
  { key: 'customerPhone', label: 'Утас', tabular: true },
  { key: 'cargoTypeId', label: 'Төрөл' },
  { key: 'measure', label: 'Жин / Эзлэхүүн', align: 'right', tabular: true },
  { key: 'finalPrice', label: 'Үнэ', align: 'right', sortable: true, tabular: true },
  { key: 'balance', label: 'Үлдэгдэл', align: 'right', tabular: true },
  { key: 'locationCode', label: 'Байршил', tabular: true },
  { key: 'status', label: 'Төлөв', sortable: true },
  { key: 'createdAt', label: 'Бүртгэсэн', sortable: true },
]

const activeFilterCount = computed(
  () =>
    [
      filters.trackingNumber,
      filters.phone,
      filters.status,
      filters.paymentStatus,
      filters.locationCode,
      filters.from,
      filters.to,
    ].filter(Boolean).length
)

async function load() {
  loading.value = true
  try {
    const result = await api.list({ ...filters })
    rows.value = result.data
    pagination.value = result.pagination
    // Хуудас солигдоход сонголтыг цэвэрлэнэ — харагдахгүй мөрийг санамсаргүй
    // өөрчлөхөөс сэргийлнэ
    selected.value = selected.value.filter(id => rows.value.some(r => r.id === id))
  } catch (e: any) {
    toast.error('Жагсаалт ачаалагдсангүй', { description: e.message })
    rows.value = []
  } finally {
    loading.value = false
  }
}

/** Бичих зуур хайхад сервер рүү мөр бүрт хүсэлт явуулахгүй */
const debouncedLoad = useDebounceFn(load, 300)

// Шүүлтүүр өөрчлөгдвөл 1-р хуудас руу эргэнэ — эс тэгвээс "хоосон" гэж
// харагдах боловч 3-р хуудсанд байгаа хэвээр байх болно
watch(
  () => [
    filters.trackingNumber,
    filters.phone,
    filters.status,
    filters.paymentStatus,
    filters.locationCode,
    filters.from,
    filters.to,
  ],
  () => {
    filters.page = 1
    debouncedLoad()
  }
)

watch(() => [filters.page, filters.sort], load)

onMounted(load)

function resetFilters() {
  filters.trackingNumber = ''
  filters.phone = ''
  filters.status = ''
  filters.paymentStatus = ''
  filters.locationCode = ''
  filters.from = ''
  filters.to = ''
}

// ── Олноор төлөв өөрчлөх (§1.9) ──────────────────────────────────────────
const bulkOpen = ref(false)
const bulkStatus = ref<string | null>(null)
const bulkReason = ref('')
const bulkSaving = ref(false)

/**
 * Сонгосон ачаанууд ижил төлөвт байвал л дараагийн төлөвийг санал болгож
 * чадна. Хольсон бол ажилтан аль төлөв рүү шилжүүлэхийг өөрөө сонгоно —
 * зөвшөөрөгдөөгүй шилжилтийг backend тус бүрээр хэлнэ.
 */
const selectedRows = computed(() => rows.value.filter(r => selected.value.includes(r.id)))

const bulkOptions = computed(() =>
  Object.entries(status.all)
    // Хүчингүй болгох нь шалтгаан + эрх шаарддаг тусдаа урсгал (BR-11).
    // `in_erlian` мөн хасав (BR-45) — ямар ч төлөвөөс энэ рүү шилжих зам
    // байхгүй, зөвхөн бүртгэх мөчид эхэлдэг тул сонговол backend алдаа өгнө.
    .filter(([value]) => value !== 'cancelled' && value !== 'in_erlian')
    .map(([value, style]) => ({ value, label: style.label }))
)

async function applyBulk() {
  if (!bulkStatus.value) {
    toast.error('Төлөв сонгоно уу')
    return
  }

  bulkSaving.value = true
  try {
    const result = await api.changeStatusBulk(
      selected.value,
      bulkStatus.value,
      bulkReason.value.trim() || undefined
    )

    if (result.succeeded.length) {
      toast.success(`${result.succeeded.length} ачааны төлөв өөрчлөгдлөө`)
    }
    // Бүтэлгүйтсэнийг ЧИМЭЭГҮЙ алгасахгүй — ажилтан аль ачаа өөрчлөгдөөгүйг
    // мэдэх ёстой, эс тэгвээс дараа нь хүргэлтийн будлиан үүснэ
    if (result.failed.length) {
      toast.warning(`${result.failed.length} ачаа өөрчлөгдсөнгүй`, {
        description: result.failed[0]?.message,
        duration: 9000,
      })
    }

    bulkOpen.value = false
    bulkStatus.value = null
    bulkReason.value = ''
    selected.value = []
    await load()
  } catch (e: any) {
    toast.error('Үйлдэл амжилтгүй', { description: e.message })
  } finally {
    bulkSaving.value = false
  }
}

// ── Шошго хэвлэх (§1.10) ─────────────────────────────────────────────────
const printOpen = ref(false)

// ── Хүлээлгэн өгөх (§1.9) — утсаар хайж, төлбөр + хүлээлгэн өгөхийг нэг цонхонд ──
const handoverOpen = ref(false)

function formatMeasure(pkg: CargoPackage) {
  const parts: string[] = []
  if (pkg.weightKg != null) parts.push(`${pkg.weightKg} кг`)
  if (pkg.volumeM3 != null) parts.push(`${pkg.volumeM3} м³`)
  return parts.join(' · ') || '—'
}

/**
 * ЧУХАЛ — `!== null` шалгалтыг ХАСАЖ БОЛОХГҮЙ. `typeof null === 'object'` тул
 * `cargoTypeId` нь `null` (ажилтан үнийг шууд заасан, BR-01a) үед `null.name`
 * гэж уншиж render throw хийдэг. Vue-д render дундаа алдаа гарвал тухайн
 * компонентын render effect УНАДАГ — хүснэгт skeleton-оор бүрмөсөн хөшиж,
 * консол дээр хачирхалтай алдаа гарна. Тарифгүй ачаа нь ХЭВИЙН тохиолдол.
 */
function typeName(pkg: CargoPackage) {
  const t = pkg.cargoTypeId
  return typeof t === 'object' && t !== null ? t.name : '—'
}
</script>

<template>
  <div>
    <UiPageHeader title="Ачаа" :subtitle="`Нийт ${pagination.total.toLocaleString('mn-MN')} ачаа`">
      <template #actions>
        <UiBtn variant="secondary" :icon="RefreshCw" :loading="loading" @click="load">
          Сэргээх
        </UiBtn>
        <UiBtn variant="secondary" :icon="PackageCheck" @click="handoverOpen = true">
          Хүлээлгэн өгөх
        </UiBtn>
        <UiBtn :icon="Plus" to="/admin/packages/new">Ачаа бүртгэх</UiBtn>
      </template>
    </UiPageHeader>

    <!-- §1.9 — сонгосон ачаанууд дээрх үйлдлийн мөр -->
    <div
      v-if="selected.length"
      class="mb-4 flex flex-wrap items-center gap-3 rounded-card bg-primary-50 px-4 py-3"
    >
      <p class="text-body font-medium text-primary-700">
        <span class="tabular">{{ selected.length }}</span> ачаа сонгогдсон
      </p>
      <UiBtn size="sm" :icon="Truck" @click="bulkOpen = true">Төлөв өөрчлөх</UiBtn>
      <UiBtn size="sm" variant="secondary" :icon="Printer" @click="printOpen = true">
        Шошго хэвлэх
      </UiBtn>
      <UiBtn size="sm" variant="ghost" :icon="X" @click="selected = []">Сонголт болих</UiBtn>
    </div>

    <UiDataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :sort="filters.sort"
      selectable
      :selected="selected"
      empty-text="Ачаа олдсонгүй"
      @update:sort="filters.sort = $event"
      @update:selected="selected = $event"
      @row-click="navigateTo(`/admin/packages/${$event.id}`)"
    >
      <!-- Хайлт ба шүүлт — хүснэгтийн ДЭЭР (Design System v1) -->
      <template #toolbar>
        <div class="space-y-3">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UiTextInput
              v-model="filters.trackingNumber"
              :icon="Search"
              placeholder="Ачааны дугаар"
              tabular
            />
            <UiTextInput v-model="filters.phone" :icon="Search" placeholder="Утас" tabular />
            <UiSelectInput
              v-model="filters.status"
              :options="statusOptions"
              placeholder="Бүх төлөв"
            />
            <UiSelectInput
              v-model="filters.paymentStatus"
              :options="paymentOptions"
              placeholder="Бүх төлбөр"
            />
          </div>

          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UiTextInput v-model="filters.locationCode" placeholder="Байршлын код" tabular />
            <UiTextInput v-model="filters.from" type="date" />
            <UiTextInput v-model="filters.to" type="date" />
            <UiBtn
              v-if="activeFilterCount"
              variant="ghost"
              :icon="X"
              @click="resetFilters"
            >
              Шүүлт цэвэрлэх ({{ activeFilterCount }})
            </UiBtn>
          </div>
        </div>
      </template>

      <template #cell-cargoTypeId="{ row }">{{ typeName(row) }}</template>

      <template #cell-measure="{ row }">{{ formatMeasure(row) }}</template>

      <template #cell-finalPrice="{ row }">
        <span class="font-semibold">{{ formatCurrency(row.finalPrice) }}</span>
        <span v-if="row.priceOverridden" class="ml-1 text-body-sm text-warning" title="Гараар өөрчилсөн">
          ✎
        </span>
      </template>

      <template #cell-balance="{ row }">
        <span :class="row.balance > 0 ? 'font-semibold text-error' : 'text-content-secondary'">
          {{ formatCurrency(row.balance) }}
        </span>
      </template>

      <template #cell-locationCode="{ row }">{{ row.locationCode || '—' }}</template>

      <template #cell-status="{ row }">
        <UiStatusBadge :status="row.status" size="sm" />
      </template>

      <template #cell-createdAt="{ row }">
        <span class="tabular text-content-secondary">
          {{ new Date(row.createdAt).toLocaleDateString('mn-MN') }}
        </span>
      </template>

      <template #empty>
        <UiBtn v-if="!activeFilterCount" class="mt-4" :icon="Plus" to="/admin/packages/new">
          Анхны ачааг бүртгэх
        </UiBtn>
        <UiBtn v-else class="mt-4" variant="secondary" @click="resetFilters">
          Шүүлтийг цэвэрлэх
        </UiBtn>
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

    <!-- Олноор төлөв өөрчлөх -->
    <UiModal
      v-model="bulkOpen"
      title="Олон ачааны төлөв өөрчлөх"
      :subtitle="`${selected.length} ачаа сонгогдсон`"
    >
      <div class="space-y-4">
        <UiField label="Шинэ төлөв" required>
          <UiSelectInput v-model="bulkStatus" :options="bulkOptions" placeholder="Төлөв сонгоно уу" />
        </UiField>

        <UiField label="Шалтгаан" hint="Сонголтоор — түүх ба audit-д бичигдэнэ">
          <UiTextArea v-model="bulkReason" :rows="2" placeholder="Жишээ: 2026-08-01-ний машинд ачив" />
        </UiField>

        <p class="text-body-sm text-content-secondary">
          Зөвшөөрөгдөөгүй шилжилттэй ачаа алгасагдана — аль нь болоогүйг дараа нь харуулна.
        </p>
      </div>

      <template #footer>
        <UiBtn variant="secondary" @click="bulkOpen = false">Болих</UiBtn>
        <UiBtn :loading="bulkSaving" @click="applyBulk">Өөрчлөх</UiBtn>
      </template>
    </UiModal>

    <!-- §1.10 — шошго хэвлэх -->
    <PackagePrintSheet v-model="printOpen" :packages="selectedRows" />

    <!-- §1.9 — утсаар хайж, төлбөр + хүлээлгэн өгөхийг нэг цонхонд -->
    <PackageHandoverModal
      v-model="handoverOpen"
      :initial-query="filters.phone"
      @handed-over="load"
    />
  </div>
</template>
