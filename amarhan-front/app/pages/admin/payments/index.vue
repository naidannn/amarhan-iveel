<script setup lang="ts">
import { Search, X, RefreshCw, Ban, Plus } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { usePayments, type Payment, type PaymentSummary } from '~/composables/usePayments'
import type { Pagination } from '~/composables/usePackages'

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

/** Төлбөр ямар ачаанд орсныг харуулна (§2.2 шаардлага) */
function trackingNumbers(payment: Payment) {
  const numbers = payment.allocations
    .map(a =>
      typeof a.packageId === 'object' && a.packageId !== null ? a.packageId.trackingNumber : null
    )
    .filter((n): n is string => Boolean(n))

  if (numbers.length === 0) return '—'
  if (numbers.length <= 2) return numbers.join(', ')
  return `${numbers.slice(0, 2).join(', ')} +${numbers.length - 2}`
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
    <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

    <div class="card">
      <!-- Шүүлт — хүснэгтийн ДЭЭР (Design System v1) -->
      <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <UiTextInput v-model="filters.phone" :icon="Search" placeholder="Утас" tabular />
        <UiSelectInput v-model="filters.method" :options="methodOptions" placeholder="Бүх хэлбэр" />
        <UiSelectInput v-model="filters.status" :options="statusOptions" placeholder="Бүх төлөв" />
        <UiTextInput v-model="filters.from" type="date" />
        <UiTextInput v-model="filters.to" type="date" />
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
              <th class="px-3 py-3 text-body-sm font-medium text-content-secondary">Огноо</th>
              <th class="px-3 py-3 text-body-sm font-medium text-content-secondary">Утас</th>
              <th class="px-3 py-3 text-body-sm font-medium text-content-secondary">Ачаа</th>
              <th class="px-3 py-3 text-body-sm font-medium text-content-secondary">Хэлбэр</th>
              <th class="px-3 py-3 text-body-sm font-medium text-content-secondary">Авсан</th>
              <th class="px-3 py-3 text-right text-body-sm font-medium text-content-secondary">
                Дүн
              </th>
              <th class="px-3 py-3" />
            </tr>
          </thead>

          <tbody>
            <template v-if="loading">
              <tr v-for="n in 5" :key="`skeleton-${n}`" class="border-b border-surface-border">
                <td v-for="c in 7" :key="c" class="px-3 py-4">
                  <div class="h-4 animate-pulse rounded bg-surface-hover" />
                </td>
              </tr>
            </template>

            <tr v-else-if="rows.length === 0">
              <td colspan="7" class="px-3 py-16 text-center">
                <p class="text-body text-content-secondary">Төлбөр олдсонгүй</p>
                <UiBtn
                  v-if="!activeFilterCount"
                  class="mt-4"
                  :icon="Plus"
                  to="/admin/payments/collect"
                >
                  Анхны төлбөрийг авах
                </UiBtn>
                <UiBtn v-else class="mt-4" variant="secondary" @click="resetFilters">
                  Шүүлтийг цэвэрлэх
                </UiBtn>
              </td>
            </tr>

            <template v-else>
              <tr
                v-for="p in rows"
                :key="p.id"
                class="border-b border-surface-border last:border-0 hover:bg-surface-hover"
              >
                <td class="tabular px-3 py-3.5 text-body-sm text-content-secondary">
                  {{ formatDateTime(p.createdAt) }}
                </td>
                <td class="tabular px-3 py-3.5 text-body text-content">{{ p.customerPhone }}</td>
                <td class="tabular px-3 py-3.5 text-body-sm text-content-secondary">
                  {{ trackingNumbers(p) }}
                </td>
                <td class="px-3 py-3.5">
                  <UiStatusBadge :status="p.method" kind="method" size="sm" />
                </td>
                <td class="px-3 py-3.5 text-body-sm text-content-secondary">
                  {{ receivedByName(p) }}
                </td>
                <td class="px-3 py-3.5 text-right">
                  <span
                    class="tabular text-body font-semibold"
                    :class="
                      p.status === 'voided'
                        ? 'text-content-disabled line-through'
                        : 'text-content'
                    "
                  >
                    {{ formatCurrency(p.amount) }}
                  </span>
                  <UiStatusBadge
                    v-if="p.status !== 'completed'"
                    class="ml-2"
                    :status="p.status"
                    kind="record"
                    size="sm"
                  />
                </td>
                <td class="px-3 py-3.5 text-right">
                  <UiBtn
                    v-if="isManagement && p.status === 'completed'"
                    size="sm"
                    variant="ghost"
                    :icon="Ban"
                    @click="openVoid(p)"
                  >
                    Хүчингүй
                  </UiBtn>
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
