<script setup lang="ts">
import { Plus, RefreshCw, Search, Trash2, X } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import type { Column } from '~/components/ui/DataTable.vue'
import type {
  AdminCustomer,
  AdminCustomerPayload,
  CustomerFilters,
  CustomerPagination,
} from '~/composables/useCustomers'

definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Харилцагч — Ивээл Карго' })

const api = useCustomers()
const toast = useToast()
const auth = useAuthStore()

const rows = ref<AdminCustomer[]>([])
const pagination = ref<CustomerPagination>({ page: 1, pages: 1, total: 0, limit: 50 })
const loading = ref(true)
const editorOpen = ref(false)
const editingCustomer = ref<AdminCustomer | null>(null)
const saving = ref(false)
const deleteOpen = ref(false)
const deletingCustomer = ref<AdminCustomer | null>(null)
const deleting = ref(false)
const isAdmin = computed(() => auth.isAdmin)

const filters = reactive<CustomerFilters>({
  search: '',
  loyaltyTier: null,
  status: null,
  hasAccount: null,
  page: 1,
  limit: 50,
})

const tierOptions = [
  { value: 'bronze', label: 'Хүрэл' },
  { value: 'silver', label: 'Мөнгө' },
  { value: 'gold', label: 'Алт' },
]

const statusOptions = [
  { value: 'active', label: 'Идэвхтэй' },
  { value: 'blocked', label: 'Хаагдсан' },
]

const accountOptions = [
  { value: 'true', label: 'Бүртгэлтэй' },
  { value: 'false', label: 'Бүртгэлгүй' },
]

const tierLabels: Record<AdminCustomer['loyaltyTier'], string> = {
  bronze: 'Хүрэл',
  silver: 'Мөнгө',
  gold: 'Алт',
}

const columns: Column<AdminCustomer>[] = [
  { key: 'name', label: 'Нэр' },
  { key: 'phone', label: 'Утас', tabular: true },
  { key: 'email', label: 'Имэйл' },
  { key: 'hasAccount', label: 'Вэб бүртгэл', align: 'center' },
  { key: 'loyaltyTier', label: 'Урамшуулал' },
  { key: 'status', label: 'Төлөв' },
  { key: 'createdAt', label: 'Бүртгэсэн', tabular: true },
  { key: 'actions', label: '', align: 'right', width: '148px' },
]

const activeFilterCount = computed(
  () => [filters.search, filters.loyaltyTier, filters.status, filters.hasAccount].filter(Boolean).length
)

async function load() {
  loading.value = true
  try {
    const result = await api.list({ ...filters })
    rows.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    toast.error('Харилцагчийн жагсаалт ачаалагдсангүй', { description: e.message })
    rows.value = []
  } finally {
    loading.value = false
  }
}

const debouncedLoad = useDebounceFn(load, 300)

watch(
  () => [filters.search, filters.loyaltyTier, filters.status, filters.hasAccount],
  () => {
    filters.page = 1
    debouncedLoad()
  }
)

watch(() => filters.page, load)
onMounted(load)

function resetFilters() {
  filters.search = ''
  filters.loyaltyTier = null
  filters.status = null
  filters.hasAccount = null
}

function openCreate() {
  editingCustomer.value = null
  editorOpen.value = true
}

function openEdit(customer: AdminCustomer) {
  editingCustomer.value = customer
  editorOpen.value = true
}

function openDelete(customer: AdminCustomer) {
  deletingCustomer.value = customer
  deleteOpen.value = true
}

async function saveCustomer(payload: AdminCustomerPayload) {
  saving.value = true
  try {
    if (editingCustomer.value) {
      await api.update(editingCustomer.value.id, payload)
      toast.success('Харилцагчийн мэдээлэл хадгалагдлаа')
    } else {
      await api.create(payload)
      toast.success('Харилцагч нэмэгдлээ')
    }
    editorOpen.value = false
    await load()
  } catch (e: any) {
    toast.error('Хадгалж чадсангүй', { description: e.message })
  } finally {
    saving.value = false
  }
}

async function removeCustomer() {
  if (!deletingCustomer.value) return

  deleting.value = true
  try {
    await api.remove(deletingCustomer.value.id)
    toast.success('Харилцагч бүрмөсөн устлаа')
    deleteOpen.value = false
    deletingCustomer.value = null
    await load()
  } catch (e: any) {
    toast.error('Харилцагч устгаж чадсангүй', { description: e.message })
  } finally {
    deleting.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('mn-MN')
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Харилцагч"
      :subtitle="`Нийт ${pagination.total.toLocaleString('mn-MN')} харилцагч`"
    >
      <template #actions>
        <UiBtn variant="secondary" :icon="RefreshCw" :loading="loading" @click="load">
          Сэргээх
        </UiBtn>
        <UiBtn :icon="Plus" @click="openCreate">Харилцагч нэмэх</UiBtn>
      </template>
    </UiPageHeader>

    <UiDataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      empty-text="Харилцагч олдсонгүй"
      @row-click="openEdit"
    >
      <template #toolbar>
        <UiFilterBar :active-count="activeFilterCount">
          <div class="space-y-3">
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <UiTextInput
                v-model="filters.search"
                :icon="Search"
                placeholder="Нэр, утас, имэйл"
              />
              <UiSelectInput
                v-model="filters.status"
                :options="statusOptions"
                placeholder="Бүх төлөв"
              />
              <UiSelectInput
                v-model="filters.loyaltyTier"
                :options="tierOptions"
                placeholder="Бүх урамшуулал"
              />
              <UiSelectInput
                v-model="filters.hasAccount"
                :options="accountOptions"
                placeholder="Бүх бүртгэл"
              />
            </div>

            <UiBtn v-if="activeFilterCount" size="sm" variant="ghost" :icon="X" @click="resetFilters">
              Шүүлт цэвэрлэх ({{ activeFilterCount }})
            </UiBtn>
          </div>
        </UiFilterBar>
      </template>

      <template #cell-name="{ row }">
        <span class="font-medium text-content">{{ row.name || '—' }}</span>
      </template>

      <template #cell-email="{ row }">
        <span class="text-content-secondary">{{ row.email || '—' }}</span>
      </template>

      <template #cell-hasAccount="{ row }">
        <span
          class="inline-flex rounded-full px-2 py-1 text-body-sm font-medium"
          :class="row.hasAccount ? 'bg-success/10 text-success' : 'bg-surface-hover text-content-secondary'"
        >
          {{ row.hasAccount ? 'Бүртгэлтэй' : 'Бүртгэлгүй' }}
        </span>
      </template>

      <template #cell-loyaltyTier="{ row }">
        <span class="text-content">{{ tierLabels[row.loyaltyTier] }}</span>
        <span class="ml-1 tabular text-body-sm text-content-secondary">{{ row.loyaltyPoints }}</span>
      </template>

      <template #cell-status="{ row }">
        <span
          class="inline-flex rounded-full px-2 py-1 text-body-sm font-medium"
          :class="row.status === 'active' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
        >
          {{ row.status === 'active' ? 'Идэвхтэй' : 'Хаагдсан' }}
        </span>
      </template>

      <template #cell-createdAt="{ row }">
        <span class="text-content-secondary">{{ formatDate(row.createdAt) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-1">
          <UiBtn size="sm" variant="ghost" @click.stop="openEdit(row)">Засах</UiBtn>
          <UiBtn
            v-if="isAdmin"
            size="sm"
            variant="ghost"
            :icon="Trash2"
            aria-label="Харилцагч устгах"
            title="Харилцагч устгах"
            @click.stop="openDelete(row)"
          />
        </div>
      </template>

      <template #empty>
        <UiBtn v-if="!activeFilterCount" class="mt-4" :icon="Plus" @click="openCreate">
          Анхны харилцагч нэмэх
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

    <UiModal
      v-model="editorOpen"
      :title="editingCustomer ? 'Харилцагч засах' : 'Харилцагч нэмэх'"
      :subtitle="editingCustomer ? editingCustomer.phone : 'Утсаар нь шинээр бүртгэнэ'"
    >
      <CustomerEditor
        :customer="editingCustomer"
        :saving="saving"
        @cancel="editorOpen = false"
        @submit="saveCustomer"
      />
    </UiModal>

    <UiModal v-model="deleteOpen" title="Харилцагч устгах" size="sm" persistent>
      <div class="space-y-3">
        <p class="text-body text-content">
          <span class="font-semibold">{{ deletingCustomer?.name || deletingCustomer?.phone }}</span>
          харилцагчийн бичлэг бүрмөсөн устах гэж байна.
        </p>
        <p class="text-body-sm text-content-secondary">
          Энэ үйлдлийг буцаах боломжгүй. Ачааны түүхтэй харилцагчийг устгахгүй.
        </p>
      </div>

      <template #footer>
        <UiBtn variant="secondary" :disabled="deleting" @click="deleteOpen = false">Болих</UiBtn>
        <UiBtn variant="danger" :icon="Trash2" :loading="deleting" @click="removeCustomer">
          Бүрмөсөн устгах
        </UiBtn>
      </template>
    </UiModal>
  </div>
</template>
