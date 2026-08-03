<script setup lang="ts">
import { Search, X, RefreshCw, Ban, Plus } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import {
  useExpenses,
  EXPENSE_CATEGORY_OPTIONS,
  expenseCategoryLabel,
  type Expense,
  type ExpenseCategory,
  type ExpenseSummary,
} from '~/composables/useExpenses'
import type { Pagination } from '~/composables/usePackages'
import type { Column } from '~/components/ui/DataTable.vue'

/**
 * Зарлагын жагсаалт — docs/business-rules.md BR-47
 *
 * Зөвхөн Менежер/Админ хандах хуудас (backend route бүхэлдээ ROLE_GROUP.MANAGEMENT
 * дор — Ажилтан 403 авна). §9.3-ийн дагуу шүүлт/хуудаслалт БҮГД server талд.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Зарлага — Ивээл Карго' })

const api = useExpenses()
const toast = useToast()

const rows = ref<Expense[]>([])
const pagination = ref<Pagination>({ page: 1, pages: 1, total: 0, limit: 50 })
const summary = ref<ExpenseSummary>({ total: 0, count: 0, byCategory: {} })
const loading = ref(true)

const filters = reactive({
  category: '' as string,
  status: '' as string,
  from: '',
  to: '',
  sort: '-date',
  page: 1,
  limit: 50,
})

const categoryOptions = computed(() => [
  { value: '', label: 'Бүх ангилал' },
  ...EXPENSE_CATEGORY_OPTIONS.map(o => ({ value: o.value, label: o.label })),
])

const statusOptions = [
  { value: '', label: 'Бүх төлөв' },
  { value: 'active', label: 'Идэвхтэй' },
  { value: 'voided', label: 'Хүчингүй' },
]

const columns: Column<Expense>[] = [
  { key: 'date', label: 'Огноо', tabular: true },
  { key: 'category', label: 'Ангилал' },
  { key: 'description', label: 'Тайлбар' },
  { key: 'amount', label: 'Дүн', align: 'right', tabular: true },
  { key: 'createdByName', label: 'Бүртгэсэн' },
  { key: 'actions', label: '' },
]

const activeFilterCount = computed(
  () => [filters.category, filters.status, filters.from, filters.to].filter(Boolean).length
)

async function load() {
  loading.value = true
  try {
    const [list, sums] = await Promise.all([
      api.list({ ...filters }),
      api.summary({
        category: filters.category || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      }),
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
  () => [filters.category, filters.status, filters.from, filters.to],
  () => {
    filters.page = 1
    debouncedLoad()
  }
)

watch(() => [filters.page, filters.sort], load)

onMounted(load)

function resetFilters() {
  filters.category = ''
  filters.status = ''
  filters.from = ''
  filters.to = ''
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString('mn-MN')
}

// ── Бүртгэх ────────────────────────────────────────────────────────────
const createOpen = ref(false)
const creating = ref(false)
const today = () => new Date().toISOString().slice(0, 10)
const form = reactive({
  amount: null as number | null,
  category: '' as ExpenseCategory | '',
  categoryLabel: '',
  description: '',
  date: today(),
})

function openCreate() {
  form.amount = null
  form.category = ''
  form.categoryLabel = ''
  form.description = ''
  form.date = today()
  createOpen.value = true
}

async function submitCreate() {
  if (!form.amount || form.amount < 1) {
    toast.error('Дүнг зөв бичнэ үү')
    return
  }
  if (!form.category) {
    toast.error('Ангилал сонгоно уу')
    return
  }
  if (form.category === 'other' && form.categoryLabel.trim().length === 0) {
    toast.error('"Бусад" ангилалд нэр бичнэ үү')
    return
  }
  if (form.description.trim().length < 3) {
    toast.error('Тайлбарыг дэлгэрэнгүй бичнэ үү')
    return
  }

  creating.value = true
  try {
    await api.create({
      amount: form.amount,
      category: form.category,
      categoryLabel: form.category === 'other' ? form.categoryLabel.trim() : undefined,
      description: form.description.trim(),
      date: form.date || undefined,
    })
    toast.success('Зарлага бүртгэгдлээ')
    createOpen.value = false
    await load()
  } catch (e: any) {
    toast.error('Бүртгэж чадсангүй', { description: e.message, duration: 9000 })
  } finally {
    creating.value = false
  }
}

// ── BR-47 — хүчингүй болгох ───────────────────────────────────────────────
const voidOpen = ref(false)
const voidTarget = ref<Expense | null>(null)
const voidReason = ref('')
const voiding = ref(false)

function openVoid(expense: Expense) {
  voidTarget.value = expense
  voidReason.value = ''
  voidOpen.value = true
}

async function applyVoid() {
  if (!voidTarget.value || voidReason.value.trim().length < 3) {
    toast.error('Хүчингүй болгох шалтгааныг бичнэ үү')
    return
  }
  voiding.value = true
  try {
    await api.voidExpense(voidTarget.value.id, voidReason.value.trim())
    toast.success('Зарлага хүчингүй боллоо')
    voidOpen.value = false
    await load()
  } catch (e: any) {
    toast.error('Хүчингүй болсонгүй', { description: e.message, duration: 9000 })
  } finally {
    voiding.value = false
  }
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Зарлага"
      :subtitle="`Нийт ${pagination.total.toLocaleString('mn-MN')} бүртгэл`"
    >
      <template #actions>
        <UiBtn variant="secondary" :icon="RefreshCw" :loading="loading" @click="load">
          Сэргээх
        </UiBtn>
        <UiBtn :icon="Plus" @click="openCreate">Зарлага бүртгэх</UiBtn>
      </template>
    </UiPageHeader>

    <div class="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <UiStatCard
        label="Нийт зарлага"
        :value="formatCurrency(summary.total)"
        :hint="`${summary.count} бүртгэл`"
        accent="#DC2626"
      />
      <UiStatCard
        v-for="option in EXPENSE_CATEGORY_OPTIONS.slice(0, 3)"
        :key="option.value"
        :label="option.label"
        :value="formatCurrency(summary.byCategory[option.value]?.total ?? 0)"
        :hint="`${summary.byCategory[option.value]?.count ?? 0} бүртгэл`"
      />
    </div>

    <UiDataTable :columns="columns" :rows="rows" :loading="loading" empty-text="Зарлага олдсонгүй">
      <template #toolbar>
        <UiFilterBar :active-count="activeFilterCount">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UiSelectInput v-model="filters.category" :options="categoryOptions" placeholder="Бүх ангилал" />
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

      <template #cell-date="{ row }">
        <span class="text-body-sm text-content-secondary">{{ formatDate(row.date) }}</span>
      </template>

      <template #cell-category="{ row }">
        <span class="inline-flex rounded-full bg-primary-50 px-2 py-1 text-body-sm font-medium text-primary-600">
          {{ expenseCategoryLabel(row) }}
        </span>
      </template>

      <template #cell-description="{ row }">
        <span class="text-body-sm text-content-secondary">{{ row.description }}</span>
      </template>

      <template #cell-amount="{ row }">
        <span
          class="font-semibold"
          :class="row.status === 'voided' ? 'text-content-disabled line-through' : 'text-content'"
        >
          {{ formatCurrency(row.amount) }}
        </span>
        <span
          v-if="row.status === 'voided'"
          class="ml-2 inline-flex rounded-full bg-surface-hover px-2 py-1 text-body-sm font-medium text-content-secondary"
        >
          Хүчингүй
        </span>
      </template>

      <template #cell-createdByName="{ row }">
        <span class="text-body-sm text-content-secondary">{{ row.createdByName ?? '—' }}</span>
      </template>

      <template #cell-actions="{ row }">
        <UiBtn
          v-if="row.status === 'active'"
          size="sm"
          variant="ghost"
          :icon="Ban"
          @click.stop="openVoid(row)"
        >
          Хүчингүй болгох
        </UiBtn>
      </template>

      <template #empty>
        <UiBtn v-if="!activeFilterCount" class="mt-4" :icon="Plus" @click="openCreate">
          Анхны зарлагыг бүртгэх
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

    <UiModal v-model="createOpen" title="Зарлага бүртгэх" size="sm" persistent>
      <div class="space-y-4">
        <UiField label="Дүн" required>
          <UiTextInput v-model="form.amount" type="number" suffix="₮" tabular placeholder="0" />
        </UiField>

        <UiField label="Ангилал" required>
          <UiSelectInput v-model="form.category" :options="EXPENSE_CATEGORY_OPTIONS" />
        </UiField>

        <UiField v-if="form.category === 'other'" label="Ангиллын нэр" required>
          <UiTextInput v-model="form.categoryLabel" placeholder="Жишээ: Даатгал" />
        </UiField>

        <UiField label="Тайлбар" required>
          <UiTextArea v-model="form.description" :rows="2" placeholder="Жишээ: Оффисын түрээс 8-р сар" />
        </UiField>

        <UiField label="Огноо" required>
          <UiTextInput v-model="form.date" type="date" />
        </UiField>
      </div>

      <template #footer>
        <UiBtn variant="secondary" @click="createOpen = false">Болих</UiBtn>
        <UiBtn :loading="creating" @click="submitCreate">Бүртгэх</UiBtn>
      </template>
    </UiModal>

    <UiModal v-model="voidOpen" title="Зарлагыг хүчингүй болгох" size="sm" persistent>
      <div class="space-y-4">
        <p class="text-body text-content-secondary">
          <span class="tabular font-semibold text-content">
            {{ voidTarget ? formatCurrency(voidTarget.amount) : '' }}
          </span>
          дүнтэй зарлага хүчингүй болно. Бичлэг УСТАХГҮЙ.
        </p>

        <UiField label="Шалтгаан" required hint="Audit Log-д бичигдэнэ">
          <UiTextArea v-model="voidReason" :rows="2" placeholder="Жишээ: буруу дүн бичсэн" />
        </UiField>
      </div>

      <template #footer>
        <UiBtn variant="secondary" @click="voidOpen = false">Болих</UiBtn>
        <UiBtn variant="danger" :loading="voiding" @click="applyVoid">Хүчингүй болгох</UiBtn>
      </template>
    </UiModal>
  </div>
</template>
