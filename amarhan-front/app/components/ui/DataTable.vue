<script setup lang="ts" generic="T extends Record<string, any>">
import { ArrowUp, ArrowDown, Inbox } from 'lucide-vue-next'

/**
 * Хүснэгт — Design System v1
 *
 * Өндөр мөр · zebra БАЙХГҮЙ · hover өнгөтэй · search/filter дээрээ · pagination доор.
 *
 * ЧУХАЛ (§9.3): эрэмбэлэлт, шүүлт, хуудаслалт бүгд SERVER талд хийгдэнэ.
 * Энэ компонент зөвхөн харуулна — `Array.sort`/`Array.filter` хийхгүй.
 * 1M+ мөртэй үед client талд боловсруулах нь шаардлагыг зөрчинө.
 */
export interface Column<Row> {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  /** Тоон багана — зэрэгцүүлэх */
  tabular?: boolean
  width?: string
}

const props = withDefaults(
  defineProps<{
    columns: Column<T>[]
    rows: T[]
    rowKey?: keyof T | ((row: T) => string)
    loading?: boolean
    /** `field` эсвэл `-field` (буурахаар) */
    sort?: string | null
    emptyText?: string
    selectable?: boolean
    selected?: Array<string>
  }>(),
  { rowKey: 'id', emptyText: 'Мэдээлэл олдсонгүй' }
)

const emit = defineEmits<{
  'update:sort': [value: string]
  'update:selected': [value: string[]]
  rowClick: [row: T]
}>()

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

function keyOf(row: T): string {
  return typeof props.rowKey === 'function' ? props.rowKey(row) : String(row[props.rowKey])
}

function sortState(key: string): 'asc' | 'desc' | null {
  if (props.sort === key) return 'asc'
  if (props.sort === `-${key}`) return 'desc'
  return null
}

function toggleSort(column: Column<T>) {
  if (!column.sortable) return
  emit('update:sort', sortState(column.key) === 'asc' ? `-${column.key}` : column.key)
}

const allSelected = computed(
  () => props.rows.length > 0 && props.rows.every(r => props.selected?.includes(keyOf(r)))
)

function toggleAll() {
  emit('update:selected', allSelected.value ? [] : props.rows.map(keyOf))
}

function toggleRow(row: T) {
  const key = keyOf(row)
  const current = props.selected ?? []
  emit(
    'update:selected',
    current.includes(key) ? current.filter(k => k !== key) : [...current, key]
  )
}
</script>

<template>
  <div class="overflow-hidden rounded-card bg-surface-card shadow-card">
    <!-- Хайлт / шүүлт — хүснэгтийн ДЭЭР -->
    <div v-if="$slots.toolbar" class="border-b border-surface-border px-card py-4">
      <slot name="toolbar" />
    </div>

    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-left">
        <thead>
          <tr class="border-b border-surface-border">
            <th v-if="selectable" class="w-12 px-4 py-3.5">
              <input
                type="checkbox"
                class="h-4 w-4 cursor-pointer rounded border-surface-border text-primary focus:ring-2 focus:ring-primary-200"
                :checked="allSelected"
                aria-label="Бүгдийг сонгох"
                @change="toggleAll"
              />
            </th>

            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              class="px-4 py-3.5 text-body font-medium text-content-secondary"
              :class="ALIGN[column.align ?? 'left']"
              :style="column.width ? { width: column.width } : undefined"
              :aria-sort="
                sortState(column.key) === 'asc'
                  ? 'ascending'
                  : sortState(column.key) === 'desc'
                    ? 'descending'
                    : undefined
              "
            >
              <button
                v-if="column.sortable"
                type="button"
                class="inline-flex items-center gap-1 rounded transition-colors duration-200 hover:text-content"
                @click="toggleSort(column)"
              >
                {{ column.label }}
                <ArrowUp v-if="sortState(column.key) === 'asc'" :size="14" :stroke-width="2.4" />
                <ArrowDown
                  v-else-if="sortState(column.key) === 'desc'"
                  :size="14"
                  :stroke-width="2.4"
                />
              </button>
              <template v-else>{{ column.label }}</template>
            </th>
          </tr>
        </thead>

        <!--
          v-if ба v-for-ыг НЭГ элемент дээр ХАМТ бичихийг хориглоно. Vue 3-д
          v-if нь илүү өндөр эрэмбэтэй тул `<tr v-if="loading" v-for=...>` гэж
          бичихэд v-for нь фрагмент болж, дараагийн `v-else-if`/`v-else` салаа
          холбогдохоо больдог — үр дүнд өгөгдлийн мөр ХЭЗЭЭ Ч гарахгүй, зөвхөн
          skeleton үлддэг. Тиймээс салаа бүрийг `<template>`-ээр тусгаарлав.
        -->
        <tbody>
          <!-- Ачаалж буй -->
          <template v-if="loading">
            <tr v-for="n in 5" :key="`skeleton-${n}`" class="border-b border-surface-border">
              <td v-if="selectable" class="px-4 py-4">
                <div class="h-4 w-4 animate-pulse rounded bg-surface-hover" />
              </td>
              <td v-for="column in columns" :key="column.key" class="px-4 py-4">
                <div class="h-4 animate-pulse rounded bg-surface-hover" />
              </td>
            </tr>
          </template>

          <!-- Хоосон -->
          <tr v-else-if="rows.length === 0">
            <td :colspan="columns.length + (selectable ? 1 : 0)" class="px-4 py-16">
              <div class="flex flex-col items-center justify-center text-center">
                <Inbox :size="32" :stroke-width="1.6" class="text-content-disabled" />
                <p class="mt-3 text-body text-content-secondary">{{ emptyText }}</p>
                <slot name="empty" />
              </div>
            </td>
          </tr>

          <!-- Өгөгдөл -->
          <template v-else>
            <tr
              v-for="row in rows"
              :key="keyOf(row)"
              class="table-row"
              :class="$attrs.onRowClick || $slots.default ? 'cursor-pointer' : ''"
              @click="emit('rowClick', row)"
            >
              <td v-if="selectable" class="px-4 py-4" @click.stop>
                <input
                  type="checkbox"
                  class="h-4 w-4 cursor-pointer rounded border-surface-border text-primary focus:ring-2 focus:ring-primary-200"
                  :checked="selected?.includes(keyOf(row))"
                  :aria-label="`${keyOf(row)} сонгох`"
                  @change="toggleRow(row)"
                />
              </td>

              <td
                v-for="column in columns"
                :key="column.key"
                class="px-4 py-4 text-body text-content"
                :class="[ALIGN[column.align ?? 'left'], column.tabular && 'tabular']"
              >
                <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">
                  {{ row[column.key] }}
                </slot>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Хуудаслалт — хүснэгтийн ДООР -->
    <div v-if="$slots.footer" class="border-t border-surface-border px-card py-3.5">
      <slot name="footer" />
    </div>
  </div>
</template>
