<script setup lang="ts">
import { Archive, Boxes, Edit3, MapPin, Plus, RefreshCw, Search, X } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import type { Column } from '~/components/ui/DataTable.vue'
import type {
  WarehouseLocation,
  WarehousePagination,
} from '~/composables/useWarehouseLocations'

/**
 * Агуулах — §8
 *
 * Байршил бүр нь нэг физик нүд. Хайлт, шүүлт, хуудаслалт сервер дээр хийгдэнэ;
 * энэ дэлгэц нь олдсон нүднүүдийг client талд дахин шүүх/эрэмбэлэхгүй.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })
useHead({ title: 'Агуулах — Ивээл Карго' })

const api = useWarehouseLocations()
const auth = useAuthStore()
const toast = useToast()

const rows = ref<WarehouseLocation[]>([])
const pagination = ref<WarehousePagination>({ page: 1, pages: 1, total: 0, limit: 50 })
const loading = ref(true)

const filters = reactive({
  code: '',
  room: '',
  shelf: '',
  availability: '' as '' | 'free',
  state: '' as '' | 'active' | 'inactive',
  page: 1,
  limit: 50,
})

const columns: Column<WarehouseLocation>[] = [
  { key: 'code', label: 'Байршлын код', tabular: true },
  { key: 'structure', label: 'Байршил' },
  { key: 'currentCount', label: 'Ачаа', align: 'right', tabular: true },
  { key: 'currentM3', label: 'Эзлэхүүн', align: 'right', tabular: true },
  { key: 'occupancy', label: 'Дүүргэлт', width: '180px' },
  { key: 'isActive', label: 'Төлөв' },
  { key: 'actions', label: '', align: 'right', width: '72px' },
]

const isAdmin = computed(() => auth.isAdmin)
const activeFilterCount = computed(
  () => [filters.code, filters.room, filters.shelf, filters.availability, filters.state].filter(Boolean).length
)
const fullOnPage = computed(() => rows.value.filter(location => location.isFull).length)
const occupiedOnPage = computed(() => rows.value.filter(location => location.currentCount > 0).length)

const availabilityOptions = [
  { value: '', label: 'Бүх багтаамж' },
  { value: 'free', label: 'Сул нүд' },
]

const stateOptions = [
  { value: '', label: 'Бүх төлөв' },
  { value: 'active', label: 'Идэвхтэй' },
  { value: 'inactive', label: 'Идэвхгүй' },
]

async function load() {
  loading.value = true
  try {
    const result = await api.list({
      code: filters.code,
      room: filters.room,
      shelf: filters.shelf,
      onlyFree: filters.availability === 'free',
      isActive:
        filters.state === '' ? null : filters.state === 'active',
      page: filters.page,
      limit: filters.limit,
    })
    rows.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    toast.error('Агуулахын мэдээлэл ачаалагдсангүй', { description: e.message })
    rows.value = []
  } finally {
    loading.value = false
  }
}

const debouncedLoad = useDebounceFn(load, 300)
watch(
  () => [filters.code, filters.room, filters.shelf, filters.availability, filters.state],
  () => {
    filters.page = 1
    debouncedLoad()
  }
)
watch(() => filters.page, load)
onMounted(load)

function resetFilters() {
  filters.code = ''
  filters.room = ''
  filters.shelf = ''
  filters.availability = ''
  filters.state = ''
}

function occupancy(location: WarehouseLocation) {
  if (location.capacityCount == null) return null
  if (location.capacityCount === 0) return location.currentCount > 0 ? 100 : 0
  return Math.min(100, Math.round((location.currentCount / location.capacityCount) * 100))
}

function countLabel(location: WarehouseLocation) {
  return location.capacityCount == null
    ? `${location.currentCount} ачаа`
    : `${location.currentCount} / ${location.capacityCount}`
}

function formatVolume(value: number) {
  return `${Number(value ?? 0).toLocaleString('mn-MN', { maximumFractionDigits: 2 })} м³`
}

function volumeLabel(location: WarehouseLocation) {
  const current = formatVolume(location.currentM3)
  return location.capacityM3 == null ? current : `${current} / ${location.capacityM3} м³`
}

// ── Тавиур үүсгэх (зөвхөн админ) ───────────────────────────────────────
const shelfOpen = ref(false)
const creatingShelf = ref(false)
const shelfForm = reactive({
  room: null as number | null,
  shelf: '',
  rows: null as number | null,
  cells: null as number | null,
  capacityCount: null as number | null,
  capacityM3: null as number | null,
})

function openShelfCreate() {
  shelfForm.room = null
  shelfForm.shelf = ''
  shelfForm.rows = null
  shelfForm.cells = null
  shelfForm.capacityCount = null
  shelfForm.capacityM3 = null
  shelfOpen.value = true
}

async function createShelf() {
  if (shelfForm.room == null || !shelfForm.shelf || shelfForm.rows == null || shelfForm.cells == null) {
    toast.error('Өрөө, тавиур, мөр болон нүдний тоог оруулна уу')
    return
  }

  creatingShelf.value = true
  try {
    const result = await api.createShelf({
      room: shelfForm.room,
      shelf: shelfForm.shelf.trim().toUpperCase(),
      rows: shelfForm.rows,
      cells: shelfForm.cells,
      capacityCount: shelfForm.capacityCount,
      capacityM3: shelfForm.capacityM3,
    })
    shelfOpen.value = false
    toast.success(
      result.created
        ? `${result.created} байршил үүслээ`
        : 'Энэ тавиурын бүх байршил аль хэдийн бүртгэлтэй байна'
    )
    await load()
  } catch (e: any) {
    toast.error('Тавиур үүсгэж чадсангүй', { description: e.message })
  } finally {
    creatingShelf.value = false
  }
}

// ── Байршлын тохиргоо ───────────────────────────────────────────────────
const selectedLocation = ref<WarehouseLocation | null>(null)
const detailOpen = ref(false)
const savingLocation = ref(false)
const locationForm = reactive({
  capacityCount: null as number | null,
  capacityM3: null as number | null,
  isActive: true,
})

function openLocation(location: WarehouseLocation) {
  selectedLocation.value = location
  locationForm.capacityCount = location.capacityCount
  locationForm.capacityM3 = location.capacityM3
  locationForm.isActive = location.isActive
  detailOpen.value = true
}

async function saveLocation() {
  if (!selectedLocation.value) return

  savingLocation.value = true
  try {
    const updated = await api.update(selectedLocation.value.id, {
      capacityCount: locationForm.capacityCount,
      capacityM3: locationForm.capacityM3,
      isActive: locationForm.isActive,
    })
    const index = rows.value.findIndex(location => location.id === updated.id)
    if (index !== -1) rows.value[index] = updated
    selectedLocation.value = updated
    toast.success(`${updated.code} байршлын тохиргоо хадгалагдлаа`)
    detailOpen.value = false
  } catch (e: any) {
    toast.error('Тохиргоо хадгалж чадсангүй', { description: e.message })
  } finally {
    savingLocation.value = false
  }
}
</script>

<template>
  <div>
    <UiPageHeader title="Агуулах" :subtitle="`Нийт ${pagination.total.toLocaleString('mn-MN')} байршил`">
      <template #actions>
        <UiBtn variant="secondary" :icon="RefreshCw" :loading="loading" @click="load">
          Сэргээх
        </UiBtn>
        <UiBtn v-if="isAdmin" :icon="Plus" @click="openShelfCreate">Тавиур үүсгэх</UiBtn>
      </template>
    </UiPageHeader>

    <div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiStatCard label="Нийт байршил" :value="pagination.total" :icon="MapPin" :loading="loading" />
      <UiStatCard
        label="Эзэлсэн нүд"
        :value="occupiedOnPage"
        :hint="`Энэ хуудсанд ${rows.length} нүд`"
        :icon="Boxes"
        accent="#355DFF"
        :loading="loading"
      />
      <UiStatCard
        label="Дүүрсэн нүд"
        :value="fullOnPage"
        hint="Багтаамжийн хязгаарт хүрсэн"
        :icon="Archive"
        accent="#F59E0B"
        :loading="loading"
      />
      <UiStatCard
        label="Сул нүд"
        :value="Math.max(0, rows.length - fullOnPage)"
        hint="Энэ хуудсан дээр"
        :icon="MapPin"
        accent="#16A34A"
        :loading="loading"
      />
    </div>

    <UiDataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      empty-text="Байршил олдсонгүй"
      @row-click="openLocation"
    >
      <template #toolbar>
        <div class="space-y-3">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <UiTextInput v-model="filters.code" :icon="Search" placeholder="Код: UB-02-B" tabular />
            <UiTextInput v-model="filters.room" placeholder="Өрөө" tabular />
            <UiTextInput v-model="filters.shelf" placeholder="Тавиур" tabular />
            <UiSelectInput v-model="filters.availability" :options="availabilityOptions" />
            <UiSelectInput v-model="filters.state" :options="stateOptions" />
          </div>

          <UiBtn v-if="activeFilterCount" size="sm" variant="ghost" :icon="X" @click="resetFilters">
            Шүүлт цэвэрлэх ({{ activeFilterCount }})
          </UiBtn>
        </div>
      </template>

      <template #cell-code="{ row }">
        <span class="font-semibold text-content">{{ row.code }}</span>
      </template>

      <template #cell-structure="{ row }">
        <span class="text-content">Өрөө {{ row.room }} · Тавиур {{ row.shelf }}</span>
        <span class="ml-1 text-content-secondary">· Мөр {{ row.row }}, нүд {{ row.cell }}</span>
      </template>

      <template #cell-currentCount="{ row }">
        <span :class="row.isFull ? 'font-semibold text-warning' : 'text-content'">
          {{ countLabel(row) }}
        </span>
      </template>

      <template #cell-currentM3="{ row }">
        <span class="text-content-secondary">{{ volumeLabel(row) }}</span>
      </template>

      <template #cell-occupancy="{ row }">
        <div v-if="occupancy(row) != null" class="min-w-32">
          <div class="mb-1 flex items-center justify-between text-body-sm">
            <span :class="row.isFull ? 'font-medium text-warning' : 'text-content-secondary'">
              {{ occupancy(row) }}%
            </span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-surface-hover">
            <div
              class="h-full rounded-full"
              :class="row.isFull ? 'bg-warning' : occupancy(row)! >= 80 ? 'bg-primary-400' : 'bg-success'"
              :style="{ width: `${occupancy(row)}%` }"
            />
          </div>
        </div>
        <span v-else class="text-body-sm text-content-secondary">Хязгааргүй</span>
      </template>

      <template #cell-isActive="{ row }">
        <span
          class="inline-flex rounded-full px-2 py-1 text-body-sm font-medium"
          :class="row.isActive ? 'bg-success/10 text-success' : 'bg-surface-hover text-content-secondary'"
        >
          {{ row.isActive ? 'Идэвхтэй' : 'Идэвхгүй' }}
        </span>
      </template>

      <template #cell-actions="{ row }">
        <button
          type="button"
          class="rounded-btn p-2 text-content-secondary transition-colors hover:bg-surface-hover hover:text-content"
          :aria-label="`${row.code} байршлыг харах`"
          @click.stop="openLocation(row)"
        >
          <Edit3 :size="17" />
        </button>
      </template>

      <template #empty>
        <UiBtn v-if="isAdmin && !activeFilterCount" class="mt-4" :icon="Plus" @click="openShelfCreate">
          Анхны тавиур үүсгэх
        </UiBtn>
        <UiBtn v-else-if="activeFilterCount" class="mt-4" variant="secondary" @click="resetFilters">
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

    <UiModal v-model="shelfOpen" title="Тавиур үүсгэх" subtitle="Мөр, нүд бүрт нэг байршил автоматаар үүснэ" persistent>
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Өрөө" required hint="0–99">
          <UiTextInput v-model="shelfForm.room" type="number" placeholder="Жишээ: 2" tabular />
        </UiField>
        <UiField label="Тавиур" required hint="Нэг үсэг">
          <UiTextInput v-model="shelfForm.shelf" placeholder="Жишээ: B" />
        </UiField>
        <UiField label="Мөрийн тоо" required hint="1–9">
          <UiTextInput v-model="shelfForm.rows" type="number" placeholder="Жишээ: 5" tabular />
        </UiField>
        <UiField label="Мөр дэх нүд" required hint="1–9">
          <UiTextInput v-model="shelfForm.cells" type="number" placeholder="Жишээ: 4" tabular />
        </UiField>
        <UiField label="Нэг нүдний ачааны багтаамж" hint="Хоосон бол хязгааргүй">
          <UiTextInput v-model="shelfForm.capacityCount" type="number" placeholder="Жишээ: 10" suffix="ачаа" tabular />
        </UiField>
        <UiField label="Нэг нүдний эзлэхүүний багтаамж" hint="Хоосон бол хязгааргүй">
          <UiTextInput v-model="shelfForm.capacityM3" type="number" placeholder="Жишээ: 2.5" suffix="м³" tabular />
        </UiField>
      </div>

      <template #footer>
        <UiBtn variant="secondary" :disabled="creatingShelf" @click="shelfOpen = false">Болих</UiBtn>
        <UiBtn :loading="creatingShelf" @click="createShelf">Үүсгэх</UiBtn>
      </template>
    </UiModal>

    <UiModal
      v-model="detailOpen"
      :title="selectedLocation?.code ?? 'Байршил'"
      subtitle="Агуулахын нүдний мэдээлэл ба багтаамж"
      persistent
    >
      <div v-if="selectedLocation" class="space-y-5">
        <div class="grid grid-cols-2 gap-3 rounded-card bg-surface-bg p-4 text-body">
          <div>
            <p class="text-content-secondary">Байршил</p>
            <p class="mt-1 font-medium text-content">Өрөө {{ selectedLocation.room }} · {{ selectedLocation.shelf }}</p>
          </div>
          <div>
            <p class="text-content-secondary">Мөр / нүд</p>
            <p class="mt-1 font-medium text-content">{{ selectedLocation.row }} / {{ selectedLocation.cell }}</p>
          </div>
          <div>
            <p class="text-content-secondary">Одоогийн ачаа</p>
            <p class="mt-1 font-medium text-content">{{ countLabel(selectedLocation) }}</p>
          </div>
          <div>
            <p class="text-content-secondary">Эзлэхүүн</p>
            <p class="mt-1 font-medium text-content">{{ volumeLabel(selectedLocation) }}</p>
          </div>
        </div>

        <template v-if="isAdmin">
          <div class="grid gap-4 sm:grid-cols-2">
            <UiField label="Ачааны багтаамж" hint="Хоосон бол хязгааргүй">
              <UiTextInput v-model="locationForm.capacityCount" type="number" suffix="ачаа" tabular />
            </UiField>
            <UiField label="Эзлэхүүний багтаамж" hint="Хоосон бол хязгааргүй">
              <UiTextInput v-model="locationForm.capacityM3" type="number" suffix="м³" tabular />
            </UiField>
          </div>
          <label class="flex cursor-pointer items-center gap-3 rounded-btn border border-surface-border px-3 py-3 text-body">
            <input v-model="locationForm.isActive" type="checkbox" class="h-4 w-4 rounded border-surface-border text-primary focus:ring-primary-200" />
            <span>
              <span class="block font-medium text-content">Идэвхтэй байршил</span>
              <span class="block text-body-sm text-content-secondary">Идэвхгүй нүдийг ачаа байршуулахад сонгохгүй.</span>
            </span>
          </label>
        </template>
      </div>

      <template #footer>
        <UiBtn variant="secondary" :disabled="savingLocation" @click="detailOpen = false">Хаах</UiBtn>
        <UiBtn v-if="isAdmin" :loading="savingLocation" @click="saveLocation">Хадгалах</UiBtn>
      </template>
    </UiModal>
  </div>
</template>
