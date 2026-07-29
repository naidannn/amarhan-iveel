<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

/**
 * Хуудаслалт — §9.3
 *
 * Backend үргэлж хуудаслагдсан хариу буцаана (default 50, max 100).
 * Энэ компонент зөвхөн хуудасны дугаарыг өөрчилнө — өгөгдөл татахгүй.
 */
const props = defineProps<{
  page: number
  pages: number
  total: number
  limit: number
}>()

const emit = defineEmits<{ 'update:page': [value: number] }>()

const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.limit + 1))
const to = computed(() => Math.min(props.page * props.limit, props.total))

/** Дугаарын жагсаалт: 1 … 4 5 6 … 20 */
const numbers = computed<(number | '…')[]>(() => {
  const { page, pages } = props
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)

  const result: (number | '…')[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pages - 1, page + 1)

  if (start > 2) result.push('…')
  for (let i = start; i <= end; i += 1) result.push(i)
  if (end < pages - 1) result.push('…')
  result.push(pages)

  return result
})

function go(target: number) {
  if (target < 1 || target > props.pages || target === props.page) return
  emit('update:page', target)
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <p class="text-body text-content-secondary">
      Нийт <span class="tabular font-medium text-content">{{ total.toLocaleString('mn-MN') }}</span>
      -аас
      <span class="tabular font-medium text-content">{{ from }}–{{ to }}</span>
    </p>

    <nav v-if="pages > 1" class="flex items-center gap-1" aria-label="Хуудаслалт">
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-btn text-content-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-content disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        :disabled="page <= 1"
        aria-label="Өмнөх хуудас"
        @click="go(page - 1)"
      >
        <ChevronLeft :size="18" />
      </button>

      <template v-for="(item, index) in numbers" :key="`${item}-${index}`">
        <span v-if="item === '…'" class="px-1.5 text-body text-content-disabled">…</span>
        <button
          v-else
          type="button"
          class="tabular h-9 min-w-9 rounded-btn px-2.5 text-body font-medium transition-colors duration-200"
          :class="
            item === page
              ? 'bg-primary text-white'
              : 'text-content-secondary hover:bg-surface-hover hover:text-content'
          "
          :aria-current="item === page ? 'page' : undefined"
          @click="go(item)"
        >
          {{ item }}
        </button>
      </template>

      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-btn text-content-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-content disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        :disabled="page >= pages"
        aria-label="Дараагийн хуудас"
        @click="go(page + 1)"
      >
        <ChevronRight :size="18" />
      </button>
    </nav>
  </div>
</template>
