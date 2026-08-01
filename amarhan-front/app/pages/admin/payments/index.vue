<script setup lang="ts">
import { Search, X, RefreshCw, Ban, Plus, Check } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { usePayments, type Payment, type PaymentSummary } from '~/composables/usePayments'
import type { Pagination } from '~/composables/usePackages'
import type { Column } from '~/components/ui/DataTable.vue'

/**
 * Төлбөрийн жагсаалт — introduction.md §2.2
 *
 * «Хамгийн сүүлд орсон төлбөр · төлсөн хүн · дүн · төрөл · ямар ачаанд» гэсэн
 * шаардлагыг биелүүлнэ.
 *
 * ЧУХАЛ (§9.3): шүүлт, хуудаслалт БҮГД server талд. Client талд бүх төлбөрийг
 * татаж `filter()` хийхийг хориглоно (CLAUDE.md §5 дүрэм 5).
 *
 * Нийлбэрийг хэлбэр тус бүрээр харуулж байгаа шалтгаан: өдрийн сүүлд бэлэн
 * мөнгийг кассын БОДИТ үлдэгдэлтэй тулгах шаардлагатай — дансны гүйлгээтэй
 * хамт нэг тоо болговол тулгах боломжгүй.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Төлбөр — Ивээл Карго' })

const api = usePayments()
const toast = useToast()
const auth = useAuthStore()
const styles = usePaymentStyles()

const isManagement = computed(() => ['admin', 'manager'].includes(auth.user?.role ?? ''))

const rows = ref<Payment[]>([])
const pagination = ref<Pagination>({ page: 1, pages: 1, total: 0, limit: 50 })
const summary = ref<PaymentSummary>({ total: 0, count: 0, byMethod: {} })
const loading = ref(true)

const filters = reactive({
  phone: '',
  method: '' as string,
  status: '' as string,
  from: '',
  to: '',
  sort: '-createdAt',
  page: 1,
  limit: 50,
})

const methodOptions = computed(() => [
  { value: '', label: 'Бүх хэлбэр' },
  ...Object.entries(styles.method.all).map(([value, style]) => ({ value, label: style.label })),
])

const statusOptions = computed(() => [
  { value: '', label: 'Бүх төлөв' },
  ...Object.entries(styles.recordStatus.all).map(([value, style]) => ({
    value,
    label: style.label,
  })),
])

const columns: Column<Payment>[] = [
  { key: 'createdAt', label: 'Огноо', tabular: true },
  { key: 'customerPhone', label: 'Утас', tabular: true, mobileTitle: true },
  { key: 'trackingNumbers', label: 'Ачаа' },
  { key: 'method', label: 'Хэлбэр' },
  { key: 'receivedBy', label: 'Авсан' },
  { key: 'amount', label: 'Дүн', align: 'right', tabular: true },
  { key: 'actions', label: '' },
]

const activeFilterCount = computed(
  () => [filters.phone, filters.method, filters.status, filters.from, filters.to].filter(Boolean).length
)

async function load() {
  loading.value = true
  try {
    // Жагсаалт ба нийлбэрийг ЗЭРЭГ татна — дараалуулбал хуудас алаг ачаалагдана
    const [list, sums] = await Promise.all([
      api.list({ ...filters }),
      api.summary({ from: filters.from || undefined, to: filters.to || undefined }),
    ])
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
  () => [filters.phone, filters.method, filters.status, filters.from, filters.to],
  () => {
    filters.page = 1
    debouncedLoad()
  }
)

watch(() => [filters.page, filters.sort], load)

onMounted(load)

function resetFilters() {
  filters.phone = ''
  filters.method = ''
  filters.status = ''
  filters.from = ''
  filters.to = ''
}

// ── Харуулах туслахууд ───────────────────────────────────────────────────

/**
 * Төлбөр ямар ачаанд орсныг харуулна (§2.2 шаардлага). Roadmap 5.8-ийн
 * хүргэлтийн хураамжийн `deliveryId` элементийг ДУГААРААР ялгаж харуулна —
 * эс тэгвээс "энэ хураамж аль хүргэлтэд холбогдох вэ" гэдэг алдагдана.
 */
function trackingNumbers(payment: Payment) {
  const numbers = payment.allocations
    .map(a =>
      typeof a.packageId === 'object' && a.packageId !== null ? a.packageId.trackingNumber : null
    )
    .filter((n): n is string => Boolean(n))

  const deliveries = payment.allocations
    .map(a =>
      typeof a.deliveryId === 'object' && a.deliveryId !== null
        ? `Хүргэлт ${a.deliveryId.deliveryNumber}`
        : null
    )
    .filter((n): n is string => Boolean(n))

  const parts = [...numbers, ...deliveries]
  if (parts.length === 0) return '—'
  if (parts.length <= 2) return parts.join(', ')
  return `${parts.slice(0, 2).join(', ')} +${parts.length - 2}`
}

function receivedByName(payment: Payment) {
  if (payment.receivedByName) return payment.receivedByName
  const r = payment.receivedBy
  if (r && typeof r === 'object') {
    return `${r.firstname ?? ''} ${r.lastname ?? ''}`.trim() || '—'
  }
  // `null` = онлайн төлбөр (харилцагч өөрөө, §2.1)
  return 'Онлайн'
}

function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString('mn-MN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── BR-18 — хүчингүй болгох ──────────────────────────────────────────────
const voidOpen = ref(false)
const voidTarget = ref<Payment | null>(null)
const voidReason = ref('')
const busy = ref(false)

function openVoid(payment: Payment) {
  voidTarget.value = payment
  voidReason.value = ''
  voidOpen.value = true
}

async function applyVoid() {
  if (!voidTarget.value || voidReason.value.trim().length < 3) {
    toast.error('Хүчингүй болгох шалтгааныг бичнэ үү')
    return
  }
  busy.value = true
  try {
    await api.voidPayment(voidTarget.value.id, voidReason.value.trim())
    toast.success('Төлбөр хүчингүй болов', { description: 'Ачааны үлдэгдэл дахин бодогдлоо' })
    voidOpen.value = false
    await load()
  } catch (e: any) {
    toast.error('Хүчингүй болсонгүй', { description: e.message, duration: 9000 })
  } finally {
    busy.value = false
  }
}

// ── Roadmap 5.8 — харилцагчийн банкны шилжүүлгийг баталгаажуулах ─────────
const confirmingId = ref<string | null>(null)

async function confirmPayment(payment: Payment) {
  confirmingId.value = payment.id
  try {
    await api.confirmPending(payment.id)
    toast.success('Төлбөр баталгаажлаа', {
      description: 'Ачааны үлдэгдэл/хүргэлтийн хураамж шинэчлэгдлээ',
    })
    await load()
  } catch (e: any) {
    toast.error('Баталгаажсангүй', { description: e.message, duration: 9000 })
  } finally {
    confirmingId.value = null
  }
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Төлбөр"
      :subtitle="`Нийт ${pagination.total.toLocaleString('mn-MN')} бүртгэл`"
    >
      <template #actions>
        <UiBtn variant="secondary" :icon="RefreshCw" :loading="loading" @click="load">
          Сэргээх
        </UiBtn>
        <UiBtn :icon="Plus" to="/admin/payments/collect">Төлбөр авах</UiBtn>
      </template>
    </UiPageHeader>

    <!-- §2.2 — өдрийн касс тулгах нийлбэрүүд -->
    <div class="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      <!-- 5 багана нарийн тул нэр КОРОТ байх ёстой — урт нэр мөр тасалж,
           дүн нь хоёр мөр болж хэлбэр эвдэрдэг. Тиймээс icon ч хэрэглэхгүй. -->
      <UiStatCard
        label="Нийт"
        :value="formatCurrency(summary.total)"
        :hint="`${summary.count} бүртгэл`"
        accent="#16A34A"
      />
      <UiStatCard
        v-for="(style, key) in styles.method.all"
        :key="key"
        :label="style.label"
        :value="formatCurrency(summary.byMethod[key]?.total ?? 0)"
        :hint="`${summary.byMethod[key]?.count ?? 0} бүртгэл`"
        :accent="style.color"
      />
    </div>

    <UiDataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      empty-text="Төлбөр олдсонгүй"
    >
      <!-- Шүүлт — хүснэгтийн ДЭЭР (Design System v1) -->
      <template #toolbar>
        <UiFilterBar :active-count="activeFilterCount">
          <template #primary>
            <UiTextInput v-model="filters.phone" :icon="Search" placeholder="Утас" tabular />
          </template>

          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UiSelectInput v-model="filters.method" :options="methodOptions" placeholder="Бүх хэлбэр" />
            <UiSelectInput v-model="filters.status" :options="statusOptions" placeholder="Бүх төлөв" />
            <UiTextInput v-model="filters.from" type="date" />
            <UiTextInput v-model="filters.to" type="date" />
          </div>

          <UiBtn
            v-if="activeFilterCount"
            class="mt-3"
            size="sm"
            variant="ghost"
            :icon="X"
            @click="resetFilters"
          >
            Шүүлт цэвэрлэх ({{ activeFilterCount }})
          </UiBtn>
        </UiFilterBar>
      </template>

      <template #cell-createdAt="{ row }">
        <span class="text-body-sm text-content-secondary">{{ formatDateTime(row.createdAt) }}</span>
      </template>

      <template #cell-trackingNumbers="{ row }">
        <span class="text-body-sm text-content-secondary">{{ trackingNumbers(row) }}</span>
      </template>

      <template #cell-method="{ row }">
        <UiStatusBadge :status="row.method" kind="method" size="sm" />
      </template>

      <template #cell-receivedBy="{ row }">
        <span class="text-body-sm text-content-secondary">{{ receivedByName(row) }}</span>
      </template>

      <template #cell-amount="{ row }">
        <span
          class="font-semibold"
          :class="row.status === 'voided' ? 'text-content-disabled line-through' : 'text-content'"
        >
          {{ formatCurrency(row.amount) }}
        </span>
        <UiStatusBadge
          v-if="row.status !== 'completed'"
          class="ml-2"
          :status="row.status"
          kind="record"
          size="sm"
        />
      </template>

      <template #cell-actions="{ row }">
        <!-- Roadmap 5.8 — харилцагчийн банкны шилжүүлгийг баталгаажуулах/татгалзах -->
        <div v-if="row.status === 'pending'" class="flex items-center gap-1">
          <UiBtn
            size="sm"
            variant="ghost"
            :icon="Check"
            :loading="confirmingId === row.id"
            @click.stop="confirmPayment(row)"
          >
            Баталгаажуулах
          </UiBtn>
          <UiBtn
            v-if="isManagement"
            size="sm"
            variant="ghost"
            :icon="Ban"
            @click.stop="openVoid(row)"
          >
            Татгалзах
          </UiBtn>
        </div>
        <UiBtn
          v-else-if="isManagement && row.status === 'completed'"
          size="sm"
          variant="ghost"
          :icon="Ban"
          @click.stop="openVoid(row)"
        >
          Хүчингүй
        </UiBtn>
      </template>

      <template #empty>
        <UiBtn v-if="!activeFilterCount" class="mt-4" :icon="Plus" to="/admin/payments/collect">
          Анхны төлбөрийг авах
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

    <UiModal v-model="voidOpen" title="Төлбөрийг хүчингүй болгох" size="sm" persistent>
      <div class="space-y-4">
        <p class="text-body text-content-secondary">
          <span class="tabular font-semibold text-content">
            {{ voidTarget ? formatCurrency(voidTarget.amount) : '' }}
          </span>
          дүнтэй төлбөр хүчингүй болно. Бичлэг УСТАХГҮЙ — холбогдох ачааны үлдэгдэл
          дахин бодогдоно.
        </p>

        <UiField label="Шалтгаан" required hint="Audit Log-д бичигдэнэ">
          <UiTextArea v-model="voidReason" :rows="2" placeholder="Жишээ: дансаар ороогүй" />
        </UiField>
      </div>

      <template #footer>
        <UiBtn variant="secondary" @click="voidOpen = false">Болих</UiBtn>
        <UiBtn variant="danger" :loading="busy" @click="applyVoid">Хүчингүй болгох</UiBtn>
      </template>
    </UiModal>
  </div>
</template>
