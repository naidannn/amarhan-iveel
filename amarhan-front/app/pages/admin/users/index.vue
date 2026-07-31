<script setup lang="ts">
import { Plus, RefreshCw, Search, X } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import type { Column } from '~/components/ui/DataTable.vue'
import type {
  SystemUser,
  SystemUserPayload,
  UserFilters,
  UserPagination,
} from '~/composables/useUsers'

definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Системийн хэрэглэгч — Ивээл Карго' })

const auth = useAuthStore()
const api = useUsers()
const toast = useToast()

const rows = ref<SystemUser[]>([])
const pagination = ref<UserPagination>({ page: 1, pages: 1, total: 0, limit: 50 })
const loading = ref(true)
const saving = ref(false)
const editorOpen = ref(false)
const editingUser = ref<SystemUser | null>(null)
const editorKey = ref(0)

const filters = reactive<UserFilters>({
  search: '',
  role: null,
  status: null,
  page: 1,
  limit: 50,
})

const roleOptions = [
  { value: 'admin', label: 'Админ' },
  { value: 'manager', label: 'Менежер' },
  { value: 'staff', label: 'Ажилтан' },
]

const statusOptions = [
  { value: 'active', label: 'Идэвхтэй' },
  { value: 'deactive', label: 'Идэвхгүй' },
]

const roleLabels: Record<SystemUser['role'], string> = {
  admin: 'Админ',
  manager: 'Менежер',
  staff: 'Ажилтан',
}

const columns: Column<SystemUser>[] = [
  { key: 'name', label: 'Нэр' },
  { key: 'email', label: 'Имэйл' },
  { key: 'role', label: 'Эрх' },
  { key: 'status', label: 'Төлөв' },
  { key: 'lastLoginAt', label: 'Сүүлд нэвтэрсэн', tabular: true },
  { key: 'createdAt', label: 'Бүртгэсэн', tabular: true },
  { key: 'actions', label: '', align: 'right', width: '88px' },
]

const activeFilterCount = computed(() => [filters.search, filters.role, filters.status].filter(Boolean).length)

async function load() {
  loading.value = true
  try {
    const result = await api.list({ ...filters })
    rows.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    rows.value = []
    toast.error('Хэрэглэгчийн жагсаалт ачаалагдсангүй', { description: e.message })
  } finally {
    loading.value = false
  }
}

const debouncedLoad = useDebounceFn(load, 300)
watch(
  () => [filters.search, filters.role, filters.status],
  () => {
    filters.page = 1
    debouncedLoad()
  }
)
watch(() => filters.page, load)
onMounted(async () => {
  if (!auth.isAdmin) {
    await navigateTo('/admin')
    return
  }
  await load()
})

function resetFilters() {
  filters.search = ''
  filters.role = null
  filters.status = null
}

function openCreate() {
  editingUser.value = null
  editorKey.value += 1
  editorOpen.value = true
}

function openEdit(user: SystemUser) {
  editingUser.value = user
  editorKey.value += 1
  editorOpen.value = true
}

async function saveUser(payload: SystemUserPayload) {
  saving.value = true
  try {
    if (editingUser.value) {
      const { password: _password, ...updatePayload } = payload
      await api.update(editingUser.value.id, updatePayload)
      toast.success('Хэрэглэгчийн мэдээлэл хадгалагдлаа')
    } else {
      await api.create(payload)
      toast.success('Системийн хэрэглэгч нэмэгдлээ')
    }
    editorOpen.value = false
    await load()
  } catch (e: any) {
    toast.error('Хадгалж чадсангүй', { description: e.message })
  } finally {
    saving.value = false
  }
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('mn-MN')
}
</script>

<template>
  <div v-if="auth.isAdmin">
    <UiPageHeader title="Системийн хэрэглэгч" :subtitle="`Нийт ${pagination.total.toLocaleString('mn-MN')} ажилтан`">
      <template #actions>
        <UiBtn variant="secondary" :icon="RefreshCw" :loading="loading" @click="load">Сэргээх</UiBtn>
        <UiBtn :icon="Plus" @click="openCreate">Хэрэглэгч нэмэх</UiBtn>
      </template>
    </UiPageHeader>

    <UiDataTable :columns="columns" :rows="rows" :loading="loading" empty-text="Системийн хэрэглэгч олдсонгүй" @row-click="openEdit">
      <template #toolbar>
        <div class="space-y-3">
          <div class="grid gap-3 sm:grid-cols-3">
            <UiTextInput v-model="filters.search" :icon="Search" placeholder="Нэр, имэйлээр хайх" />
            <UiSelectInput v-model="filters.role" :options="roleOptions" placeholder="Бүх эрх" />
            <UiSelectInput v-model="filters.status" :options="statusOptions" placeholder="Бүх төлөв" />
          </div>
          <UiBtn v-if="activeFilterCount" size="sm" variant="ghost" :icon="X" @click="resetFilters">
            Шүүлт цэвэрлэх ({{ activeFilterCount }})
          </UiBtn>
        </div>
      </template>

      <template #cell-name="{ row }"><span class="font-medium text-content">{{ `${row.lastname} ${row.firstname}`.trim() }}</span></template>
      <template #cell-email="{ row }"><span class="text-content-secondary">{{ row.email }}</span></template>
      <template #cell-role="{ row }"><span class="inline-flex rounded-full bg-primary-50 px-2 py-1 text-body-sm font-medium text-primary-600">{{ roleLabels[row.role] }}</span></template>
      <template #cell-status="{ row }">
        <span class="inline-flex rounded-full px-2 py-1 text-body-sm font-medium" :class="row.status === 'active' ? 'bg-success/10 text-success' : 'bg-surface-hover text-content-secondary'">
          {{ row.status === 'active' ? 'Идэвхтэй' : 'Идэвхгүй' }}
        </span>
      </template>
      <template #cell-lastLoginAt="{ row }"><span class="text-content-secondary">{{ formatDate(row.lastLoginAt) }}</span></template>
      <template #cell-createdAt="{ row }"><span class="text-content-secondary">{{ formatDate(row.createdAt) }}</span></template>
      <template #cell-actions="{ row }"><UiBtn size="sm" variant="ghost" @click.stop="openEdit(row)">Засах</UiBtn></template>

      <template #empty>
        <UiBtn v-if="!activeFilterCount" class="mt-4" :icon="Plus" @click="openCreate">Анхны хэрэглэгч нэмэх</UiBtn>
        <UiBtn v-else class="mt-4" variant="secondary" @click="resetFilters">Шүүлтийг цэвэрлэх</UiBtn>
      </template>
      <template #footer>
        <UiPagination :page="pagination.page" :pages="pagination.pages" :total="pagination.total" :limit="pagination.limit" @update:page="filters.page = $event" />
      </template>
    </UiDataTable>

    <UiModal v-model="editorOpen" :title="editingUser ? 'Системийн хэрэглэгч засах' : 'Системийн хэрэглэгч нэмэх'" :subtitle="editingUser ? editingUser.email : 'Дотоод системд нэвтрэх ажилтан үүсгэнэ'">
      <UserEditor :key="editorKey" :user="editingUser" :saving="saving" @cancel="editorOpen = false" @submit="saveUser" />
    </UiModal>
  </div>
</template>
